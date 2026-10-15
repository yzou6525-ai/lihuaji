const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {serve}=require('./ar-local-server.cjs');
const out=path.resolve(__dirname,'../docs/suxiu-knowledge');
const cases=[['苏绣','suxiu'],['散套','stitch-santao'],['套针','stitch-tao'],['打籽','stitch-dazi'],['设计绣稿','process-design'],['绷架','tool-frame'],['乱针绣','craft-random'],['双面绣','craft-double'],['双面三异绣','craft-double-three'],['顾文霞','inheritor-gu-wenxia'],['李娥瑛','inheritor-li-eying'],['GB/T 38029-2019','standard-gb']];
(async()=>{let browser,server;const errors=[],checks=[],searches=[],publicBase=process.env.SUXIU_TEST_URL;
try{
 const local=publicBase?null:await serve();server=local?.server;const base=publicBase||local.base;
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1280,height:960}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'#guide',{waitUntil:'networkidle'});await page.locator('[data-suxiu="suxiu"]').waitFor();
 assert.equal(await page.locator('#knowledge-list [data-suxiu]').count(),JSON.parse(fs.readFileSync(path.resolve(__dirname,'../content/suxiu-knowledge.json'))).length);
 for(const [query,id] of cases){
  await page.locator('#knowledge-search').fill(query);await page.waitForFunction(id=>document.querySelector('#knowledge-list [data-suxiu]')?.dataset.suxiu===id,id);
  const first=page.locator('[data-suxiu]').first();assert(await first.locator('a[href^="https://"]').count());
  await page.locator('#global-search').fill(query);await page.locator('#site-search').evaluate(el=>el.requestSubmit());await page.waitForFunction(id=>document.querySelector('.search-knowledge [data-suxiu]')?.dataset.suxiu===id,id);
  searches.push({query,guide:true,global:true,firstId:id});
  await page.goto(base+'#guide');await page.locator('[data-suxiu="suxiu"]').waitFor();
 }
 checks.push('12个关键词在知识手册和顶部搜索均找到预期首条记录，官方结果优先');
 await page.goto(base+'#guide/stitch-tao');await page.locator('[data-suxiu="stitch-tao"]').waitFor();await page.locator('[data-suxiu="stitch-tao"] summary').click();
 for(const id of ['pingtao','jitao','santao'])assert(await page.locator(`[data-suxiu="stitch-tao"] a[href="#guide/stitch-${id}"]`).isVisible());
 await page.locator('a[href="#guide/stitch-santao"]').click();await page.locator('[data-suxiu="stitch-santao"]').waitFor();assert.equal(await page.locator('#knowledge-search').inputValue(),'散套针');
 checks.push('套针分型关系可点击进入散套，稳定ID深链接可用');
 await page.goto(base+'#guide/process-main');await page.locator('[data-suxiu="process-main"]').waitFor();await page.locator('[data-suxiu="process-main"] summary').click();assert.equal(await page.locator('[data-suxiu="process-main"] ol li').count(),9);checks.push('完整九工序顺序可查看与跳转');
 await page.goto(base+'#guide/'+encodeURIComponent('乱针绣'));await page.locator('[data-suxiu="craft-random"]').waitFor();assert(await page.locator('[data-suxiu="branch-changzhou"]').count());
 assert((await page.locator('[data-suxiu="branch-changzhou"]').innerText()).includes('国家级扩展项目'));checks.push('乱针绣体系与常州扩展项目分别展示');
 await page.goto(base+'#search/'+encodeURIComponent('眼罩'));await page.locator('[href^="#product/"]').first().waitFor();await page.goto(base+'#search/'+encodeURIComponent('牡丹'));await page.locator('[data-pattern]').first().waitFor();checks.push('原文创与纹样搜索保留');
 await page.goto(base+'#guide/'+encodeURIComponent('套针'));await page.locator('[data-suxiu="stitch-tao"]').waitFor();assert((await page.locator('[data-practice]').first().innerText()).includes('非官方教程'));await page.screenshot({path:path.join(out,publicBase?'public-guide.png':'guide-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.goto(base+'#guide/standard-db');await page.locator('[data-suxiu="standard-db"]').waitFor();await page.locator('[data-suxiu="standard-db"] summary').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,publicBase?'public-guide-mobile.png':'guide-mobile.png'),fullPage:true});checks.push('390px标准长标题、来源链接与展开资料无横向溢出');
 await context.setOffline(true);await page.locator('#knowledge-search').fill('散套');await page.locator('[data-suxiu="stitch-santao"]').waitFor();await context.setOffline(false);checks.push('已加载后断网仍可搜索缓存资料');
 if(!publicBase){
  const failure=await browser.newContext();await failure.route('**/content/suxiu-knowledge.json',r=>r.fulfill({status:503,body:'unavailable'}));const p=await failure.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'#guide');await p.locator('[data-practice]').first().waitFor();assert((await p.locator('#knowledge-list').innerText()).includes('官方知识暂未载入'));await failure.unroute('**/content/suxiu-knowledge.json');await p.locator('#knowledge-search').fill('散套');await p.locator('[data-suxiu="stitch-santao"]').waitFor();await failure.close();checks.push('资料503时保留练习说明，恢复后可重试');
  const delayed=await browser.newContext();await delayed.route('**/content/suxiu-knowledge.json',async r=>{await new Promise(resolve=>setTimeout(resolve,1200));await r.continue()});const p2=await delayed.newPage();await p2.goto(base+'#guide');await p2.locator('#knowledge-search').waitFor();await p2.evaluate(()=>location.hash='#home');await p2.locator('.ivory-hero').waitFor();await p2.waitForLoadState('networkidle');assert(await p2.locator('.ivory-hero').count());await delayed.close();checks.push('慢速加载时切换首页不会被旧知识页覆盖');
 }
 assert.deepEqual(errors,[]);const report={ok:true,target:publicBase?'GitHub Pages':'local',searches,checks,errors};fs.writeFileSync(path.join(out,publicBase?'public-browser-report.json':'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.error(e);fs.writeFileSync(path.join(out,'failed-browser-report.json'),JSON.stringify({ok:false,error:e.stack,checks,searches,errors},null,2));process.exitCode=1}finally{await browser?.close();server?.close()}})();
