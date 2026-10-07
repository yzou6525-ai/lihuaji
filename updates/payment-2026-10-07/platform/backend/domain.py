import secrets,datetime
from fastapi import HTTPException
from sqlalchemy import select,update,func
from .models import *
from .chain import chain,sha,LOCK
from .media import verify_media
from .config import PAYMENT_MODE
STEPS=['开针','换色','收针','质检']
def require(value,message,status=422):
 if not value:raise HTTPException(status,message)
def text(value,limit=300):
 require(isinstance(value,str) and bool(value.strip()) and len(value)<=limit,'文字字段为空或过长');return value.strip()
def integer(value,minimum,maximum):
 require(type(value) is int and minimum<=value<=maximum,'数字参数超出允许范围');return value
def identifier(value,optional=False):
 if optional and value is None:return None
 require(isinstance(value,str) and bool(value.strip()) and len(value)<=128,'记录标识格式不正确');return value
def object_list(value,limit=30):
 require(isinstance(value,list) and len(value)<=limit and all(isinstance(item,dict) for item in value),'列表项目格式不正确');return value
def rights_match(d,record,db):
 if not record or record.design_id!=d.id or record.owner_id!=d.owner_id:return False
 block=db.scalar(select(ChainBlock).where(ChainBlock.digest==record.tx_hash))
 return bool(block and chain.verify_block(block) and block.entity==d.id and block.event=='RIGHTS_REGISTERED' and block.payload=={'design_hash':record.design_hash,'rights':record.rights})
def serialize(row,exclude=()):return {c.name:getattr(row,c.name) for c in row.__table__.columns if c.name not in exclude}
def audit(db,actor,action,entity='',detail=None):db.add(AuditLog(actor_id=actor,action=action,entity=entity,detail=detail or {}))
def design_hash(d,db):
 source=db.get(Media,d.source_media_id);result=db.get(Media,d.result_media_id) if d.result_media_id else None
 return sha({'id':d.id,'owner_id':d.owner_id,'source_hash':source.digest,'result_hash':result.digest if result else '', 'svg_hash':sha(d.svg),'spec':d.spec,'evaluation':d.evaluation,'provenance':d.provenance})
def register_rights(db,d):
 prior=db.scalar(select(CopyrightRecord).where(CopyrightRecord.design_id==d.id))
 if prior:return prior
 require(d.state=='ready','绣稿尚未完成');value=design_hash(d,db);rights={'story':{'holder':d.owner_id,'scope':'用户声明拥有上传内容的使用授权'},'design':{'holder':d.owner_id,'scope':'本次生成稿的使用约定；AI参与创作已披露'},'physical':{'holder':'按订单约定','scope':'制作服务与实体成品权益随具体订单约定'},'notice':'模拟链权益约定，不是法定版权登记，AI图像的法律权属须另行判断'}
 tx=chain.append(db,d.id,'RIGHTS_REGISTERED',{'design_hash':value,'rights':rights});row=CopyrightRecord(design_id=d.id,owner_id=d.owner_id,design_hash=value,rights=rights,tx_hash=tx);db.add(row);db.flush();return row
def order_view(o,db,private=True):
 data=serialize(o,() if private else ('shipping','owner_id','request_id','trace_token','options'))
 design=db.get(Design,o.design_id) if o.design_id else None;data['design_title']=design.title if design else ''
 data['items']=[serialize(x) for x in db.scalars(select(OrderItem).where(OrderItem.order_id==o.id))];data['payment']=None
 p=db.scalar(select(Payment).where(Payment.order_id==o.id))
 if p:data['payment']={'provider':p.provider,'amount_fen':p.amount_fen,'created_at':p.created_at}
 data['nodes']=[serialize(n) for n in db.scalars(select(ProductionNode).where(ProductionNode.order_id==o.id).order_by(ProductionNode.step))];return data
def get_order(db,ident,user,artisan=False):
 o=db.scalar(select(Order).where(Order.id==ident).with_for_update());require(o,'订单不存在',404)
 profile=db.scalar(select(Embroiderer).where(Embroiderer.user_id==user.id)) if artisan else None
 require(user.role=='admin' or o.owner_id==user.id or (profile and o.artisan_id==profile.id),'不能查看其他用户的订单',403);return o
def shipping_data(data):
 require(isinstance(data,dict),'请填写收货信息');return {'name':text(data.get('name'),40),'phone':text(data.get('phone'),30),'address':text(data.get('address'),300)}
