"""Payment business rules over verified SDK transports.

Only signed channel results move an order to paid. A timeout retains the order
and its reservation so retries use the same merchant identifiers.
"""
import base64
import io
import json
import os
import time
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from urllib.parse import quote, urlencode
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException
from .config import PUBLIC_URL, PAYMENT_MODE
from .payment_sdks import (required, key_material, ensure_channel_ready,
                           wechat_mode, wechat_call, alipay_call, alipay_checkout)


def private_key(name):
    return key_material(name, private=True)


def public_key(name):
    return key_material(name)


def sign_rsa(key, text):
    return base64.b64encode(key.sign(text.encode(), padding.PKCS1v15(), hashes.SHA256())).decode()


def verify_rsa(key, text, sig):
    try:
        key.verify(base64.b64decode(sig, validate=True), text.encode(), padding.PKCS1v15(), hashes.SHA256())
    except Exception:
        raise HTTPException(400, '支付通知签名无效') from None


def amount_fen(value):
    try:
        amount = Decimal(str(value)) * 100
        if not amount.is_finite() or amount <= 0 or amount >= 100000000 or amount != amount.to_integral_value():
            raise ValueError()
        return int(amount)
    except (ValueError, InvalidOperation):
        raise HTTPException(400, '支付金额格式或精度错误') from None


def wechat_identity():
    if wechat_mode() == 'partner':
        identity = {'sp_appid': required('WECHAT_APP_ID'), 'sp_mchid': required('WECHAT_MCH_ID'),
                    'sub_mchid': required('WECHAT_SUB_MCH_ID')}
        if os.getenv('WECHAT_SUB_APP_ID'):
            identity['sub_appid'] = required('WECHAT_SUB_APP_ID')
        return identity
    return {'appid': required('WECHAT_APP_ID'), 'mchid': required('WECHAT_MCH_ID')}


def wechat_base():
    return '/v3/pay/' + ('partner/' if wechat_mode() == 'partner' else '') + 'transactions'


def check_wechat_identity(data, status=400):
    if any(data.get(k) != v for k, v in wechat_identity().items()):
        raise HTTPException(status, '微信商户身份不匹配')


def prepay(order, provider, mobile=False):
    if PAYMENT_MODE != 'live':
        raise HTTPException(409, '当前为模拟收款或停用状态，不能发起真实扣款')
    ensure_channel_ready(provider)
    if provider == 'wechat':
        result = wechat_call('POST', wechat_base() + '/native', {
            **wechat_identity(), 'description': '梨花季订单 ' + order.number,
            'out_trade_no': order.number, 'notify_url': PUBLIC_URL + '/api/payments/wechat/notify',
            'amount': {'total': order.amount_fen, 'currency': 'CNY'},
        })
        code_url = result.get('code_url', '')
        if not isinstance(code_url, str) or not code_url.startswith('weixin://wxpay/'):
            raise HTTPException(502, '微信没有返回有效的订单付款码')
        import qrcode
        buf = io.BytesIO()
        qrcode.make(code_url).save(buf, format='PNG')
        return {'provider': provider, 'code_url': code_url,
                'qr_data': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()}
    return {'provider': 'alipay', 'cashier_url': alipay_checkout({
        'out_trade_no': order.number, 'total_amount': format(Decimal(order.amount_fen) / 100, '.2f'),
        'subject': '梨花季订单 ' + order.number,
        'time_expire': datetime.fromtimestamp(order.expires_at, timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M:%S'),
        'product_code': 'QUICK_WAP_WAY' if mobile else 'FAST_INSTANT_TRADE_PAY',
    }, PUBLIC_URL + '/api/payments/alipay/notify',
       PUBLIC_URL + '/?payment_return=1#order/' + quote(order.id, safe=''), mobile=mobile)}


def verify_wechat_headers(headers, body, key=None, serial=None):
    headers = {k.lower(): v for k, v in headers.items()}
    try:
        timestamp = int(headers.get('wechatpay-timestamp', '0'))
    except (ValueError, TypeError):
        raise HTTPException(400, '无效支付时间戳') from None
    if abs(time.time() - timestamp) > 300:
        raise HTTPException(400, '支付通知已过期')
    if headers.get('wechatpay-serial') != (serial or required('WECHAT_PLATFORM_KEY_ID')):
        raise HTTPException(400, '支付公钥标识不匹配')
    verify_rsa(key or public_key('WECHAT_PLATFORM_PUBLIC_KEY_FILE'),
               str(timestamp) + '\n' + headers.get('wechatpay-nonce', '') + '\n' + body + '\n',
               headers.get('wechatpay-signature', ''))


def parse_wechat(headers, body):
    verify_wechat_headers(headers, body)
    try:
        resource = json.loads(body)['resource']
        data = json.loads(AESGCM(required('WECHAT_API_V3_KEY').encode()).decrypt(
            resource['nonce'].encode(), base64.b64decode(resource['ciphertext'], validate=True),
            resource.get('associated_data', '').encode()))
        check_wechat_identity(data)
        if data.get('trade_state') != 'SUCCESS' or data.get('amount', {}).get('currency') != 'CNY':
            raise HTTPException(400, '微信金额币种或支付状态不匹配')
        return data['out_trade_no'], data['transaction_id'], data['amount']['total']
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, '支付通知内容无效或解密失败') from None


