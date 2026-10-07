from .game_patterns import new_deck,card_info,revealed_cards
import io,os,json,re,secrets,hashlib,datetime,logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI,Request,Response,Depends,HTTPException,UploadFile,File
from fastapi.responses import FileResponse,JSONResponse,PlainTextResponse,StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware
from sqlalchemy import select,func,update,delete
from sqlalchemy.exc import IntegrityError
from .config import *
from .db import Base,engine,Session,get_db
from .models import *
from .security import current_user,password_hash,verify_password,issue_session,digest_token,role,SAFE_USER,visitor_address
from .domain import *
from .media import save_image,media_path,verify_media
from .chain import chain,LOCK,sha
from . import ai,payments
from .limits import production_limits,RequestSizeLimitMiddleware

@asynccontextmanager
async def lifespan(app):
 Base.metadata.create_all(engine)
 from .seed import bootstrap
 bootstrap();app.state.redis=None
 if os.getenv('REDIS_URL'):
  import redis
  app.state.redis=redis.Redis.from_url(os.environ['REDIS_URL'],socket_connect_timeout=3,socket_timeout=3);app.state.redis.ping()
 ai.start_worker()
 yield
 ai.stop_models()
 if app.state.redis:app.state.redis.close()
app=FastAPI(title='梨花季独立平台 API',version='2.1.0',lifespan=lifespan,docs_url=None,redoc_url=None)
app.add_middleware(RequestSizeLimitMiddleware)
if PRODUCTION:app.add_middleware(GZipMiddleware,minimum_size=1024,compresslevel=4)
@app.middleware('http')
async def protect(request,call_next):
 origin=request.headers.get('origin')
 if request.method not in ['GET','HEAD','OPTIONS'] and origin and origin!=str(request.base_url).rstrip('/') and origin!=PUBLIC_URL:return JSONResponse({'detail':'来源校验失败'},status_code=403)
 try:r=await call_next(request)
 except IntegrityError:return JSONResponse({'detail':'记录冲突，请刷新后重试'},status_code=409)
 r.headers['X-Content-Type-Options']='nosniff';r.headers['Referrer-Policy']='same-origin';r.headers['Permissions-Policy']='camera=(self), microphone=(), geolocation=()'
 r.headers['Content-Security-Policy']="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'"
 if request.url.path.startswith('/api/'):
  r.headers['Cache-Control']='no-store';r.headers['X-Robots-Tag']='noindex, nofollow'
 if r.status_code>=400 or request.url.path in ('/docs','/face.html'):r.headers['X-Robots-Tag']='noindex'
 return r
@app.exception_handler(ValueError)
async def value_error(request,err):return JSONResponse({'detail':'参数格式不正确'},status_code=422)
@app.get('/api/health')
def health(db=Depends(get_db)):
 db.execute(select(1));return {'ok':True,'version':'2.1.0','database':'postgresql' if engine.dialect.name=='postgresql' else 'sqlite','payment_mode':PAYMENT_MODE,'demo':DEMO}
@app.get('/api/config')
def config():return {'demo':DEMO,'payment_mode':PAYMENT_MODE,'ai':{'diffusion':AI_MODEL.is_file() and AI_EXEC.is_file(),'controlnet':CONTROL_MODEL.is_file() and CONTROL_MODEL.stat().st_size>700000000,'fine_tuned':False},'ar':'MindAR图像跟踪 + MediaPipe人脸 + WebXR兼容设备平面','chain':'四逻辑节点模拟链','public_url':PUBLIC_URL}
@app.post('/api/auth/register',status_code=201)
def register(data:dict,response:Response,request:Request,db=Depends(get_db)):
 username=data.get('username','');require(isinstance(username,str) and SAFE_USER.fullmatch(username),'账号须为4至80个字母、数字或._@-');name=text(data.get('name'),40);require(data.get('consent') is True,'请同意本地隐私与使用说明');role_name=data.get('role','customer');require(role_name in ['customer','artisan'],'不能申请此角色')
 production_limits(db,('register:'+visitor_address(request),5,3600));password=password_hash(data.get('password'))
 with LOCK:
  require(not db.scalar(select(User).where(User.username==username.lower())),'账号已存在',409);u=User(username=username.lower(),name=name,password_hash=password,role=role_name);db.add(u);db.flush()
  if role_name=='artisan':db.add(Embroiderer(user_id=u.id,skills=['直线针'],bio='待完善个人档案',approved=False))
  csrf=issue_session(db,u,response);audit(db,u.id,'auth.register',u.id);db.commit();return {'user':serialize(u,('password_hash',)),'csrf':csrf}
@app.post('/api/auth/login')
def login(data:dict,request:Request,response:Response,db=Depends(get_db)):
 production_limits(db,('login:'+visitor_address(request),30,900))
 username=str(data.get('username','')).lower();key=sha([visitor_address(request),username]);attempt=db.get(LoginAttempt,key)
 if attempt and attempt.until>now() and attempt.count>=8:raise HTTPException(429,'尝试过于频繁，请15分钟后再试')
 u=db.scalar(select(User).where(User.username==username));valid=u and u.active and verify_password(data.get('password'),u.password_hash)
 if not valid:
  if not attempt:attempt=LoginAttempt(key=key,count=0,until=now()+900);db.add(attempt)
  if attempt.until<now():attempt.count=0;attempt.until=now()+900
  attempt.count+=1;db.commit();raise HTTPException(401,'账号或密码不正确')
 if attempt:db.delete(attempt)
 csrf=issue_session(db,u,response);audit(db,u.id,'auth.login',u.id);db.commit();return {'user':serialize(u,('password_hash',)),'csrf':csrf}
