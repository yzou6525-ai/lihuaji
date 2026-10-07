import os
os.environ['EXPORT_SEED_SQL']='0'
import os,tempfile,time,io,uuid,json
from pathlib import Path
os.environ.setdefault('LIHUA_DATA',tempfile.mkdtemp(prefix='lihua-platform-test-'));os.environ['DEMO_MODE']='1';os.environ['APP_ENV']='local'
from fastapi.testclient import TestClient
from PIL import Image,ImageDraw
from backend.app import app
from backend.db import Session
from backend.models import *
from backend.chain import chain,LOCK
from backend.security import verify_password
from sqlalchemy import select,func
import pytest
@pytest.fixture(scope='module')
def server():
 with TestClient(app) as client:yield client

def login(client,name,password='LihuaDemo!2026'):
 r=client.post('/api/auth/login',json={'username':name,'password':password});assert r.status_code==200,r.text;client.headers['X-CSRF-Token']=r.json()['csrf'];return r.json()['user']
def image_bytes():
 im=Image.new('RGB',(256,256),'ivory');d=ImageDraw.Draw(im);d.ellipse((50,35,190,180),fill='#af6160');d.line((120,130,160,235),fill='#337a47',width=10);b=io.BytesIO();im.save(b,'PNG');return b.getvalue()
def upload(client):
 r=client.post('/api/media',files={'file':('flower.png',image_bytes(),'image/png')});assert r.status_code==201,r.text;return r.json()['id']
def make_design(client):
 media=upload(client);r=client.post('/api/designs',json={'source_media_id':media,'title':'闭环验收花卉','mode':'photo','rights_consent':True,'spec':{'size_mm':160,'spacing_mm':.6,'colors':6}});assert r.status_code==202,r.text;job=r.json()
 for _ in range(150):
  state=client.get('/api/jobs/'+job['job_id']).json()
  if state['state'] in ['done','error','cancelled']:break
  time.sleep(.1)
 assert state['state']=='done',state;d=client.get('/api/designs/'+job['design_id']).json();assert d['copyright']['tx_hash'];assert d['integrity'];assert 0<=d['evaluation']['score']<=100;return d

def test_seed_counts_and_chain(server):
 login(server,'admin');v=server.get('/api/admin/summary').json();assert {k:v['counts'][k] for k in ['users','embroiderers','embroidery_designs','orders','copyright_records']}=={'users':20,'embroiderers':15,'embroidery_designs':50,'orders':30,'copyright_records':10};assert v['chain']['ok']

def test_custom_end_to_end_and_privacy(server):
 username='review'+uuid.uuid4().hex[:7];r=server.post('/api/auth/register',json={'username':username,'password':'SecureTest!2026','name':'验收顾客','consent':True});assert r.status_code==201;server.headers['X-CSRF-Token']=r.json()['csrf'];customer=r.json()['user'];d=make_design(server);r=server.post('/api/orders',json={'request_id':str(uuid.uuid4()),'kind':'custom','design_id':d['id'],'options':{'fabric':'真丝'},'shipping':{'name':'测试收件人','phone':'演示，不可拨打','address':'私人地址不得公开'}});assert r.status_code==201,r.text;o=r.json();assert o['state']=='pending_payment';paid=server.post(f"/api/orders/{o['id']}/pay-demo");assert paid.status_code==200,paid.text;assert server.post(f"/api/orders/{o['id']}/pay-demo").status_code==200
 login(server,'user02');assert server.get('/api/orders/'+o['id']).status_code==403;assert server.get('/api/media/'+d['source_media_id']).status_code==403
 login(server,'artisan01');claim=server.post(f"/api/artisan/orders/{o['id']}/claim");assert claim.status_code==200,claim.text;assert server.post(f"/api/artisan/orders/{o['id']}/nodes",json={'step':3,'note':'越序'}).status_code==409
 photo=upload(server)
 for step in range(1,5):
  res=server.post(f"/api/artisan/orders/{o['id']}/nodes",json={'step':step,'note':'实际测试节点 '+str(step),'photo_id':photo if step==1 else None,'passed':True});assert res.status_code==200,res.text
 ship=server.post(f"/api/orders/{o['id']}/ship",json={'carrier':'演示物流','tracking':'DEMO-TEST-001'});assert ship.status_code==200,ship.text
 login(server,username,'SecureTest!2026');assert server.post(f"/api/orders/{o['id']}/receive").status_code==200;qr=server.get(f"/api/orders/{o['id']}/qr");assert qr.headers['content-type']=='image/png'
 trace=server.get('/api/public/trace/'+o['trace_token']);assert trace.status_code==200;assert '私人地址' not in trace.text;assert '测试收件人' not in trace.text;assert trace.json()['integrity']['chain'];assert len(trace.json()['nodes'])==4
 login(server,'artisan01');earn=server.get('/api/artisan/earnings').json();assert any(x['order_id']==o['id'] for x in earn['rows']);login(server,'admin');assert server.get('/api/admin/chain/verify').json()['ok']

