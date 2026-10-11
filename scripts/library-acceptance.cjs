// Playwright uses the project's existing Node test runtime; no browser dependency is shipped.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {serve}=require('./ar-local-server.cjs');
const root=path.resolve(__dirname,'..'),catalog=JSON.parse(fs.readFileSync(path.join(root,'content/patterns.json'),'utf8'));
const batch=catalog.filter(p=>p.batch==='museum-2026-10-11');
const out=path.join(root,'docs/library-2026-10-11');
async function loadVisibleCatalogue(page){
 const images=page.locator('#patterns img');
 for(let i=0;i<await images.count();i++){
  const img=images.nth(i);await img.scrollIntoViewIfNeeded();
  await img.evaluate(el=>el.decode());
 }
 await page.evaluate(()=>scrollTo(0,0));
}
(async()=>{let browser,server;const errors=[],checks=[];const publicBase=process.env.LIBRARY_TEST_URL;
try{
 const local=publicBase?null:await serve();server=local?.server;const base=publicBase||local.base;
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));const response=await page.goto(base+'#library');assert.equal(response.status(),200);await page.locator('#pattern-count').waitFor();
 assert((await page.locator('#pattern-count').innerText()).includes(`找到${catalog.length}份`));
 assert.equal(await page.locator('[data-pattern]').count(),24);checks.push('统一纹样库数量与分页正确');
 await page.locator('#pattern-search').fill('museum-2026-10-11');assert((await page.locator('#pattern-count').innerText()).includes(`找到${batch.length}份`));
 await loadVisibleCatalogue(page);await page.screenshot({path:path.join(out,publicBase?'public-library.png':'library-desktop.png'),fullPage:true});
 // Decode every new image, including images on pages not yet visited. Limit concurrency to eight.
 const files=batch.flatMap(p=>[p.thumbnail,p.image]);
 const failures=await page.evaluate(async paths=>{const bad=[];for(let n=0;n<paths.length;n+=8)await Promise.all(paths.slice(n,n+8).map(src=>new Promise(resolve=>{const img=new Image();const timer=setTimeout(()=>{bad.push(src+' timeout');resolve();},25000);img.onload=()=>{clearTimeout(timer);if(!img.naturalWidth)bad.push(src);resolve();};img.onerror=()=>{clearTimeout(timer);bad.push(src);resolve();};img.src=src;})));return bad;},files);
 assert.deepEqual(failures,[]);checks.push(`${files.length}张新增展示图及缩略图实际解码成功`);
 for(const region of new Set(batch.map(p=>p.region))){await page.locator('#pattern-region').selectOption(region);const count=batch.filter(p=>p.region===region).length;assert((await page.locator('#pattern-count').innerText()).includes(`找到${count}份`));}
 checks.push('九个文化地区筛选数量正确');await page.locator('#pattern-region').selectOption('');
 for(const kind of ['basic','archive']){await page.locator('#pattern-kind').selectOption(kind);assert((await page.locator('#pattern-count').innerText()).includes(`找到${batch.filter(p=>p.collection===kind).length}份`));}
 await page.locator('#pattern-kind').selectOption('');await page.locator('#pattern-search').fill(batch[0].accession);
 await page.locator(`[data-pattern="${batch[0].id}"]`).click();await page.locator('.pattern-source-details summary').click();
 const details=await page.locator('#modal-body').innerText();assert(details.includes(batch[0].originalTitle)&&details.includes(batch[0].accession)&&details.includes('CC0'));
 assert.equal(await page.locator('#modal-body a').filter({hasText:'原始出处'}).getAttribute('href'),batch[0].sourceUrl);
 checks.push('馆藏编号检索、原作资料、出处和许可详情可用');
 await page.locator('#modal-body a').filter({hasText:'以此纹样练习转稿'}).click();await page.locator('#source-preview').waitFor();
 assert((await page.locator('#source-preview').getAttribute('src')).endsWith(batch[0].image));await page.locator('#create-form input[type=checkbox]').check();await page.locator('#generate').click();await page.locator('#save-svg').waitFor();
 const waiting=page.waitForEvent('download');await page.locator('#save-svg').click();const download=await waiting;assert(download.suggestedFilename().endsWith('.svg'));const downloadedPath=await download.path();const svg=fs.readFileSync(downloadedPath,'utf8');assert(svg.includes(batch[0].sourceUrl)&&svg.includes('CC0'));
 checks.push('新纹样进入现有译绣并实际下载带来源的SVG');
 await page.goto(base+'#library');await page.locator('#pattern-count').waitFor();await page.setViewportSize({width:390,height:844});await page.locator('#pattern-search').fill('museum-2026-10-11');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await loadVisibleCatalogue(page);await page.screenshot({path:path.join(out,publicBase?'public-library-mobile.png':'library-mobile.png'),fullPage:true});checks.push('390px手机布局无横向溢出，滚动载入的卡片图片正常');
 // Deterministically choose the first records of each collection; both are newly imported.
 await page.evaluate(()=>{Math.random=()=>0.99999;location.hash='#game';});await page.locator('[data-card]').first().waitFor();
 assert.equal(await page.locator('[data-card]').count(),12);await page.locator('[data-card="0"]').click();await page.locator('[data-card="0"] img').waitFor();const gameImage=await page.locator('[data-card="0"] img').getAttribute('src');assert(batch.some(p=>p.thumbnail===gameImage));checks.push('祥云配对挑战直接使用统一目录中的新增图片');
 assert.deepEqual(errors,[]);const report={ok:true,target:publicBase?'GitHub Pages':'local',total:catalog.length,added:batch.length,checks,errors};fs.writeFileSync(path.join(out,publicBase?'public-report.json':'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server?.close();}})();
