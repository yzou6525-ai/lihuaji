"""No real money/network: exercise upstream signing with generated test keys."""
import base64
import importlib
import json
import re
import time
import uuid
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import pytest
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from fastapi import HTTPException
from sqlalchemy import select, func
from test_platform import server, login
from backend import payments, payment_sdks, domain
from backend.db import Session
from backend.models import Order, Payment, SKU


@pytest.fixture
def merchant(monkeypatch, tmp_path):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = tmp_path/'private.pem'; public = tmp_path/'public.pem'
    private.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    public.write_bytes(key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
    values = {'WECHAT_PRIVATE_KEY_FILE': str(private), 'WECHAT_PLATFORM_PUBLIC_KEY_FILE': str(public),
              'WECHAT_APP_ID': 'test-app', 'WECHAT_MCH_ID': 'test-merchant', 'WECHAT_CERT_SERIAL': 'test-serial',
              'WECHAT_PLATFORM_KEY_ID': 'PUB_KEY_TEST', 'WECHAT_API_V3_KEY': '0'*32, 'WECHAT_ACCESS_MODE': 'direct',
              'ALIPAY_PRIVATE_KEY_FILE': str(private), 'ALIPAY_PUBLIC_KEY_FILE': str(public),
              'ALIPAY_APP_ID': 'test-app', 'ALIPAY_SELLER_ID': 'test-seller'}
    for k,v in values.items(): monkeypatch.setenv(k,v)
    monkeypatch.setattr(payments, 'PAYMENT_MODE', 'live')
    return key


def wx_response(key, payload, timestamp=None, serial='PUB_KEY_TEST', tamper=False, code=200):
    text = json.dumps(payload, ensure_ascii=False) if code != 204 else ''
    stamp = str(timestamp or int(time.time()))
    headers = {'Content-Type':'application/json', 'Wechatpay-Timestamp':stamp,
               'Wechatpay-Serial':serial, 'Wechatpay-Nonce':'test-nonce',
               'Wechatpay-Signature-Type':'WECHATPAY2-SHA256-RSA2048',
               'Wechatpay-Signature':payments.sign_rsa(key, stamp+'\ntest-nonce\n'+text+'\n')}
    if tamper: text += ' '
    return SimpleNamespace(status_code=code, text=text, content=text.encode(), headers=headers)


def ali_response(key, method, payload, tamper=False):
    body=json.dumps(payload, ensure_ascii=False, separators=(',',':'))
    return ('{"'+method.replace('.','_')+'_response":'+body+(',"extra":true' if tamper else '')+
            ',"sign":"'+payments.sign_rsa(key,body)+'"}').encode()


def test_wechat_sdk_signs_exact_body_and_verifies_response(monkeypatch,merchant):
    core=importlib.import_module('wechatpayv3.core'); captured={}
    def post(**kwargs): captured.update(kwargs); return wx_response(merchant,{'code_url':'weixin://wxpay/test'})
    monkeypatch.setattr(core.requests,'post',post)
    assert payments.wechat_call('POST','/v3/pay/transactions/native',{'description':'苏绣'})['code_url']
    auth=dict(re.findall(r'(\w+)="([^"]+)"',captured['headers']['Authorization']))
    signed='\n'.join(['POST','/v3/pay/transactions/native',auth['timestamp'],auth['nonce_str'],json.dumps(captured['json']),''])
    merchant.public_key().verify(base64.b64decode(auth['signature']),signed.encode(),padding.PKCS1v15(),hashes.SHA256())
    assert captured['timeout']==(5,15)


@pytest.mark.parametrize('alter', ['tamper','stale','wrong-key','missing-signature','unsigned-204'])
def test_wechat_rejects_untrusted_responses(monkeypatch,merchant,alter):
    core=importlib.import_module('wechatpayv3.core')
    response=wx_response(merchant,{},timestamp=1 if alter=='stale' else None,
                         serial='WRONG' if alter=='wrong-key' else 'PUB_KEY_TEST',tamper=alter=='tamper',code=204 if alter=='unsigned-204' else 200)
    if alter in ('missing-signature','unsigned-204'):response.headers.pop('Wechatpay-Signature')
    monkeypatch.setattr(core.requests,'get',lambda **kwargs:response)
    with pytest.raises(HTTPException) as exc:payments.wechat_call('GET','/test')
    assert exc.value.status_code==502


def test_alipay_official_sdk_checkout_and_signed_query(monkeypatch,merchant):
    module=importlib.import_module('alipay.aop.api.DefaultAlipayClient')
    order=SimpleNamespace(id='order-test',number='LH-TEST',amount_fen=1234,expires_at=int(time.time())+1800)
    for mobile,method in [(False,'alipay.trade.page.pay'),(True,'alipay.trade.wap.pay')]:
        url=payments.prepay(order,'alipay',mobile)['cashier_url']; parts=urlsplit(url)
        assert parts.scheme=='https' and parts.hostname=='openapi.alipay.com'
        params={k:v[0] for k,v in parse_qs(parts.query).items()};signature=params.pop('sign')
        assert params['method']==method and params['return_url'].endswith('#order/order-test')
        assert json.loads(params['biz_content'])['total_amount']=='12.34'
        merchant.public_key().verify(base64.b64decode(signature),'&'.join(f'{k}={params[k]}' for k in sorted(params)).encode(),padding.PKCS1v15(),hashes.SHA256())
    payload={'code':'10000','out_trade_no':order.number,'trade_no':'ali-tx','total_amount':'12.34','trade_status':'TRADE_SUCCESS'}
    monkeypatch.setattr(module,'do_post',lambda *a,**kw:ali_response(merchant,'alipay.trade.query',payload))
    assert payments.query_order(order,'alipay')=={'state':'paid','tx':'ali-tx','amount':1234}
    monkeypatch.setattr(module,'do_post',lambda *a,**kw:ali_response(merchant,'alipay.trade.query',payload,tamper=True))
    with pytest.raises(HTTPException):payments.query_order(order,'alipay')


@pytest.mark.parametrize('bad', ['NaN','Infinity','-1','0','1.001',None,True])
def test_rejects_invalid_money(bad):
    with pytest.raises(HTTPException):payments.amount_fen(bad)


def test_partner_requests_use_service_provider_and_submerchant(monkeypatch,merchant):
    monkeypatch.setenv('WECHAT_ACCESS_MODE','partner');monkeypatch.setenv('WECHAT_SUB_MCH_ID','sub-test')
    calls=[];order=SimpleNamespace(id='id',number='LH-PARTNER',amount_fen=100)
    def request(method,uri,data=None):
        calls.append((method,uri,data))
        if method=='POST':return {'code_url':'weixin://wxpay/test'}
        return {'sp_appid':'test-app','sp_mchid':'test-merchant','sub_mchid':'sub-test',
                'out_trade_no':order.number,'trade_state':'SUCCESS','transaction_id':'tx',
                'amount':{'total':100,'currency':'CNY'}}
    monkeypatch.setattr(payments,'wechat_call',request)
    assert payments.prepay(order,'wechat')['qr_data'].startswith('data:image/png;base64,')
    assert calls[0][1]=='/v3/pay/partner/transactions/native'
    assert calls[0][2]['sp_mchid']=='test-merchant' and calls[0][2]['sub_mchid']=='sub-test'
    assert payments.query_order(order,'wechat')['amount']==100
    assert 'sp_mchid=test-merchant&sub_mchid=sub-test' in calls[-1][1]


def product_order(server):
    login(server,'user01')
    sku=next(s for p in server.get('/api/products').json() for s in p['skus'] if s['stock']>3)
    response=server.post('/api/orders',json={'kind':'product','request_id':uuid.uuid4().hex,
        'items':[{'sku_id':sku['id'],'quantity':1}], 'shipping':{'name':'验收','phone':'演示号码','address':'虚拟地址'}})
    assert response.status_code==201,response.text
    return response.json(),sku


def test_preflight_failure_does_not_lock_channel(server,monkeypatch):
    module=importlib.import_module('backend.app');o,sku=product_order(server)
    monkeypatch.setattr(module,'PAYMENT_MODE','live');monkeypatch.delenv('WECHAT_APP_ID',raising=False)
    response=server.post('/api/orders/'+o['id']+'/prepay',json={'provider':'wechat'})
    assert response.status_code==503
    assert not server.get('/api/orders/'+o['id']).json()['options'].get('_payment_provider')


def test_query_reconciles_once_and_requires_ownership(server,monkeypatch):
    module=importlib.import_module('backend.app');o,sku=product_order(server)
    with Session() as db:
        row=db.get(Order,o['id']);row.options={'_payment_provider':'wechat'};db.commit()
    monkeypatch.setattr(module,'PAYMENT_MODE','live');tx='query-'+uuid.uuid4().hex
    monkeypatch.setattr(payments,'query_order',lambda order,provider:{'state':'paid','tx':tx,'amount':order.amount_fen})
    login(server,'user02');assert server.post('/api/orders/'+o['id']+'/payment-status').status_code==403
    login(server,'user01')
    for _ in range(2):
        result=server.post('/api/orders/'+o['id']+'/payment-status');assert result.status_code==200,result.text
        assert result.json()['state']=='ready_to_ship'
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(Payment).where(Payment.order_id==o['id']))==1
        row=db.get(Order,o['id']);domain.pay_order(db,row,'wechat',tx,row.amount_fen)
        with pytest.raises(HTTPException):domain.pay_order(db,row,'alipay',tx,row.amount_fen)