@app.get('/api/auth/me')
def me(request:Request,user=Depends(current_user),db=Depends(get_db)):
 return {'user':serialize(user,('password_hash',)),'csrf':request.state.auth_session.csrf,'artisan':serialize(db.scalar(select(Embroiderer).where(Embroiderer.user_id==user.id))) if user.role=='artisan' else None}
@app.post('/api/auth/logout')
def logout(request:Request,response:Response,user=Depends(current_user),db=Depends(get_db)):
 db.delete(request.state.auth_session);db.commit();response.delete_cookie('lihua_auth',path='/');return {'ok':True}
@app.post('/api/auth/password')
def change_password(data:dict,user=Depends(current_user),db=Depends(get_db)):
 require(verify_password(data.get('old_password'),user.password_hash),'原密码不正确',403);user.password_hash=password_hash(data.get('new_password'));db.execute(delete(AuthSession).where(AuthSession.user_id==user.id));db.commit();return {'ok':True,'message':'密码已修改，请重新登录'}
@app.post('/api/media',status_code=201)
async def upload(file:UploadFile=File(...),user=Depends(current_user),db=Depends(get_db)):
 production_limits(db,('upload:'+user.id,30,3600),('upload-global',500,86400))
 raw=await file.read(8*1024*1024+1);m=save_image(db,raw,user.id);db.commit();return serialize(m,('filename','owner_id'))
@app.get('/api/media/{ident}')
def get_media(ident:str,request:Request,db=Depends(get_db)):
 m=db.get(Media,ident);require(m,'图片不存在',404);published=db.scalar(select(CommunityPost).where(CommunityPost.media_id==ident,CommunityPost.state=='approved',CommunityPost.consent.is_(True)))
 if not m.public and not published:
  u=current_user(request,db);permitted=u.id==m.owner_id or u.role=='admin'
  if not permitted and u.role=='artisan':
   profile=db.scalar(select(Embroiderer).where(Embroiderer.user_id==u.id));permitted=bool(profile and db.scalar(select(Order).join(Design,Order.design_id==Design.id).where(Order.artisan_id==profile.id,(Design.source_media_id==ident)|(Design.result_media_id==ident))))
  if not permitted:permitted=bool(db.scalar(select(ProductionNode).join(Order,ProductionNode.order_id==Order.id).where(ProductionNode.photo_id==ident,Order.owner_id==u.id)))
  require(permitted,'无权读取此图片',403)
 require(verify_media(m),'图片缺失或摘要不匹配',409);return FileResponse(media_path(m),media_type=m.mime)
@app.post('/api/designs',status_code=202)
def create_design(data:dict,user=Depends(current_user),db=Depends(get_db)):
 source=db.get(Media,identifier(data.get('source_media_id')));require(source and source.owner_id==user.id and verify_media(source),'请选择自己上传的照片');require(data.get('rights_consent') is True,'请确认拥有素材的使用授权');mode=data.get('mode','photo');require(mode in ['photo','diffusion','controlnet'],'生成模式不正确');title=text(data.get('title'),120);spec=data.get('spec',{});require(isinstance(spec,dict),'工艺参数错误');size=integer(spec.get('size_mm',160),80,500);colors=integer(spec.get('colors',8),3,16);spacing=spec.get('spacing_mm',.5);require(type(spacing) in [float,int] and .3<=spacing<=2,'线距应为0.3至2mm');seed=integer(data.get('seed',42),0,99999999);prompt=str(data.get('prompt',''))[:1200]
 request_id=text(data['request_id'],100) if 'request_id' in data else None;request_hash=sha({'source_media_id':source.id,'mode':mode,'spec':{'size_mm':size,'colors':colors,'spacing_mm':float(spacing)},'prompt':prompt,'title':title,'seed':seed,'reference_id':data.get('reference_id')})
 provenance={'upload_authorization':True,'source_digest':source.digest,'mode':mode}
 if data.get('reference_id'):
  from PIL import Image,ImageOps,ImageChops
  catalog=[r for kind in ('basic','archive') for r in json.loads((LEGACY/kind/'catalog.json').read_text(encoding='utf-8'))];ref=next((r for r in catalog if r['id']==data['reference_id']),None);require(ref,'参考素材不存在');expected=ImageOps.exif_transpose(Image.open(LEGACY/ref['image'])).convert('RGB');expected.thumbnail((1600,1600));actual=Image.open(media_path(source));require(expected.size==actual.size and ImageChops.difference(expected,actual).getbbox() is None,'参考素材与上传图片不一致');provenance.update({'reference_id':ref['id'],'author':ref.get('author'),'license':ref.get('license'),'license_url':ref.get('licenseUrl'),'source_url':ref.get('sourceUrl')})
 with LOCK:
  if request_id:
   prior=db.scalar(select(AIJob).where(AIJob.owner_id==user.id,AIJob.metadata_json['client_request_id'].as_string()==request_id))
   if prior:
    require(prior.metadata_json.get('client_request_hash')==request_hash,'同一提交编号对应的创作参数已变化，请重新提交',409);return {'design_id':prior.design_id,'job_id':prior.id}
  count=db.scalar(select(func.count()).select_from(AIJob).where(AIJob.owner_id==user.id,AIJob.state.in_(['queued','running'])));require(count<2,'每个用户最多同时排队两份绣稿',429)
  total=db.scalar(select(func.count()).select_from(AIJob).where(AIJob.state.in_(['queued','running'])));require(total<64,'生成队列已满，请稍后再试',429)
  production_limits(db,('generation:'+user.id,20,86400),('generation-global',100,86400))
  d=Design(owner_id=user.id,title=title,source_media_id=source.id,spec={'size_mm':size,'colors':colors,'spacing_mm':spacing},provenance=provenance,state='queued');db.add(d);db.flush();job=AIJob(owner_id=user.id,design_id=d.id,mode=mode,prompt=prompt,seed=seed,metadata_json={'attempt':1,**({'client_request_id':request_id,'client_request_hash':request_hash} if request_id else {})});db.add(job);db.flush();db.commit();ai.enqueue(job.id);return {'design_id':d.id,'job_id':job.id}