def parse_alipay(data):
    if data.get('sign_type') != 'RSA2':
        raise HTTPException(400, '支付宝签名类型无效')
    verify_rsa(public_key('ALIPAY_PUBLIC_KEY_FILE'), '&'.join(
        f'{k}={data[k]}' for k in sorted(data) if k not in ('sign', 'sign_type') and data[k] != ''), data.get('sign', ''))
    if (data.get('app_id') != required('ALIPAY_APP_ID') or data.get('seller_id') != required('ALIPAY_SELLER_ID')
            or data.get('trade_status') not in ('TRADE_SUCCESS', 'TRADE_FINISHED')):
        raise HTTPException(400, '支付宝商户或交易状态无效')
    if not data.get('out_trade_no') or not data.get('trade_no'):
        raise HTTPException(400, '支付宝交易编号缺失')
    return data['out_trade_no'], data['trade_no'], amount_fen(data.get('total_amount'))


def query_order(order, provider):
    """Read-only reconciliation. A browser return URL is never proof of payment."""
    if PAYMENT_MODE != 'live':
        raise HTTPException(409, '真实支付通道未启用')
    if provider == 'wechat':
        merchant = {k: v for k, v in wechat_identity().items() if k.endswith('mchid')}
        result = wechat_call('GET', wechat_base() + '/out-trade-no/' + quote(order.number, safe='') + '?' + urlencode(merchant))
        check_wechat_identity(result, 502)
        if result.get('out_trade_no') != order.number:
            raise HTTPException(502, '微信订单身份不一致')
        state = result.get('trade_state')
        if state == 'SUCCESS':
            if result.get('amount', {}).get('currency') != 'CNY':
                raise HTTPException(502, '支付币种不一致')
            return {'state': 'paid', 'tx': result.get('transaction_id'), 'amount': result.get('amount', {}).get('total')}
        return {'state': 'closed' if state == 'CLOSED' else 'pending' if state == 'NOTPAY' else 'unknown'}
    if provider == 'alipay':
        result = alipay_call('alipay.trade.query', {'out_trade_no': order.number})
        if result.get('sub_code') == 'ACQ.TRADE_NOT_EXIST':
            # A checkout link may not yet have created a trade. An old link must
            # expire at the gateway before releasing its reserved inventory.
            expiring_link = order.options.get('_payment_expires_at') == order.expires_at
            return {'state': 'closed' if expiring_link and time.time() > order.expires_at + 60 else 'unknown'}
        if result.get('out_trade_no') != order.number or (result.get('seller_id') and result['seller_id'] != required('ALIPAY_SELLER_ID')):
            raise HTTPException(502, '支付宝订单身份不一致')
        state = result.get('trade_status')
        if state in ('TRADE_SUCCESS', 'TRADE_FINISHED'):
            return {'state': 'paid', 'tx': result.get('trade_no'), 'amount': amount_fen(result.get('total_amount'))}
        return {'state': 'closed' if state == 'TRADE_CLOSED' else 'pending' if state == 'WAIT_BUYER_PAY' else 'unknown'}
    raise HTTPException(422, '支付渠道无效')


def close_or_query(order, provider):
    result = query_order(order, provider)
    if result['state'] == 'paid':
        return result['tx'], result['amount']
    if result['state'] == 'closed':
        return None
    if result['state'] != 'pending':
        raise HTTPException(409, '支付状态尚不能关闭，请稍后核对')
    if provider == 'wechat':
        merchant = {k: v for k, v in wechat_identity().items() if k.endswith('mchid')}
        wechat_call('POST', wechat_base() + '/out-trade-no/' + quote(order.number, safe='') + '/close', merchant)
    else:
        closed = alipay_call('alipay.trade.close', {'out_trade_no': order.number})
        if closed.get('out_trade_no') != order.number:
            raise HTTPException(502, '支付宝关单凭据不一致')
    return None


def refund_order(order, payment, refund, query=False):
    if PAYMENT_MODE != 'live':
        raise HTTPException(409, '真实退款通道未启用')
    if payment.provider == 'wechat':
        sub = {'sub_mchid': required('WECHAT_SUB_MCH_ID')} if wechat_mode() == 'partner' else {}
        if query:
            result = wechat_call('GET', '/v3/refund/domestic/refunds/' + quote(refund.id, safe='') + ('?' + urlencode(sub) if sub else ''))
        else:
            result = wechat_call('POST', '/v3/refund/domestic/refunds', {
                **sub, 'transaction_id': payment.provider_tx, 'out_refund_no': refund.id, 'reason': refund.reason[:80],
                'amount': {'refund': order.amount_fen, 'total': order.amount_fen, 'currency': 'CNY'}})
        amount = result.get('amount', {})
        if (result.get('out_refund_no') != refund.id or result.get('transaction_id') != payment.provider_tx
                or amount.get('refund') != order.amount_fen or amount.get('total') != order.amount_fen
                or amount.get('currency') != 'CNY'):
            raise HTTPException(502, '退款凭据与订单不一致')
        return 'refunded' if result.get('status') == 'SUCCESS' else 'processing'
    if payment.provider == 'alipay':
        biz = {'trade_no': payment.provider_tx, 'out_trade_no': order.number, 'out_request_no': refund.id}
        if not query:
            biz.update({'refund_amount': format(Decimal(order.amount_fen) / 100, '.2f'), 'refund_reason': refund.reason[:200]})
        result = alipay_call('alipay.trade.fastpay.refund.query' if query else 'alipay.trade.refund', biz)
        if (result.get('trade_no') != payment.provider_tx or result.get('out_trade_no') != order.number
                or amount_fen(result.get('refund_amount', result.get('refund_fee'))) != order.amount_fen
                or (query and result.get('out_request_no') != refund.id)):
            raise HTTPException(502, '支付宝退款凭据与订单不一致')
        return 'refunded' if not query or result.get('refund_status') == 'REFUND_SUCCESS' else 'processing'
    raise HTTPException(422, '未知退款渠道')
