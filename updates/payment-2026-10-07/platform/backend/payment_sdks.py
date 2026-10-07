"""Small adapters around pinned upstream SDKs; never log merchant secrets.

WeChat: minibear2021/wechatpayv3 (MIT).
Alipay: alipay/alipay-sdk-python-all (Apache-2.0).
Order ownership, amounts and idempotency remain the application's responsibility.
"""
import importlib
import json
import os
import time
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException


def required(name):
    value = os.getenv(name, '').strip()
    if not value:
        raise HTTPException(503, '支付商户配置未完成：' + name)
    return value


def key_material(name, private=False):
    try:
        raw = Path(required(name)).read_bytes()
        key = (serialization.load_pem_private_key(raw, password=None) if private
               else serialization.load_pem_public_key(raw))
        expected = rsa.RSAPrivateKey if private else rsa.RSAPublicKey
        if not isinstance(key, expected) or key.key_size < 2048:
            raise ValueError('RSA 2048 or stronger required')
        return key
    except HTTPException:
        raise
    except (OSError, ValueError, TypeError):
        raise HTTPException(503, '支付密钥文件不可用：' + name) from None


def wechat_mode():
    mode = os.getenv('WECHAT_ACCESS_MODE', 'direct')
    if mode not in ('direct', 'partner'):
        raise HTTPException(503, '微信商户接入模式配置错误')
    return mode


def ensure_channel_ready(provider):
    """Local validation only: does NOT prove account permissions or live payment."""
    if provider == 'wechat':
        for name in ('WECHAT_APP_ID', 'WECHAT_MCH_ID', 'WECHAT_CERT_SERIAL', 'WECHAT_PLATFORM_KEY_ID'):
            required(name)
        if len(required('WECHAT_API_V3_KEY').encode()) != 32:
            raise HTTPException(503, '微信 APIv3 密钥必须为 32 字节')
        if wechat_mode() == 'partner':
            required('WECHAT_SUB_MCH_ID')
        key_material('WECHAT_PRIVATE_KEY_FILE', private=True)
        key_material('WECHAT_PLATFORM_PUBLIC_KEY_FILE')
        module = 'wechatpayv3.core'
    elif provider == 'alipay':
        required('ALIPAY_APP_ID')
        required('ALIPAY_SELLER_ID')
        key_material('ALIPAY_PRIVATE_KEY_FILE', private=True)
        key_material('ALIPAY_PUBLIC_KEY_FILE')
        module = 'alipay.aop.api.DefaultAlipayClient'
    else:
        raise HTTPException(422, '支付渠道无效')
    try:
        importlib.import_module(module)
    except ImportError:
        raise HTTPException(503, '支付组件尚未安装，请由管理员完成部署') from None


def wechat_client():
    ensure_channel_ready('wechat')
    from wechatpayv3.core import Core

    class PinnedKeyCore(Core):
        def _verify_signature(self, headers, body):
            # Upstream otherwise tries downloading certificates for an unknown key.
            # Pin the configured key and reject stale/replayed signed responses.
            headers = {k.lower(): v for k, v in headers.items()}
            try:
                timestamp = int(headers.get('wechatpay-timestamp', '0'))
            except (ValueError, TypeError):
                return False
            if abs(time.time() - timestamp) > 300:
                return False
            if headers.get('wechatpay-serial') != self._public_key_id:
                return False
            return super()._verify_signature(headers, body)

    return PinnedKeyCore(
        mchid=required('WECHAT_MCH_ID'),
        cert_serial_no=required('WECHAT_CERT_SERIAL'),
        private_key=Path(required('WECHAT_PRIVATE_KEY_FILE')).read_text(encoding='utf-8'),
        apiv3_key=required('WECHAT_API_V3_KEY'),
        public_key=Path(required('WECHAT_PLATFORM_PUBLIC_KEY_FILE')).read_text(encoding='utf-8'),
        public_key_id=required('WECHAT_PLATFORM_KEY_ID'),
        logger=None, timeout=(5, 15),
    )


def wechat_call(method, uri, data=None):
    client = wechat_client()
    from wechatpayv3.type import RequestType
    try:
        code, body = client.request(uri, method=RequestType[method], data=data)
        if code not in (200, 201, 204):
            raise ValueError('channel did not confirm success')
        result = json.loads(body) if body else {}
        if not isinstance(result, dict):
            raise ValueError('invalid response')
        return result
    except Exception:
        # SDK exceptions may contain signed payloads. Do not expose them to clients.
        raise HTTPException(502, '微信尚未返回可验证的结果，请保留原订单并稍后核对') from None


ALIPAY_REQUESTS = {
    'alipay.trade.page.pay': 'AlipayTradePagePayRequest',
    'alipay.trade.wap.pay': 'AlipayTradeWapPayRequest',
    'alipay.trade.query': 'AlipayTradeQueryRequest',
    'alipay.trade.close': 'AlipayTradeCloseRequest',
    'alipay.trade.refund': 'AlipayTradeRefundRequest',
    'alipay.trade.fastpay.refund.query': 'AlipayTradeFastpayRefundQueryRequest',
}


def alipay_request(method, biz, notify_url=None, return_url=None):
    name = ALIPAY_REQUESTS[method]
    module = importlib.import_module('alipay.aop.api.request.' + name)
    request = getattr(module, name)()
    request.biz_content = biz
    request.notify_url = notify_url
    request.return_url = return_url
    return request


def alipay_client():
    ensure_channel_ready('alipay')
    from alipay.aop.api.AlipayClientConfig import AlipayClientConfig
    from alipay.aop.api.DefaultAlipayClient import DefaultAlipayClient
    config = AlipayClientConfig()
    config.server_url = 'https://openapi.alipay.com/gateway.do'
    config.app_id = required('ALIPAY_APP_ID')
    # The official SDK needs PKCS#1; accept either supported PEM format on disk.
    config.app_private_key = key_material('ALIPAY_PRIVATE_KEY_FILE', private=True).private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption()).decode()
    config.alipay_public_key = key_material('ALIPAY_PUBLIC_KEY_FILE').public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    config.sign_type = 'RSA2'
    config.charset = 'utf-8'
    config.timeout = 20
    config.skip_sign = False
    return DefaultAlipayClient(alipay_client_config=config, logger=None)


def alipay_checkout(biz, notify_url, return_url, mobile=False):
    client = alipay_client()
    method = 'alipay.trade.wap.pay' if mobile else 'alipay.trade.page.pay'
    request = alipay_request(method, biz, notify_url, return_url)
    try:
        return client.page_execute(request, http_method='GET')
    except Exception:
        raise HTTPException(502, '支付宝收银台暂未生成，请保留原订单重试') from None


def alipay_call(method, biz):
    client = alipay_client()
    request = alipay_request(method, biz)
    try:
        result = json.loads(client.execute(request))
        if (method == 'alipay.trade.query' and isinstance(result, dict)
                and result.get('code') == '40004' and result.get('sub_code') == 'ACQ.TRADE_NOT_EXIST'):
            return result  # Still SDK signature-verified; never infer payment.
        if not isinstance(result, dict) or result.get('code') != '10000':
            raise ValueError('channel did not confirm success')
        return result
    except Exception:
        raise HTTPException(502, '支付宝尚未返回可验证的结果，请保留原订单并稍后核对') from None