@app.get('/api/jobs/{ident}')
def job_status(ident:str,user=Depends(current_user),db=Depends(get_db)):
 job=db.get(AIJob,ident);require(job and (job.owner_id==user.id or user.role=='admin'),'任务不存在',404);return serialize(job)
@app.post('/api/jobs/{ident}/cancel')
def job_cancel(ident:str,user=Depends(current_user),db=Depends(get_db)):
 job=db.get(AIJob,ident);require(job and job.owner_id==user.id,'任务不存在',404)
 if job.state in ['queued','running']:job.state='cancelled';db.get(Design,job.design_id).state='cancelled';db.commit();ai.cancel(ident)
 return {'state':job.state}
@app.post('/api/jobs/{ident}/retry',status_code=202)
def job_retry(ident:str,user=Depends(current_user),db=Depends(get_db)):
 with LOCK:
  job=db.scalar(select(AIJob).where(AIJob.id==ident).with_for_update());require(job and job.owner_id==user.id,'任务不存在',404);require(job.state in ['error','cancelled'],'只有失败或取消的任务可以重试',409);require(ident not in getattr(ai,'active_jobs',set()),'上一任务仍在停止，请稍后重试',409)
  process=ai.processes.get(ident);require(not process or process.poll() is not None,'上一任务仍在停止，请稍后重试',409)
  d=db.get(Design,job.design_id);source=db.get(Media,d.source_media_id) if d else None;require(d and d.owner_id==user.id and source and source.owner_id==user.id and verify_media(source),'原照片缺失或摘要变化，请重新上传创作',409)
  count=db.scalar(select(func.count()).select_from(AIJob).where(AIJob.owner_id==user.id,AIJob.state.in_(['queued','running'])));require(count<2,'每个用户最多同时排队两份绣稿',429)
  total=db.scalar(select(func.count()).select_from(AIJob).where(AIJob.state.in_(['queued','running'])));require(total<64,'生成队列已满，请稍后再试',429)
  production_limits(db,('generation:'+user.id,20,86400),('generation-global',100,86400))
  metadata=dict(job.metadata_json) if isinstance(job.metadata_json,dict) else {};attempt=metadata.get('attempt',1);attempt=attempt if type(attempt) is int and attempt>=1 else 1;history=metadata.get('retry_history',[]);history=history if isinstance(history,list) else []
  history=[*history,{'state':job.state,'error':job.error,'finished_at':job.finished_at,'retried_at':now()}][-10:];job.metadata_json={**metadata,'last_error':job.error or metadata.get('last_error',''),'attempt':attempt+1,'retry_history':history};job.state='queued';job.progress=0;job.error='';job.finished_at=None;d.state='queued';db.commit();result={'job_id':job.id,'design_id':d.id,'state':'queued'}
 ai.enqueue(ident);return result
@app.get('/api/designs')
def designs(user=Depends(current_user),db=Depends(get_db)):
 return [serialize(d,('svg',)) for d in db.scalars(select(Design).where(Design.owner_id==user.id).order_by(Design.created_at.desc()))]
@app.get('/api/designs/{ident}')
def design_detail(ident:str,user=Depends(current_user),db=Depends(get_db)):
 d=db.get(Design,ident);require(d,'绣稿不存在',404);allowed=d.owner_id==user.id or user.role=='admin'
 if user.role=='artisan':
  profile=db.scalar(select(Embroiderer).where(Embroiderer.user_id==user.id));allowed=bool(profile and db.scalar(select(Order).where(Order.design_id==ident,Order.artisan_id==profile.id)))
 require(allowed,'无权读取此绣稿',403);record=db.scalar(select(CopyrightRecord).where(CopyrightRecord.design_id==ident));return {**serialize(d),'copyright':serialize(record) if record else None,'integrity':not record or (design_hash(d,db)==record.design_hash and rights_match(d,record,db)),'job_id':db.scalar(select(AIJob.id).where(AIJob.design_id==ident))}