def test_account_csrf_and_role_isolation(server):
 login(server,'user01');csrf=server.headers.pop('X-CSRF-Token');assert server.post('/api/game/start').status_code==403;server.headers['X-CSRF-Token']=csrf;assert server.get('/api/admin/users').status_code==403;assert server.post('/api/admin/users/demo-admin',json={'active':False}).status_code==403
 assert server.post('/api/auth/register',json={'username':'rogue-admin','password':'StrongTest!2026','name':'测试','role':'admin','consent':True}).status_code==422

def test_stock_idempotency_and_simulated_refund(server):
 login(server,'user01');products=server.get('/api/products').json();sku=next(s for p in products for s in p['skus'] if s['stock']>3);body={'request_id':uuid.uuid4().hex,'kind':'product','items':[{'sku_id':sku['id'],'quantity':2}],'shipping':{'name':'演示','phone':'演示电话','address':'测试地址'}};r=server.post('/api/orders',json=body);assert r.status_code==201,r.text;o=r.json();assert server.post('/api/orders',json=body).json()['id']==o['id'];assert server.post('/api/orders/'+o['id']+'/pay-demo').status_code==200;rr=server.post('/api/orders/'+o['id']+'/refund',json={'reason':'测试售后'});assert rr.status_code==200;login(server,'admin');ref=server.post('/api/admin/refunds/'+rr.json()['id'],json={'action':'approve','note':'模拟退款已完成'});assert ref.status_code==200,ref.text;assert server.post('/api/admin/refunds/'+rr.json()['id'],json={'action':'approve','note':'重复'}).status_code==409
 with Session() as db:assert db.get(SKU,sku['id']).stock==sku['stock']

def test_game_reward_community_moderation_and_withdraw(server):
 login(server,'user01');g=server.post('/api/game/start').json()
 with Session() as db:deck=db.get(GameScore,g['id']).deck
 pairs={}
 for i,v in enumerate(deck):pairs.setdefault(v,[]).append(i)
 for pair in pairs.values():
  for index in pair:r=server.post('/api/game/'+g['id']+'/flip',json={'index':index});assert r.status_code==200,r.text
 assert r.json()['finished'] and r.json()['score']==100;assert server.post('/api/game/'+g['id']+'/flip',json={'index':0}).status_code==409;assert any(c['source_id']=='game:'+g['id'] for c in server.get('/api/coupons').json())
 media=upload(server);post=server.post('/api/community',json={'title':'AR合拍测试','body':'模拟发布一张经过同意的学习照片。','media_id':media,'consent':True}).json();assert not any(p['id']==post['id'] for p in server.get('/api/community').json());login(server,'admin');assert server.post('/api/admin/posts/'+post['id']+'/moderate',json={'state':'approved','note':'测试审核'}).status_code==200;assert any(p['id']==post['id'] for p in server.get('/api/community').json());login(server,'user01');assert server.delete('/api/community/'+post['id']).status_code==200;assert not any(p['id']==post['id'] for p in server.get('/api/community').json())

def test_learning_and_sewability(server):
 from backend.stitch import stitch_image
 login(server,'user01');body={'lesson':'套针','minutes':15};a=server.post('/api/learning/complete',json=body).json();assert server.post('/api/learning/complete',json=body).json()['id']==a['id'];assert server.post('/api/learning/complete',json={'lesson':'虚构','minutes':15}).status_code==422
 _,_,good=stitch_image(image_bytes(),{'size_mm':160,'spacing_mm':.7,'colors':6});im=Image.new('RGB',(512,512),'white');draw=ImageDraw.Draw(im)
 for x in range(0,512,3):draw.line((x,0,x,512),fill='black')
 b=io.BytesIO();im.save(b,'PNG');_,_,dense=stitch_image(b.getvalue(),{'size_mm':80,'spacing_mm':.3,'colors':16});assert dense['score']<good['score']