@pytest.mark.parametrize('mode',['amount','timeout','unknown'])
def test_query_uncertainty_never_marks_paid_or_releases_stock(server,monkeypatch,mode):
    module=importlib.import_module('backend.app');o,sku=product_order(server)
    with Session() as db:
        row=db.get(Order,o['id']);row.options={'_payment_provider':'wechat'};stock=db.get(SKU,sku['id']).stock;db.commit()
    monkeypatch.setattr(module,'PAYMENT_MODE','live')
    def query(order,provider):
        if mode=='timeout':raise HTTPException(502,'测试网络超时')
        return {'state':'unknown'} if mode=='unknown' else {'state':'paid','tx':'bad-amount','amount':order.amount_fen-1}
    monkeypatch.setattr(payments,'query_order',query)
    r=server.post('/api/orders/'+o['id']+'/payment-status');assert r.status_code==({'amount':409,'timeout':502,'unknown':200}[mode])
    with Session() as db:
        assert db.get(Order,o['id']).state=='pending_payment'
        assert db.get(SKU,sku['id']).stock==stock
        assert not db.scalar(select(Payment).where(Payment.order_id==o['id']))


def test_refund_retries_keep_original_request_and_check_identity(monkeypatch,merchant):
    order=SimpleNamespace(number='LH-REFUND',amount_fen=500)
    payment=SimpleNamespace(provider='alipay',provider_tx='tx-refund')
    refund=SimpleNamespace(id='refund-fixed',reason='测试退款')
    calls=[]
    def request(method,biz):
        calls.append(biz.copy());return {'trade_no':payment.provider_tx,'out_trade_no':order.number,
         'refund_fee':'5.00','out_request_no':refund.id,'refund_status':'REFUND_SUCCESS'}
    monkeypatch.setattr(payments,'alipay_call',request)
    assert payments.refund_order(order,payment,refund)=='refunded'
    assert payments.refund_order(order,payment,refund,query=True)=='refunded'
    assert all(x['out_request_no']==refund.id for x in calls)
    monkeypatch.setattr(payments,'alipay_call',lambda *a:{**request(*a),'out_request_no':'other'})
    with pytest.raises(HTTPException):payments.refund_order(order,payment,refund,query=True)