@app.post('/api/designs/{ident}/rights')
def rights(ident:str,user=Depends(current_user),db=Depends(get_db)):
 with LOCK:
  d=db.get(Design,ident);require(d and d.owner_id==user.id,'绣稿不存在',404);record=register_rights(db,d);db.commit();return serialize(record)
@app.get('/api/copyrights')
def copyrights(user=Depends(current_user),db=Depends(get_db)):return [serialize(x) for x in db.scalars(select(CopyrightRecord).where(CopyrightRecord.owner_id==user.id))]
@app.get('/api/products')
def products(db=Depends(get_db)):
 return [{**serialize(p),'skus':[serialize(x) for x in db.scalars(select(SKU).where(SKU.product_id==p.id))]} for p in db.scalars(select(Product).where(Product.active.is_(True)))]
@app.get('/api/tryon/catalog')
def tryon_catalog(db=Depends(get_db)):
 from .tryon_catalog import enrich
 return [enrich(p) for p in products(db)]
@app.get('/api/cart')
def cart(user=Depends(current_user),db=Depends(get_db)):
 c=db.get(Cart,user.id);return c.items if c else []
@app.put('/api/cart')
def put_cart(data:dict,user=Depends(current_user),db=Depends(get_db)):
 items=object_list(data.get('items'));require(len(items)<=30,'购物车无效');seen=set();clean=[]
 for item in items:
  sku=db.get(SKU,identifier(item.get('sku_id')));require(sku and sku.id not in seen and db.get(Product,sku.product_id).active,'规格重复或已下架');seen.add(sku.id);clean.append({'sku_id':sku.id,'quantity':integer(item.get('quantity'),1,99)})
 c=db.get(Cart,user.id)
 if not c:c=Cart(owner_id=user.id);db.add(c)
 c.items=clean;db.commit();return clean
@app.get('/api/coupons')
def coupons(user=Depends(current_user),db=Depends(get_db)):return [serialize(c) for c in db.scalars(select(Coupon).where(Coupon.owner_id==user.id))]
@app.post('/api/orders',status_code=201)
def place_order(data:dict,user=Depends(current_user),db=Depends(get_db)):
 require(PAYMENT_MODE!='disabled','收款尚未启用，商城目前仅供浏览，请稍后下单',409)
 with LOCK:o=create_order(db,user,data);db.commit();return order_view(o,db)
@app.get('/api/orders')
def orders(user=Depends(current_user),db=Depends(get_db)):
 with LOCK:expire_orders(db);db.commit()
 return [order_view(o,db) for o in db.scalars(select(Order).where(Order.owner_id==user.id).order_by(Order.created_at.desc()))]
@app.get('/api/orders/{ident}')
def order_detail(ident:str,user=Depends(current_user),db=Depends(get_db)):return order_view(get_order(db,ident,user,True),db)
@app.post('/api/orders/{ident}/cancel')
def cancel_order(ident:str,user=Depends(current_user),db=Depends(get_db)):
 with LOCK:
  o=get_order(db,ident,user);require(o.owner_id==user.id,'只能取消自己的订单',403);require(o.state=='pending_payment','订单不能取消',409);provider=o.options.get('_payment_provider')
  if PAYMENT_MODE=='live' and provider:
   paid=payments.close_or_query(o,provider)
   if paid:pay_order(db,o,provider,paid[0],paid[1]);db.commit();return {**order_view(o,db),'notice':'渠道已确认付款，需走售后流程'}
  cancel_pending(db,o);db.commit();return order_view(o,db)
@app.post('/api/orders/{ident}/pay-demo')
def pay_demo(ident:str,user=Depends(current_user),db=Depends(get_db)):
 require(PAYMENT_MODE=='mock' and DEMO,'模拟支付未启用',403)
 with LOCK:o=get_order(db,ident,user);require(o.owner_id==user.id,'只能支付自己的订单',403);pay_order(db,o,'mock','mock:'+o.id,o.amount_fen);db.commit();return {**order_view(o,db),'notice':'演示收款，不会扣除真实资金'}
@app.post('/api/orders/{ident}/prepay')
def prepay(ident:str,data:dict,user=Depends(current_user),db=Depends(get_db)):
 production_limits(db,('prepay:'+user.id,10,60))
 with LOCK:
  o=get_order(db,ident,user);require(o.owner_id==user.id and o.state=='pending_payment' and o.expires_at>=now(),'订单不可支付',409);provider=data.get('provider');require(provider in ['wechat','alipay'],'支付渠道无效');require(PAYMENT_MODE=='live','真实支付通道未启用',409);require(not o.options.get('_payment_provider') or o.options['_payment_provider']==provider,'该订单已选择另一渠道，请勿重复付款',409)
  payments.ensure_channel_ready(provider)
  expiry={'_payment_expires_at':o.expires_at} if provider=='alipay' and not o.options.get('_payment_provider') else {}
  o.options={**o.options,**expiry,'_payment_provider':provider};db.commit()
  return payments.prepay(o,provider,mobile=data.get('mobile') is True)