def cancel_pending(db,o):
 require(o.state=='pending_payment','只有待付款订单可以取消',409)
 for item in db.scalars(select(OrderItem).where(OrderItem.order_id==o.id)):db.execute(update(SKU).where(SKU.id==item.sku_id).values(stock=SKU.stock+item.quantity))
 for c in db.scalars(select(Coupon).where(Coupon.used_order_id==o.id)):c.used_order_id=None
 o.state='cancelled';audit(db,o.owner_id,'order.cancel',o.id)
def expire_orders(db):
 for o in db.scalars(select(Order).where(Order.state=='pending_payment',Order.expires_at<now()).with_for_update()):
  if PAYMENT_MODE=='live' and o.options.get('_payment_provider'):continue
  cancel_pending(db,o)
def create_order(db,user,data):
 request_id=text(data.get('request_id'),100);prior=db.scalar(select(Order).where(Order.owner_id==user.id,Order.request_id==request_id))
 if prior:return prior
 expire_orders(db);kind=data.get('kind');require(kind in ['custom','product'],'订单类型无效');d=None;items=[];amount=0
 options=data.get('options',{});require(isinstance(options,dict) and all(isinstance(k,str) and not k.startswith('_') for k in options),'订单选项无效，不能设置内部支付字段');clean_options={}
 if kind=='custom':
  d=db.get(Design,identifier(data.get('design_id')));require(d and d.owner_id==user.id and d.state=='ready','请选择自己的已完成绣稿');record=db.scalar(select(CopyrightRecord).where(CopyrightRecord.design_id==d.id));require(record,'请先完成权益存证');require(rights_match(d,record,db),'权益记录与链上记录不一致，请暂停定制',409);require(design_hash(d,db)==record.design_hash and verify_media(db.get(Media,d.source_media_id)) and verify_media(db.get(Media,d.result_media_id)),'作品内容或文件已变化，请重新生成后下单',409);fabric=options.get('fabric','真丝');require(fabric in ['真丝','棉麻'],'底布选项无效');clean_options={'fabric':fabric};amount=18000+int(d.spec.get('size_mm',160))*100+int(d.evaluation.get('stitches',1000))*2+(6000 if fabric=='真丝' else 0)
 else:
  cart=object_list(data.get('items',[]));require(bool(cart),'购物清单为空或超过30项');seen=set()
  for item in cart:
   qty=integer(item.get('quantity'),1,99);sku=db.scalar(select(SKU).where(SKU.id==identifier(item.get('sku_id'))).with_for_update());require(sku and sku.id not in seen,'规格无效或重复');seen.add(sku.id);p=db.get(Product,sku.product_id);require(p.active,'商品已下架');result=db.execute(update(SKU).where(SKU.id==sku.id,SKU.stock>=qty).values(stock=SKU.stock-qty));require(result.rowcount==1,'库存不足',409);amount+=sku.price_fen*qty;items.append((sku,p,qty))
 require(0<amount<100000000,'订单金额异常');coupon=None
 if data.get('coupon_id'):
  coupon=db.scalar(select(Coupon).where(Coupon.id==identifier(data['coupon_id'])).with_for_update());require(coupon and coupon.owner_id==user.id and not coupon.used_order_id and coupon.expires_at>=now() and amount>=coupon.minimum_fen,'礼券无效');amount=max(1,amount-coupon.discount_fen)
 o=Order(id=uid(),number='LH'+datetime.datetime.now().strftime('%Y%m%d')+secrets.token_hex(4).upper(),request_id=request_id,owner_id=user.id,kind=kind,design_id=d.id if d else None,amount_fen=amount,shipping=shipping_data(data.get('shipping')),options=clean_options,state='pending_payment',progress=0,trace_token=secrets.token_urlsafe(24),expires_at=now()+1800);db.add(o);db.flush()
 for sku,p,qty in items:db.add(OrderItem(order_id=o.id,sku_id=sku.id,title=p.title+' · '+sku.label,quantity=qty,price_fen=sku.price_fen))
 if coupon:coupon.used_order_id=o.id
 audit(db,user.id,'order.create',o.id,{'amount_fen':amount});db.flush();return o
