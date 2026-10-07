"""Isolated product-link acceptance; no user database or merchant credentials."""
import os
import secrets
import tempfile
from pathlib import Path

data = Path(tempfile.mkdtemp(prefix='lihua-taobao-ui-'))
os.environ.update(
    LIHUA_DATA=str(data), DATABASE_URL='sqlite:///' + str(data / 'test.sqlite').replace('\\', '/'),
    APP_ENV='local', DEMO_MODE='0', PAYMENT_MODE='disabled', EXPORT_SEED_SQL='0',
    APP_SECRET=secrets.token_hex(32), ADMIN_PASSWORD=secrets.token_urlsafe(32),
    PUBLIC_BASE_URL='http://127.0.0.1:8898')
os.environ.pop('REDIS_URL', None)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run('backend.app:app', host='127.0.0.1', port=8898, log_level='warning')