@app.post('/api/orders/{ident}/payment-status')
def payment_status(ident:str,user=Depends(current_user),db=Depends(get_db)):
 require(PAYMENT_MODE=='live','真实支付通道未启用',409)
 production_limits(db,('payment-query:'+user.id,18,60))
 with LOCK:
  o=get_order(db,ident,user);require(o.owner_id==user.id,'只能核对自己的付款',403)
  if o.state!='pending_payment':return order_view(o,db)
  provider=o.options.get('_payment_provider');require(provider in ['wechat','alipay'],'请先选择支付方式',409)
  result=payments.query_order(o,provider)
  if result['state']=='paid':pay_order(db,o,provider,result['tx'],result['amount'])
  elif result['state']=='closed':cancel_pending(db,o)
  db.commit();return {**order_view(o,db),'notice':'支付平台尚未确认到账，请勿重复付款；稍后可再次核对' if result['state'] in ['pending','unknown'] else ''}
@app.post('/api/payments/{provider}/notify')
async def payment_notify(provider:str,request:Request,db=Depends(get_db)):
 require(PAYMENT_MODE=='live','真实支付通道未启用',403)
 if provider=='wechat':
  try:body=(await request.body()).decode('utf-8')
  except UnicodeError:raise HTTPException(400,'支付通知编码无效')
  number,tx,amount=payments.parse_wechat(request.headers,body)
 elif provider=='alipay':number,tx,amount=payments.parse_alipay(dict(await request.form()))
 else:raise HTTPException(404,'未知支付渠道')
 with LOCK:
  o=db.scalar(select(Order).where(Order.number==number).with_for_update());require(o,'商户订单不存在',404);pay_order(db,o,provider,tx,amount);db.commit()
 return PlainTextResponse('success') if provider=='alipay' else {'code':'SUCCESS','message':'成功'}
@app.post('/api/orders/{ident}/receive')
def receive(ident:str,user=Depends(current_user),db=Depends(get_db)):
 with LOCK:o=receive_order(db,user,ident);db.commit();return order_view(o,db)
@app.post('/api/orders/{ident}/refund')
def request_refund(ident:str,data:dict,user=Depends(current_user),db=Depends(get_db)):
 with LOCK:
  o=get_order(db,ident,user);require(o.owner_id==user.id and o.state in ['awaiting_artisan','in_production','ready_to_ship','shipped','completed'],'订单不可申请售后',409);require(not db.scalar(select(Refund).where(Refund.order_id==ident)),'已经申请过售后',409);row=Refund(order_id=ident,owner_id=user.id,reason=text(data.get('reason'),1000));db.add(row);db.commit();return serialize(row)
@app.get('/api/refunds')
def refunds(user=Depends(current_user),db=Depends(get_db)):return [serialize(x) for x in db.scalars(select(Refund).where(Refund.owner_id==user.id))]
@app.get('/api/artisans')
def artisans(db=Depends(get_db)):
 return [{**serialize(p),'name':db.get(User,p.user_id).name} for p in db.scalars(select(Embroiderer).where(Embroiderer.approved.is_(True)))]
@app.put('/api/artisan/profile')
def update_artisan(data:dict,user=Depends(current_user),db=Depends(get_db)):
 role(user,'artisan');p=db.scalar(select(Embroiderer).where(Embroiderer.user_id==user.id));p.bio=text(data.get('bio'),1000);p.region=text(data.get('region'),80);skills=data.get('skills');require(isinstance(skills,list) and 1<=len(skills)<=12 and all(isinstance(x,str) and 1<=len(x)<=20 for x in skills),'针法技能无效');p.skills=skills;db.commit();return serialize(p)
@app.get('/api/artisan/orders')
def artisan_orders(user=Depends(current_user),db=Depends(get_db)):
 p=artisan_profile(db,user);return {'available':[{'id':o.id,'number':o.number,'amount_fen':o.amount_fen,'design_title':db.get(Design,o.design_id).title,'options':o.options} for o in db.scalars(select(Order).where(Order.state=='awaiting_artisan',~select(Refund.id).where(Refund.order_id==Order.id,Refund.state.in_(['pending','processing'])).exists()))],'mine':[order_view(o,db) for o in db.scalars(select(Order).where(Order.artisan_id==p.id))]}
@app.post('/api/artisan/orders/{ident}/claim')
def claim(ident:str,user=Depends(current_user),db=Depends(get_db)):
 with LOCK:o=claim_order(db,user,ident);db.commit();return order_view(o,db)
@app.post('/api/artisan/orders/{ident}/nodes')
def production(ident:str,data:dict,user=Depends(current_user),db=Depends(get_db)):
 with LOCK:o=advance_order(db,user,ident,data);db.commit();return order_view(o,db)
@app.post('/api/orders/{ident}/ship')
def ship(ident:str,data:dict,user=Depends(current_user),db=Depends(get_db)):
 with LOCK:o=ship_order(db,user,ident,data);db.commit();return order_view(o,db)
@app.get('/api/artisan/earnings')
def earnings(user=Depends(current_user),db=Depends(get_db)):
 p=artisan_profile(db,user);rows=[serialize(x) for x in db.scalars(select(Earnings).where(Earnings.artisan_id==p.id))];return {'rows':rows,'total_fen':sum(x['amount_fen'] for x in rows if x['state']=='recorded'),'notice':'已完成订单的85%计为制作收益台账；不是银行余额或自动提现。'}