def pay_order(db,o,provider,tx,amount):
 require(provider in ['mock','wechat','alipay'] and isinstance(tx,str) and 1<=len(tx)<=128,'支付凭据无效',400);require(type(amount) is int and amount>0,'支付金额格式无效',400);require(not o.options.get('_payment_provider') or o.options['_payment_provider']==provider,'支付渠道与订单不一致',409)
 prior=db.scalar(select(Payment).where(Payment.order_id==o.id))
 if prior:
  require(prior.provider==provider and prior.provider_tx==tx and prior.amount_fen==amount,'支付凭据冲突',409);return o
 require(o.state=='pending_payment' and (o.expires_at>=now() or provider in ['wechat','alipay']),'订单已取消、过期或已处理',409);require(amount==o.amount_fen,'支付金额不一致',409);require(not db.scalar(select(Payment).where(Payment.provider_tx==tx)),'支付凭据已经使用',409)
 db.add(Payment(order_id=o.id,provider=provider,provider_tx=tx,amount_fen=amount));o.state='awaiting_artisan' if o.kind=='custom' else 'ready_to_ship';chain.append(db,o.id,'ORDER_PAID',{'design_id':o.design_id,'amount_fen':amount,'provider':provider});audit(db,o.owner_id,'order.pay',o.id,{'provider':provider});db.flush();return o
def artisan_profile(db,user):
 p=db.scalar(select(Embroiderer).where(Embroiderer.user_id==user.id));require(user.role=='artisan' and p and p.approved,'请使用已通过审核的绣娘账号',403);return p
def claim_order(db,user,ident):
 p=artisan_profile(db,user);o=db.scalar(select(Order).where(Order.id==ident).with_for_update());require(o and o.kind=='custom' and o.state=='awaiting_artisan' and o.artisan_id is None,'订单已被接走或不可接单',409);require(not db.scalar(select(Refund).where(Refund.order_id==o.id,Refund.state.in_(['pending','processing']))),'售后处理中，暂不能接单',409);active=db.scalar(select(func.count()).select_from(Order).where(Order.artisan_id==p.id,Order.state=='in_production'));require(active<p.capacity,'已达到同时制作数量上限',409)
 result=db.execute(update(Order).where(Order.id==o.id,Order.state=='awaiting_artisan',Order.artisan_id.is_(None)).values(artisan_id=p.id,state='in_production'));require(result.rowcount==1,'订单已被接走',409);db.refresh(o);chain.append(db,o.id,'ARTISAN_ACCEPTED',{'artisan_id':p.id,'design_id':o.design_id});return o
def advance_order(db,user,ident,data):
 p=artisan_profile(db,user);o=get_order(db,ident,user,True);require(o.artisan_id==p.id and o.state=='in_production','此订单不可上报生产节点',409);require(not db.scalar(select(Refund).where(Refund.order_id==o.id,Refund.state.in_(['pending','processing']))),'售后处理中，暂停制作记录',409);step=integer(data.get('step'),1,4);require(step==o.progress+1,'制作节点必须按开针、换色、收针、质检顺序提交',409);note=text(data.get('note'),1000);photo=None
 if data.get('photo_id'):
  photo=db.get(Media,identifier(data['photo_id']));require(photo and photo.owner_id==user.id and verify_media(photo),'节点照片无效')
 if step==4:require(data.get('passed') is True,'请确认质检通过')
 digest=photo.digest if photo else '';tx=chain.append(db,o.id,'PRODUCTION_'+str(step),{'step':STEPS[step-1],'note':note,'photo_hash':digest,'artisan_id':p.id});db.add(ProductionNode(order_id=o.id,artisan_id=p.id,step=step,note=note,photo_id=photo.id if photo else None,photo_hash=digest,tx_hash=tx));o.progress=step
 if step==4:o.state='ready_to_ship'
 db.flush();return o
def ship_order(db,user,ident,data):
 o=get_order(db,ident,user,True);require(user.role=='admin' or (user.role=='artisan' and artisan_profile(db,user).id==o.artisan_id),'无发货权限',403);require(o.state=='ready_to_ship','尚未达到发货条件',409);require(not db.scalar(select(Refund).where(Refund.order_id==o.id,Refund.state.in_(['pending','processing']))),'请先处理售后',409);o.carrier=text(data.get('carrier'),80);o.tracking=text(data.get('tracking'),100);o.state='shipped';chain.append(db,o.id,'SHIPPED',{'carrier':o.carrier,'tracking_hash':sha(o.tracking)});return o
def receive_order(db,user,ident):
 o=get_order(db,ident,user);require(o.owner_id==user.id and o.state=='shipped','只能确认自己已发货的订单',409);require(not db.scalar(select(Refund).where(Refund.order_id==o.id,Refund.state.in_(['pending','processing']))),'请先处理售后',409);o.state='completed';chain.append(db,o.id,'RECEIVED',{'order':o.number})
 if o.artisan_id and not db.scalar(select(Earnings).where(Earnings.order_id==o.id)):db.add(Earnings(artisan_id=o.artisan_id,order_id=o.id,amount_fen=o.amount_fen*85//100,state='recorded'))
 return o
