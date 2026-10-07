const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const base='http://127.0.0.1:8897';
const output=path.resolve('../delivery/payment-integration-2026-10-06/browser');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 let csrf='',prepayCount=0,statusCount=0,queryMode='pending';
 try{
  await page.route('**/api/config',async route=>{const r=await route.fetch();const data=await r.json();data.payment_mode='live';await route.fulfill({response:r,json:data})});
  await page.goto(base+'/#home');await page.waitForLoadState('networkidle');
  assert(await page.getByRole('heading').count()>0);
  await page.goto(base+'/#register');await page.waitForLoadState('networkidle');
  const name='payment_ui_'+Date.now();
  await page.locator('#auth-form [name=name]').fill('支付流程验收');
  await page.locator('#auth-form [name=username]').fill(name);
  await page.locator('#auth-form [name=password]').fill('OnlyUITest!2026');
  for(const checkbox of await page.locator('#auth-form input[type=checkbox]').all())await checkbox.check();
  await page.locator('#auth-form button[type=submit]').click();
  await page.waitForURL(/#home$/);await page.waitForLoadState('networkidle');
  checks.push('新用户可注册并进入首页');
  await page.locator('#logout').click();await page.waitForURL(/#login$/);
  await page.locator('#auth-form [name=username]').fill(name);
  await page.locator('#auth-form [name=password]').fill('OnlyUITest!2026');
  await page.locator('#auth-form button[type=submit]').click();await page.waitForURL(/#home$/);
  csrf=(await(await page.request.get(base+'/api/auth/me')).json()).csrf;
  checks.push('退出后可重新登录');
  const products=await(await page.request.get(base+'/api/products')).json();
  const sku=products.flatMap(p=>p.skus).find(s=>s.stock>3);
  async function createOrder(){
   const r=await page.request.post(base+'/api/orders',{headers:{'X-CSRF-Token':csrf},data:{kind:'product',request_id:require('crypto').randomUUID(),items:[{sku_id:sku.id,quantity:1}],shipping:{name:'测试收件人',phone:'测试号码',address:'隔离测试虚拟地址'}}});
   assert.equal(r.status(),201);return r.json();
  }
  const order=await createOrder();
  await page.route('**/api/orders/*/prepay',async route=>{prepayCount++;await route.fulfill({json:{provider:'wechat',qr_data:'data:image/png;base64,'+fs.readFileSync('tests/fixtures/payment-test-qr.png').toString('base64')}})});
  await page.route('**/api/orders/*/payment-status',async route=>{
   statusCount++;const currentId=route.request().url().split('/orders/')[1].split('/')[0];
   if(queryMode==='error'){await route.fulfill({status:502,json:{detail:'测试：渠道暂未响应'}});return}
   if(queryMode==='paid')await page.request.post(base+'/api/orders/'+currentId+'/pay-demo',{headers:{'X-CSRF-Token':csrf}});
   const r=await page.request.get(base+'/api/orders/'+currentId);
   await route.fulfill({json:{...await r.json(),notice:queryMode==='pending'?'尚未确认到账，请勿重复付款。':''}});
  });
  await page.goto(base+'/#order/'+order.id);await page.locator('#pay').waitFor();
  await page.locator('#pay').click();await page.locator('#wxpay').click();
  await page.locator('#payment-result img').waitFor();
  assert(await page.locator('#alipay').isDisabled());assert.equal(prepayCount,1);
  await page.locator('#check-payment').click();await page.locator('#payment-status').filter({hasText:'尚未确认到账'}).waitFor();
  queryMode='error';await page.locator('#check-payment').click();
  await page.locator('#payment-status').filter({hasText:'这不代表付款失败'}).waitFor();
  assert.equal(prepayCount,1);assert(!await page.locator('#check-payment').isDisabled());
  await page.screenshot({path:output+'/payment-desktop.png'});
  checks.push('微信订单码在原弹窗展示；禁止切换渠道；查单失败保留订单并允许再次核对');
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:output+'/payment-mobile.png'});
  await page.keyboard.press('Escape');assert(!await page.locator('#modal').evaluate(e=>e.open));
  const before=statusCount;await page.clock.install();await page.clock.fastForward(31000);assert.equal(statusCount,before);
  checks.push('390像素手机无横向溢出；Escape关闭弹窗后停止轮询');
  await page.locator('#pay').click();await page.locator('#wxpay').click();
  await page.locator('#payment-result img').waitFor();queryMode='paid';
  await page.locator('#check-payment').click();await page.getByText('待发货',{exact:true}).waitFor();
  assert.equal(await page.locator('#pay').count(),0);assert(!await page.locator('#modal').evaluate(e=>e.open));
  checks.push('核实到账后关闭弹窗，订单进入待发货并移除付款按钮');
  await page.goto(base+'/?payment_return=1#order/'+order.id);await page.getByText('待发货',{exact:true}).waitFor();
  assert(!page.url().includes('payment_return'));checks.push('支付宝返回指定订单，清理返回标识，不把跳转本身认作付款');
  const unpaid=await createOrder();queryMode='pending';
  await page.route('**/api/orders/'+unpaid.id,async route=>{const r=await route.fetch();const value=await r.json();await route.fulfill({response:r,json:{...value,options:{...value.options,_payment_provider:'alipay'}}})});
  const queriesBefore=statusCount;
  await page.goto(base+'/?payment_return=1#order/'+unpaid.id);await page.getByText('待付款',{exact:true}).waitFor();
  assert.equal(statusCount,queriesBefore+1);assert.equal(await page.locator('#pay').count(),1);
  checks.push('支付宝返回未付款订单时主动查单，未到账仍为待付款');
  for(const route of ['home','mall','library','orders','profile']){
   await page.goto(base+'/#'+route);await page.waitForLoadState('networkidle');
   assert.equal(await page.getByRole('heading',{name:'这个页面暂时没有打开'}).count(),0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  checks.push('首页、商城、纹样库、订单、会员页面可打开且手机无溢出');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(output+'/report.json',JSON.stringify({ok:true,checks,errors,prepayCount,statusCount,viewports:['1440x1000','390x844'],scope:'隔离数据库；付款渠道响应由测试替身提供，未发生真实支付。'},null,2));
  console.log(JSON.stringify({ok:true,checks:checks.length,errors}));
 }catch(e){await page.screenshot({path:output+'/failure.png'}).catch(()=>{});fs.writeFileSync(output+'/report.json',JSON.stringify({ok:false,checks,errors,error:e.stack},null,2));console.error(e);process.exitCode=1}
 finally{await browser.close()}
})();
