"""Validate effective Compose settings, without printing credentials. Python 3.10+ compatible."""
import argparse,ipaddress,json,re,sys

def validate_domain(domain):
    if len(domain)>253 or '.' not in domain or any(not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?',p) for p in domain.split('.')):
        raise ValueError('Provide a valid DNS hostname with no port, path or wildcard.')
    try:ipaddress.ip_address(domain)
    except ValueError:pass
    else:raise ValueError('A DNS domain is required for public TLS deployment, not an IP address.')
    return domain.lower()

def require(condition,message):
    if not condition:raise ValueError(message)

def validate(config,domain):
    domain=validate_domain(domain);services=config['services'];env=services['api']['environment']
    require(env.get('APP_ENV')=='production' and env.get('DEMO_MODE')=='0','Production deployment must disable demo accounts.')
    require(env.get('EXPORT_SEED_SQL')=='0','Production must not export demo SQL.')
    require(env.get('PAYMENT_MODE') in ('disabled','live'),'Production payment must be disabled or a verified live merchant channel.')
    if env.get('PAYMENT_MODE')=='live':
        wechat=all(env.get(k) for k in ('WECHAT_APP_ID','WECHAT_MCH_ID','WECHAT_CERT_SERIAL','WECHAT_PRIVATE_KEY_FILE','WECHAT_PLATFORM_PUBLIC_KEY_FILE','WECHAT_PLATFORM_KEY_ID')) and len(env.get('WECHAT_API_V3_KEY','').encode())==32
        mode=env.get('WECHAT_ACCESS_MODE','direct')
        require(mode in ('direct','partner'),'WECHAT_ACCESS_MODE must be direct or partner.')
        if mode=='partner':wechat=wechat and bool(env.get('WECHAT_SUB_MCH_ID'))
        alipay=all(env.get(k) for k in ('ALIPAY_APP_ID','ALIPAY_SELLER_ID','ALIPAY_PRIVATE_KEY_FILE','ALIPAY_PUBLIC_KEY_FILE'))
        require(wechat or alipay,'Live payment requires a complete configured merchant channel; its real transaction verification is still required.')
    require(str(env.get('PUBLIC_BASE_URL','')).rstrip('/')=='https://'+domain,'PUBLIC_BASE_URL must match the HTTPS deployment domain.')
    for key in ('APP_SECRET','POSTGRES_PASSWORD','REDIS_PASSWORD','LLM_API_KEY'):
        value=env.get(key,'')
        require(isinstance(value,str) and re.fullmatch('[0-9a-fA-F]{64}',value) and len(set(value))>=8,key+' must be a generated 64-character hexadecimal secret, not a placeholder.')
    require(len({env[k] for k in ('APP_SECRET','POSTGRES_PASSWORD','REDIS_PASSWORD','LLM_API_KEY')})==4,'Generate a different secret for each service.')
    admin=env.get('ADMIN_PASSWORD','')
    require(isinstance(admin,str) and len(admin)>=16 and len(set(admin))>=8 and not any(x in admin for x in ('REPLACE_','ValidationOnly','LihuaDemo')),'Set a private administrator password with at least 16 characters.')
    require(bool(re.fullmatch('[A-Za-z0-9_.@-]{4,80}',env.get('ADMIN_USER',''))),'ADMIN_USER must be a valid login name.')
    require(services['db']['environment']['POSTGRES_PASSWORD']==env['POSTGRES_PASSWORD'],'PostgreSQL credentials differ between API and database.')
    require(services['redis']['environment']['REDISCLI_AUTH']==env['REDIS_PASSWORD'],'Redis credentials are inconsistent.')
    require(env.get('DATABASE_URL')=='postgresql+psycopg://lihuaji:'+env['POSTGRES_PASSWORD']+'@db:5432/lihuaji','Production API must use the configured PostgreSQL volume.')
    require(env.get('REDIS_URL')=='redis://:'+env['REDIS_PASSWORD']+'@redis:6379/0','Production Redis URL is inconsistent.')
    require(env.get('LLM_BASE_URL')=='http://llm:8080','LLM must use the private self-hosted service.')
    command=services['llm']['command']
    require(command[command.index('-c')+1]=='4096','LLM context must be 4096 for version 2.1.')
    require(command[command.index('--api-key')+1]==env['LLM_API_KEY'],'LLM credentials are inconsistent.')
    for service in ('api','db','redis','llm'):require(not services[service].get('ports'),'Only Nginx may expose host ports.')
    for service,target in [('db','/var/lib/postgresql/data'),('api','/app/data')]:
        require(any(v.get('type')=='volume' and v.get('target')==target for v in services[service]['volumes']),service+' needs a persistent data volume.')
    return {'ok':True,'checks':['production-only accounts','independent strong secrets','TLS origin','private service credentials','4096 context','private ports','persistent database and media'],'domain':domain}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('domain');parser.add_argument('--domain-only',action='store_true');args=parser.parse_args()
    try:
        result={'ok':True,'domain':validate_domain(args.domain)} if args.domain_only else validate(json.load(sys.stdin),args.domain)
        print(json.dumps(result));return 0
    except (ValueError,KeyError,TypeError,IndexError) as exc:
        # Field names may be shown; never echo values or the supplied config.
        print('Deployment preflight failed: '+str(exc),file=sys.stderr);return 2
if __name__=='__main__':raise SystemExit(main())