def test_trace_detects_missing_files_and_mutated_nodes(server):
 from backend.media import media_path
 login(server,'admin')
 with Session() as db:
  o=db.scalar(select(Order).where(Order.state=='shipped',Order.kind=='custom'));token=o.trace_token;n=db.scalar(select(ProductionNode).where(ProductionNode.order_id==o.id));node_id=n.id;old=n.note;n.note='篡改后的说明';db.commit()
 r=server.get('/api/public/trace/'+token).json();assert r['integrity']['chain'];assert not r['integrity']['nodes_match']
 with Session() as db:
  db.get(ProductionNode,node_id).note=old;d=db.get(Design,o.design_id);m=db.get(Media,d.source_media_id);path=media_path(m);raw=path.read_bytes();path.unlink();db.commit()
 try:
  trace=server.get('/api/public/trace/'+token).json();assert trace['integrity']['chain'];assert not trace['integrity']['source_available'];assert trace['copyright_tx']
 finally:path.write_bytes(raw)
 assert server.get('/api/public/trace/'+token).json()['integrity']['nodes_match']

def test_account_suspend_revokes_sessions_and_admin_routes(server):
 r=server.post('/api/auth/register',json={'username':'revoked'+uuid.uuid4().hex[:6],'password':'SecureTest!2026','name':'会话测试','consent':True});uid=r.json()['user']['id'];cookie=server.cookies.get('lihua_auth')
 login(server,'admin');assert server.post('/api/admin/users/'+uid,json={'active':False}).status_code==200
 with TestClient(app) as c:
  c.cookies.set('lihua_auth',cookie);assert c.get('/api/auth/me').status_code==401;assert c.get('/api/admin/backup/download').status_code==401
 login(server,'user01');assert server.get('/api/admin/summary').status_code==403;assert server.get('/api/admin/products/product-001/skus').status_code==403

def test_reference_attribution_and_mismatch(server):
 from backend.config import LEGACY
 login(server,'user01');catalog=json.loads((LEGACY/'basic/catalog.json').read_text(encoding='utf-8'));ref=catalog[0];r=server.post('/api/media',files={'file':('ref.png',(LEGACY/ref['image']).read_bytes(),'image/png')});source=r.json()['id']
 r=server.post('/api/designs',json={'source_media_id':source,'title':'署名保留测试','mode':'photo','rights_consent':True,'reference_id':ref['id']});assert r.status_code==202,r.text
 ident=r.json()['design_id'];d=server.get('/api/designs/'+ident).json();assert d['provenance']['author']==ref['author'];assert d['provenance']['license']==ref['license'];assert d['job_id']
 wrong=upload(server);r=server.post('/api/designs',json={'source_media_id':wrong,'title':'错误来源','mode':'photo','rights_consent':True,'reference_id':ref['id']});assert r.status_code==422