@app.get('/api/public/trace/{token}')
def public_trace(token:str,db=Depends(get_db)):
 o=db.scalar(select(Order).where(Order.trace_token==token));require(o and db.scalar(select(Payment.id).where(Payment.order_id==o.id)),'溯源码不存在或订单尚未支付',404);d=db.get(Design,o.design_id) if o.design_id else None;record=db.scalar(select(CopyrightRecord).where(CopyrightRecord.design_id==o.design_id)) if d else None;p=db.get(Embroiderer,o.artisan_id) if o.artisan_id else None;nodes=list(db.scalars(select(ProductionNode).where(ProductionNode.order_id==o.id).order_by(ProductionNode.step)));integrity=chain.verify(db)
 blocks={b.digest:b for b in db.scalars(select(ChainBlock).where(ChainBlock.entity==o.id))};production_blocks=[b for b in blocks.values() if b.event.startswith('PRODUCTION_')];nodes_match=len(production_blocks)==len(nodes)==o.progress
 for n in nodes:
  b=blocks.get(n.tx_hash);nodes_match=nodes_match and bool(b and b.event=='PRODUCTION_'+str(n.step) and b.payload=={'step':STEPS[n.step-1],'note':n.note,'photo_hash':n.photo_hash,'artisan_id':n.artisan_id})
 source_ok=bool(d and verify_media(db.get(Media,d.source_media_id)));design_ok=bool(d and record and design_hash(d,db)==record.design_hash);photos_ok=all(not n.photo_id or verify_media(db.get(Media,n.photo_id)) for n in nodes)
 return {'number':o.number,'state':o.state,'kind':o.kind,'title':d.title if d else '梨花季周边商品','copyright_tx':record.tx_hash if record else None,'artisan':{'name':db.get(User,p.user_id).name,'region':p.region,'skills':p.skills} if p else None,'nodes':[{'step':STEPS[n.step-1],'note':n.note,'time':n.created_at,'photo_hash':n.photo_hash,'photo_available':verify_media(db.get(Media,n.photo_id)) if n.photo_id else None,'tx_hash':n.tx_hash} for n in nodes],'integrity':{'chain':integrity['ok'],'source_available':source_ok if d else None,'design_matches':design_ok if d else None,'rights_match':rights_match(d,record,db) if d else None,'node_photos':photos_ok,'nodes_match':nodes_match,'result_available':verify_media(db.get(Media,d.result_media_id)) if d and d.result_media_id else None},'notice':'模拟链溯源，仅披露制作记录，不公开顾客姓名、地址、电话或私人原图。'}
@app.get('/api/orders/{ident}/qr')
def trace_qr(ident:str,user=Depends(current_user),db=Depends(get_db)):
 import qrcode
 o=get_order(db,ident,user,True);img=qrcode.make(PUBLIC_URL+'/#trace/'+o.trace_token);buf=io.BytesIO();img.save(buf,format='PNG');return Response(buf.getvalue(),media_type='image/png')
@app.post('/api/game/start')
def game_start(user=Depends(current_user),db=Depends(get_db)):
 with LOCK:
  existing=db.scalar(select(GameScore).where(GameScore.owner_id==user.id,GameScore.finished.is_(False)))
  if existing:return {'id':existing.id,'cards':len(existing.deck),'matched':existing.matched,'turns':existing.turns,'opened':existing.opened,'opened_value':existing.deck[existing.opened] if existing.opened is not None else None,'revealed':revealed_cards(existing)}
  values=new_deck();g=GameScore(owner_id=user.id,deck=values);db.add(g);db.flush();db.commit();return {'id':g.id,'cards':12,'matched':[],'turns':0}
@app.post('/api/game/{ident}/flip')
def game_flip(ident:str,data:dict,user=Depends(current_user),db=Depends(get_db)):
 with LOCK:
  g=db.scalar(select(GameScore).where(GameScore.id==ident).with_for_update());require(g and g.owner_id==user.id and not g.finished,'游戏不存在或已经结束',409);i=integer(data.get('index'),0,len(g.deck)-1);require(i not in g.matched and i!=g.opened,'不能翻开此牌',409);result={'index':i,'value':g.deck[i],'pattern':card_info(g.deck[i]),'matched':False}
  if g.opened is None:g.opened=i
  else:
   other=g.opened;g.opened=None;g.turns+=1;result['other']=other
   if g.deck[other]==g.deck[i]:g.matched=[*g.matched,other,i];result['matched']=True
   if len(g.matched)==len(g.deck):
    g.finished=True;g.score=max(10,100-(g.turns-6)*4);db.add(Coupon(owner_id=user.id,source_id='game:'+g.id,title='纹样挑战5元演示礼券',discount_fen=500,minimum_fen=5000,expires_at=now()+7*86400));result['reward']='5元演示礼券，满50元可用'
  result.update({'finished':g.finished,'score':g.score,'turns':g.turns,'matched_indexes':g.matched});db.commit();return result
