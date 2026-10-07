#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
DOMAIN="${1:-}"
command -v python3 >/dev/null || { echo 'Install Python 3 before deployment.'; exit 2; }
python3 deploy/production-check.py "$DOMAIN" --domain-only >/dev/null
if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ ]] || [[ "$DOMAIN" != *.* ]]; then
  echo 'Usage: bash deploy/deploy.sh your-domain.example'; exit 2
fi
command -v docker >/dev/null || { echo 'Install Docker Engine and the Compose plugin first; see README.'; exit 2; }
docker compose version >/dev/null
for program in openssl sha256sum curl; do command -v "$program" >/dev/null || { echo "Missing required command: $program"; exit 2; }; done
docker info >/dev/null
for f in ../src/ai/model.gguf ../src/diffusion/model.gguf models/controlnet-canny-ldm.safetensors; do
  test -s "$f" || { echo "Missing delivered model: $f"; exit 2; }
done
# Ubuntu 22.04 has Python 3.10: use coreutils hashes, not hashlib.file_digest (3.11+).
sha256sum --check deploy/model-checksums.sha256
mkdir -p certs secrets backups
chmod 700 backups
if [[ $EUID -eq 0 ]]; then
 python3 deploy/prepare-secrets.py secrets
else
 chmod 700 secrets
 echo 'For live merchant private keys, rerun with sudo to grant the non-root API group read access, including nested key directories.'
fi
if [[ ! -f .env ]]; then
  umask 077
  cp .env.example .env
  python3 - "$DOMAIN" <<'PY'
import sys,secrets,pathlib
p=pathlib.Path('.env');s=p.read_text();admin=secrets.token_urlsafe(20)
for placeholder in ['REPLACE_WITH_RANDOM_64_HEX','REPLACE_WITH_RANDOM_HEX']:
 while placeholder in s:s=s.replace(placeholder,secrets.token_hex(32),1)
s=s.replace('REPLACE_WITH_AT_LEAST_16_CHARACTERS',admin).replace('https://embroidery.example.com','https://'+sys.argv[1]);p.write_text(s)
pathlib.Path('secrets/initial-admin.txt').write_text('User: admin\nPassword: '+admin+'\nChange this password after first login.\n')
PY
  echo 'Initial administrator credentials saved to secrets/initial-admin.txt (owner-only).'
fi
chmod 600 .env
# Check EFFECTIVE Compose values; shell exports can override .env interpolation.
docker compose config --format json | python3 deploy/production-check.py "$DOMAIN"
if [[ ! -f certs/fullchain.pem || ! -f certs/privkey.pem ]]; then
  echo 'Place the domain fullchain.pem and privkey.pem in platform/certs, then rerun.'
  echo "For Let's Encrypt: follow the certificate command in README before starting nginx."
  exit 2
fi
openssl x509 -in certs/fullchain.pem -noout -checkhost "$DOMAIN" >/dev/null || { echo 'TLS certificate does not match this domain.'; exit 2; }
openssl x509 -in certs/fullchain.pem -noout -checkend 86400 >/dev/null || { echo 'TLS certificate expires within a day; renew it before deployment.'; exit 2; }
cert_public="$(openssl x509 -in certs/fullchain.pem -pubkey -noout | openssl pkey -pubin -outform DER | sha256sum)"
key_public="$(openssl pkey -in certs/privkey.pem -pubout -outform DER | sha256sum)"
[[ "$cert_public" == "$key_public" ]] || { echo 'TLS private key does not match the certificate.'; exit 2; }
chmod 600 certs/privkey.pem
python3 - "$DOMAIN" <<'PY'
import pathlib,sys
p=pathlib.Path('deploy');(p/'nginx.conf').write_text((p/'nginx.conf.template').read_text().replace('__DOMAIN__',sys.argv[1]))
PY
docker compose config --quiet
docker compose build --pull
docker compose up -d --wait --wait-timeout 600
curl --fail --silent --show-error "https://$DOMAIN/api/health"
echo "Open https://$DOMAIN . Keep .env, secrets and backups private."
