const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {serve}=require('./ar-local-server.cjs');
(async()=>{const {server,base}=await serve();let browser;const errors=[],checks=[];
try{
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['home','library','create','gallery','game','guide','palette','profile','about','face']){
  await page.goto(base+'#'+route);await page.locator('#main h1').waitFor();
  assert(await page.locator('#main').innerText());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' overflow');checks.push(route+' 手机布局与页面载入');
  if(route==='library'){assert((await page.locator('#pattern-count').innerText()).includes('774'));await page.locator('#pattern-kind').selectOption('basic');assert((await page.locator('#pattern-count').innerText()).includes('270'));}
  if(route==='game'){assert.equal(await page.locator('[data-card]').count(),12);await page.locator('[data-card="0"]').click();await page.locator('[data-card="0"] img').waitFor();assert(await page.locator('[data-card="0"] img').evaluate(i=>i.complete&&i.naturalWidth>0));}
 }
 await page.goto(base+'assets/ar-experience.html');await page.waitForFunction(()=>document.body.dataset.ready==='1');await page.waitForFunction(()=>lihuaARDiagnostics().layerState==='active');
 // Warm both render paths: Three.js allocates the five legacy geometries only on their first render.
 await page.locator('#target').selectOption('0');await page.waitForFunction(()=>lihuaARDiagnostics().visualIndex===0);await page.locator('#target').selectOption('2');await page.waitForFunction(()=>lihuaARDiagnostics().visualIndex===2&&lihuaARDiagnostics().layerState==='active');const baseline=await page.evaluate(()=>lihuaARDiagnostics().resources);
 for(let i=0;i<3;i++){await page.locator('#target').selectOption('0');await page.waitForFunction(()=>lihuaARDiagnostics().visualIndex===0);await page.locator('#target').selectOption('2');await page.waitForFunction(()=>lihuaARDiagnostics().visualIndex===2&&lihuaARDiagnostics().layerState==='active');}
 // The legacy image texture remains cached once; repeated target changes must not accumulate textures.
 const first=await page.evaluate(()=>lihuaARDiagnostics().resources);assert.equal(first.geometries,baseline.geometries);assert(first.textures<=baseline.textures);checks.push('两种渲染方式预热后多次切换单图与分层目标，几何与纹理数量均不增长');
 const partial=await browser.newPage();partial.on('pageerror',e=>errors.push(e.message));await partial.route('**/layer_02_leaf.png',r=>r.fulfill({status:404,body:'missing'}));await partial.goto(base+'assets/ar-experience.html');await partial.waitForFunction(()=>document.body.dataset.ready==='1');assert.equal(await partial.evaluate(()=>lihuaARDiagnostics().layerCount),5);await partial.locator('#toggle-layers').click();await partial.waitForFunction(()=>lihuaARDiagnostics().layerState==='collapsed');assert((await partial.evaluate(()=>lihuaARDiagnostics().z)).every(z=>z===0));checks.push('单层缺图仍可显示其余五层并正常收拢');
 assert.deepEqual(errors,[]);const report={ok:true,checks,errors};fs.writeFileSync(require('node:path').resolve(__dirname,'../../delivery/ar-layered-2026-10-09/site-regression.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server.close();}
})();