@app.get('/api/game/scores')
def scores(user=Depends(current_user),db=Depends(get_db)):return [serialize(x,('deck',)) for x in db.scalars(select(GameScore).where(GameScore.owner_id==user.id).order_by(GameScore.created_at.desc()).limit(50))]
@app.get('/api/community')
def community(db=Depends(get_db)):
 return [{**serialize(x),'author':db.get(User,x.owner_id).name} for x in db.scalars(select(CommunityPost).where(CommunityPost.state=='approved').order_by(CommunityPost.created_at.desc()).limit(100))]
@app.get('/api/community/mine')
def my_posts(user=Depends(current_user),db=Depends(get_db)):return [serialize(x) for x in db.scalars(select(CommunityPost).where(CommunityPost.owner_id==user.id).order_by(CommunityPost.created_at.desc()))]
@app.post('/api/community',status_code=201)
def create_post(data:dict,user=Depends(current_user),db=Depends(get_db)):
 production_limits(db,('community:'+user.id,20,86400),('community-global',200,86400))
 require(data.get('consent') is True,'请同意公开展示该内容');media_id=identifier(data.get('media_id'),optional=True);m=db.get(Media,media_id) if media_id else None
 if media_id:require(m and m.owner_id==user.id and verify_media(m),'只能发布自己上传且可校验的图片')
 row=CommunityPost(owner_id=user.id,title=text(data.get('title'),120),body=text(data.get('body'),3000),media_id=media_id,consent=True,state='pending');db.add(row);db.commit();return serialize(row)
@app.delete('/api/community/{ident}')
def remove_post(ident:str,user=Depends(current_user),db=Depends(get_db)):
 row=db.get(CommunityPost,ident);require(row and (row.owner_id==user.id or user.role=='admin'),'帖子不存在',404);row.state='withdrawn';row.consent=False;db.commit();return {'ok':True}
@app.post('/api/learning/complete')
def complete_learning(data:dict,user=Depends(current_user),db=Depends(get_db)):
 lesson=data.get('lesson');require(lesson in ['直线针','套针','滚针'],'课程无效');minutes=integer(data.get('minutes'),1,240);day=datetime.date.today().isoformat();prior=db.scalar(select(LearningRecord).where(LearningRecord.owner_id==user.id,LearningRecord.lesson==lesson,LearningRecord.day==day))
 if not prior:prior=LearningRecord(owner_id=user.id,lesson=lesson,day=day,minutes=minutes);db.add(prior);db.commit()
 return serialize(prior)
@app.get('/api/learning')
def learning(user=Depends(current_user),db=Depends(get_db)):return [serialize(x) for x in db.scalars(select(LearningRecord).where(LearningRecord.owner_id==user.id))]
@app.post('/api/chat')
def chat(data:dict,user=Depends(current_user),db=Depends(get_db)):
 production_limits(db,('chat:'+user.id,40,3600),('chat-global',200,3600))
 try:return ai.chat(data.get('question'))
 except ValueError as err:raise HTTPException(422,str(err))
 except RuntimeError as err:raise HTTPException(503,str(err))
@app.get('/api/admin/summary')
def admin_summary(user=Depends(current_user),db=Depends(get_db)):
 role(user,'admin');return {'counts':{model.__tablename__:db.scalar(select(func.count()).select_from(model)) for model in [User,Embroiderer,Design,Order,CopyrightRecord,CommunityPost,Product]},'chain':chain.verify(db),'payment_mode':PAYMENT_MODE,'demo':DEMO}
@app.get('/api/admin/{section}')
def admin_list(section:str,user=Depends(current_user),db=Depends(get_db)):
 role(user,'admin');models={'users':User,'artisans':Embroiderer,'orders':Order,'posts':CommunityPost,'products':Product,'refunds':Refund,'audit':AuditLog,'jobs':AIJob};model=models.get(section);require(model,'未知后台栏目',404)
 return [serialize(x,('password_hash',)) for x in db.scalars(select(model).limit(500))]
@app.post('/api/admin/users/{ident}')
def admin_user(ident:str,data:dict,user=Depends(current_user),db=Depends(get_db)):
 role(user,'admin');target=db.get(User,ident);require(target,'账号不存在',404);require(ident!=user.id,'不能停用当前管理员');require(type(data.get('active')) is bool,'账号状态无效');target.active=data['active'];db.execute(delete(AuthSession).where(AuthSession.user_id==ident));audit(db,user.id,'user.status',ident,{'active':target.active});db.commit();return serialize(target,('password_hash',))
@app.post('/api/admin/artisans/{ident}/approve')
def approve_artisan(ident:str,data:dict,user=Depends(current_user),db=Depends(get_db)):
 role(user,'admin');p=db.get(Embroiderer,ident);require(p,'绣娘不存在',404);require(type(data.get('approved')) is bool,'审核状态无效');p.approved=data['approved'];audit(db,user.id,'artisan.approve',ident,{'approved':p.approved});db.commit();return serialize(p)
@app.post('/api/admin/posts/{ident}/moderate')
def moderate_post(ident:str,data:dict,user=Depends(current_user),db=Depends(get_db)):
 role(user,'admin');p=db.get(CommunityPost,ident);require(p and p.state!='withdrawn','帖子不存在或已撤回',404);state=data.get('state');require(state in ['approved','rejected'],'审核状态无效');p.state=state;p.moderation_note=text(data.get('note','审核通过'),500);audit(db,user.id,'post.moderate',ident,{'state':state});db.commit();return serialize(p)