def test_payment_signatures_amount_and_replay_guards(server,monkeypatch,tmp_path):
 from backend import payments
 from cryptography.hazmat.primitives.asymmetric import rsa
 from cryptography.hazmat.primitives import serialization
 from cryptography.hazmat.primitives.ciphers.aead import AESGCM
 from fastapi import HTTPException
 import base64
 key=rsa.generate_private_key(public_exponent=65537,key_size=2048);pub=tmp_path/'pub.pem';pub.write_bytes(key.public_key().public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo))
 env={'WECHAT_PLATFORM_PUBLIC_KEY_FILE':str(pub),'WECHAT_PLATFORM_KEY_ID':'PUB_KEY_TEST','WECHAT_API_V3_KEY':'0123456789abcdef0123456789abcdef','WECHAT_APP_ID':'app-demo','WECHAT_MCH_ID':'merchant-demo','ALIPAY_PUBLIC_KEY_FILE':str(pub),'ALIPAY_APP_ID':'ali-app','ALIPAY_SELLER_ID':'seller-demo'}
 for k,v in env.items():monkeypatch.setenv(k,v)
 value={'appid':'app-demo','mchid':'merchant-demo','trade_state':'SUCCESS','out_trade_no':'LH-VERIFY','transaction_id':'WX-SIGNED','amount':{'total':12345,'currency':'CNY'}};nonce='abcdefghijkl';associated='transaction';cipher=AESGCM(env['WECHAT_API_V3_KEY'].encode()).encrypt(nonce.encode(),json.dumps(value).encode(),associated.encode());body=json.dumps({'resource':{'nonce':nonce,'associated_data':associated,'ciphertext':base64.b64encode(cipher).decode()}});timestamp=str(int(time.time()));headers={'Wechatpay-Timestamp':timestamp,'Wechatpay-Nonce':'nonce','Wechatpay-Serial':'PUB_KEY_TEST','Wechatpay-Signature':payments.sign_rsa(key,timestamp+'\nnonce\n'+body+'\n')}
 assert payments.parse_wechat(headers,body)==('LH-VERIFY','WX-SIGNED',12345)
 with pytest.raises(HTTPException):payments.parse_wechat(headers,body+' ')
 stale={**headers,'Wechatpay-Timestamp':'1'}
 with pytest.raises(HTTPException):payments.parse_wechat(stale,body)
 data={'app_id':'ali-app','seller_id':'seller-demo','trade_status':'TRADE_SUCCESS','out_trade_no':'LH-ALI','trade_no':'ALI-SIGNED','total_amount':'12.34','sign_type':'RSA2'};data['sign']=payments.sign_rsa(key,'&'.join(f'{k}={data[k]}' for k in sorted(data) if k!='sign_type'));assert payments.parse_alipay(data)==('LH-ALI','ALI-SIGNED',1234)
 with pytest.raises(HTTPException):payments.parse_alipay({**data,'total_amount':'1.00'})
 login(server,'user01');d=make_design(server);o=server.post('/api/orders',json={'kind':'custom','design_id':d['id'],'request_id':uuid.uuid4().hex,'shipping':{'name':'测试','phone':'演示','address':'虚拟地址'}}).json()
 from backend.domain import pay_order
 with Session() as db:
  order=db.get(Order,o['id'])
  with pytest.raises(HTTPException):pay_order(db,order,'mock','bad-amount',order.amount_fen-1)
  db.rollback()
 assert server.post('/api/orders/'+o['id']+'/pay-demo').status_code==200
 with Session() as db:
  order=db.get(Order,o['id'])
  with pytest.raises(HTTPException):pay_order(db,order,'mock','changed-tx',order.amount_fen)


def test_sql_snapshot_roundtrip(server,tmp_path):
 import sqlite3
 from backend.seed import dump_sql
 from sqlalchemy import create_engine
 path=tmp_path/'snapshot.sql'
 with Session() as db:
  dump_sql(db,path);counts={t.name:db.scalar(select(func.count()).select_from(t)) for t in Base.metadata.sorted_tables if t.name not in ['auth_sessions','login_attempts']}
 sqlite=tmp_path/'restored.sqlite';other=create_engine('sqlite:///'+str(sqlite));Base.metadata.create_all(other);other.dispose()
 con=sqlite3.connect(sqlite);con.executescript(path.read_text(encoding='utf-8'))
 for table,count in counts.items():assert con.execute('SELECT COUNT(*) FROM '+table).fetchone()[0]==count
 assert con.execute('PRAGMA foreign_key_check').fetchall()==[];con.close()


# Signed outbound SDK coverage lives in test_payment_sdks.py.


def test_live_payment_expiry_keeps_reserved_stock_and_late_receipt(server,monkeypatch):
 from backend import domain
 monkeypatch.setattr(domain,'PAYMENT_MODE','live');login(server,'user01')
 with Session() as db:
  user=db.scalar(select(User).where(User.username=='user01'));sku=db.scalar(select(SKU).where(SKU.stock>10));stock=sku.stock;o=domain.create_order(db,user,{'kind':'product','request_id':uuid.uuid4().hex,'items':[{'sku_id':sku.id,'quantity':1}],'shipping':{'name':'测试','phone':'演示','address':'虚拟地址'}});o.options={'_payment_provider':'wechat'};o.expires_at=now()-100;db.flush();domain.expire_orders(db);assert o.state=='pending_payment';assert db.get(SKU,sku.id).stock==stock-1;domain.pay_order(db,o,'wechat','late-'+uuid.uuid4().hex,o.amount_fen);assert o.state=='ready_to_ship';db.rollback()
 assert server.get('/assets/models/%2E%2E%2Fpackage.json').status_code==404
