"""Isolated browser acceptance server; never uses user data or merchant keys."""
import os
import secrets
import tempfile
from pathlib import Path

data=Path(tempfile.mkdtemp(prefix='lihua-payment-browser-'))
os.environ.update(LIHUA_DATA=str(data), DATABASE_URL='sqlite:///'+str(data/'test.sqlite').replace('\\','/'),
                  APP_ENV='local', DEMO_MODE='1', PAYMENT_MODE='mock', EXPORT_SEED_SQL='0',
                  APP_SECRET=secrets.token_hex(32))
os.environ.pop('REDIS_URL',None)

if __name__=='__main__':
    import uvicorn
    uvicorn.run('backend.app:app',host='127.0.0.1',port=8897,log_level='warning')