@pytest.mark.parametrize('expired,marker,expected',[(False,True,'unknown'),(True,True,'closed'),(True,False,'unknown')])
def test_unopened_alipay_link_only_closes_after_signed_expiry(monkeypatch,merchant,expired,marker,expected):
    module=importlib.import_module('alipay.aop.api.DefaultAlipayClient')
    expires=int(time.time())+(-120 if expired else 1800)
    order=SimpleNamespace(number='LH-UNOPENED',expires_at=expires,options={'_payment_expires_at':expires} if marker else {})
    payload={'code':'40004','sub_code':'ACQ.TRADE_NOT_EXIST'}
    monkeypatch.setattr(module,'do_post',lambda *a,**kw:ali_response(merchant,'alipay.trade.query',payload))
    assert payments.query_order(order,'alipay')['state']==expected


def test_signed_webhook_and_repeat_notification_record_once(server,monkeypatch,merchant):
    module=importlib.import_module('backend.app');order,sku=product_order(server)
    with Session() as db:
        o=db.get(Order,order['id']);o.options={'_payment_provider':'alipay'};db.commit()
    monkeypatch.setattr(module,'PAYMENT_MODE','live')
    data={'app_id':'test-app','seller_id':'test-seller','trade_status':'TRADE_SUCCESS',
          'out_trade_no':order['number'],'trade_no':'signed-'+uuid.uuid4().hex,
          'total_amount':format(order['amount_fen']/100,'.2f'),'sign_type':'RSA2'}
    data['sign']=payments.sign_rsa(merchant,'&'.join(f'{k}={data[k]}' for k in sorted(data) if k!='sign_type'))
    bad=server.post('/api/payments/alipay/notify',data={**data,'total_amount':'0.01'})
    assert bad.status_code==400
    for _ in range(2):
        response=server.post('/api/payments/alipay/notify',data=data)
        assert response.status_code==200 and response.text=='success'
    with Session() as db:
        assert db.get(Order,order['id']).state=='ready_to_ship'
        assert db.scalar(select(func.count()).select_from(Payment).where(Payment.order_id==order['id']))==1