@app.get('/api/admin/products/{ident}/skus')
def admin_product_skus(ident:str,user=Depends(current_user),db=Depends(get_db)):
 role(user,'admin');require(db.get(Product,ident),'商品不存在',404);return [serialize(x) for x in db.scalars(select(SKU).where(SKU.product_id==ident))]
@app.post('/api/admin/products/{ident}')
def edit_product(ident:str,data:dict,user=Depends(current_user),db=Depends(get_db)):
 role(user,'admin')
 with LOCK:
  p=db.scalar(select(Product).where(Product.id==ident).with_for_update());require(p,'商品不存在',404);p.title=text(data.get('title',p.title),160);p.description=text(data.get('description',p.description or '梨花季商品'),10000);active=data.get('active',p.active);require(type(active) is bool,'商品状态无效');p.active=active;seen=set()
  for item in object_list(data.get('skus',[]),limit=3000):
   sku=db.scalar(select(SKU).where(SKU.id==identifier(item.get('id'))).with_for_update());require(sku and sku.product_id==ident and sku.id not in seen,'商品规格无效或重复');seen.add(sku.id);sku.price_fen=integer(item.get('price_fen'),1,100000000);sku.stock=integer(item.get('stock'),0,1000000)
  audit(db,user.id,'product.edit',ident);db.commit();return serialize(p)
@app.post('/api/admin/refunds/{ident}')
def resolve_refund(ident:str,data:dict,user=Depends(current_user),db=Depends(get_db)):
 role(user,'admin')
 with LOCK:
  r=db.scalar(select(Refund).where(Refund.id==ident).with_for_update());require(r and r.state in ['pending','processing'],'售后已处理或不存在',409);o=db.scalar(select(Order).where(Order.id==r.order_id).with_for_update());action=data.get('action');require(action in ['approve','reject','query'],'操作无效');r.note=text(data.get('note'),1000)
  if action=='reject':
   require(r.state=='pending','已提交渠道处理的退款不能直接驳回',409);r.state='rejected'
  else:
   payment=db.scalar(select(Payment).where(Payment.order_id==o.id));require(payment,'支付记录不存在',409)
   if o.state in ['shipped','completed']:require(data.get('returned') is True,'已发货商品须核实退回后处理退款')
   if payment.provider=='mock':outcome='refunded'
   else:
    r.state='processing';db.commit();outcome=payments.refund_order(o,payment,r,query=action=='query')
   r.state=outcome
   if outcome=='refunded':
    for item in db.scalars(select(OrderItem).where(OrderItem.order_id==o.id)):db.execute(update(SKU).where(SKU.id==item.sku_id).values(stock=SKU.stock+item.quantity))
    for c in db.scalars(select(Coupon).where(Coupon.used_order_id==o.id)):c.used_order_id=None
    for e in db.scalars(select(Earnings).where(Earnings.order_id==o.id)):e.state='reversed'
    o.state='refunded';chain.append(db,o.id,'REFUND_SIMULATED' if payment.provider=='mock' else 'REFUND_CONFIRMED',{'amount_fen':o.amount_fen,'provider':payment.provider})
  audit(db,user.id,'refund.resolve',r.id,{'state':r.state});db.commit();return serialize(r)
@app.get('/api/admin/chain/verify')
def verify_chain(user=Depends(current_user),db=Depends(get_db)):
 role(user,'admin');return chain.verify(db)
@app.get('/api/admin/backup/download')
def backup(user=Depends(current_user),db=Depends(get_db)):
 role(user,'admin');tables={table.name:[dict(x) for x in db.execute(table.select()).mappings()] for table in Base.metadata.sorted_tables if table.name not in ['auth_sessions','login_attempts']};return Response(json.dumps({'format':'lihuaji-platform-v2','tables':tables},ensure_ascii=False,default=str),media_type='application/json',headers={'Content-Disposition':'attachment; filename="lihuaji-platform-backup.json"'})
@app.get('/assets/{relative:path}')
def legacy_assets(relative:str):
 require('..' not in Path(relative).parts and chr(92) not in relative,'资源路径无效',404)
 allow=('vendor/','models/','ar-assets/','shop/images/','basic/images/','basic/thumbs/','archive/images/','archive/thumbs/','aigc-examples/')
 exact={'ar-experience.html','ar-experience.js','ar-experience.css','tryon-engine.js','icon.png','basic/catalog.json','archive/catalog.json','engine.js','knowledge.js','ar.js'}
 require(relative in exact or any(relative.startswith(x) for x in allow),'资源不存在',404);path=(LEGACY/relative).resolve();require(path.is_relative_to(LEGACY) and path.is_file(),'资源不存在',404);return FileResponse(path)
@app.get('/docs',include_in_schema=False)
def offline_docs():return FileResponse(ROOT/'web/api-explorer.html')
from .public_pages import router as public_router
app.include_router(public_router)
app.mount('/',StaticFiles(directory=ROOT/'web',html=True),name='web')
