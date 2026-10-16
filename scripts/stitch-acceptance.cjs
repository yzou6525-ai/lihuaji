const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {serve}=require('./ar-local-server.cjs');
const out=process.env.STITCH_OUTPUT_DIR || path.resolve(__dirname,'../docs/stitch-lab/validation');fs.mkdirSync(out,{recursive:true});
(async()=>{let browser,server;const checks=[],errors=[],samples=[],queries=['苏绣 视频','姚惠芬','套针','滚针','打籽','梅花','蒋雪英'];const publicBase=process.env.STITCH_TEST_URL;
try{
 const local=publicBase?null:await serve();server=local?.server;const base=publicBase||local.base;
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:960}});page.on('pageerror',e=>errors.push(e.message));
 if(publicBase){page.setDefaultNavigationTimeout(120000);page.setDefaultTimeout(60000);}
 const goto=async()=>{await page.goto(base+'#ar',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.lihuaStitchDiagnostics?.().player.total===16&&!lihuaStitchDiagnostics().loading);await page.locator('#stitch-lab').scrollIntoViewIfNeeded();};
 const seek=async value=>page.locator('#lab-scrubber').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
 const diag=()=>page.evaluate(()=>lihuaStitchDiagnostics());
 const screenshot=async name=>page.locator('#stitch-lab').screenshot({path:path.join(out,name+'.png')});
 await goto();assert.equal((await diag()).render.vertices,0);await screenshot('01-initial');
 await page.locator('#lab-next').click();assert.equal((await diag()).player.position,1);await page.locator('#lab-previous').click();assert.equal((await diag()).player.position,0);
 await page.locator('#lab-play').click();await page.waitForFunction(()=>lihuaStitchDiagnostics().player.position>1);await page.locator('#lab-play').click();let stopped=(await diag()).player.position;await page.waitForTimeout(120);assert.equal((await diag()).player.position,stopped);
 for(const speed of ['0.5','1','1.5']){await page.locator('#lab-speed').selectOption(speed);assert.equal((await diag()).player.speed,Number(speed));}
 await seek(8.5);assert.equal((await diag()).render.vertices,54);await screenshot('02-mid-progress');
 await page.locator('#lab-points').check();assert.equal((await diag()).render.points,17);assert.equal((await diag()).render.pointsVisible,true);await screenshot('03-needle-points');
 await page.locator('#lab-points').uncheck();assert.equal((await diag()).render.pointsVisible,false);
 await seek(16);assert.equal((await diag()).render.vertices,96);await seek(8);assert.equal((await diag()).render.vertices,48);await seek(0);assert.equal((await diag()).render.vertices,0);
 // Full-to-backward-to-forward must restore complete vertices after a partial segment.
 await seek(8.5);await seek(16);assert.equal((await diag()).render.vertices,96);
 await page.locator('#lab-play').click();await page.waitForFunction(()=>lihuaStitchDiagnostics().player.position>0&&lihuaStitchDiagnostics().player.position<2);await page.locator('#lab-play').click();
 await page.locator('#lab-restart').click();await page.waitForFunction(()=>lihuaStitchDiagnostics().player.playing);await page.locator('#lab-play').click();
 checks.push('play/pause/next/previous/restart、三档速度、0/中间/100%进度、回退消失、部分针段与针落点开关');
 for(const [id,count,shot,knowledge] of [['demo-tao-basic',24,'04-tao','stitch-tao'],['demo-gun-basic',20,'05-gun','stitch-gun']]){
   await page.locator('#lab-demo').selectOption(id);await page.waitForFunction(id=>lihuaStitchDiagnostics().player.id===id&&!lihuaStitchDiagnostics().loading,id);await seek(count);await page.locator('#lab-knowledge a').waitFor();assert.equal(await page.locator('#lab-knowledge a').getAttribute('href'),'#guide/'+knowledge);await screenshot(shot);
 }
 checks.push('三套数据载入成功，套针/滚针知识档案直接引用正式知识库');
 await page.locator('#lab-knowledge a').click();await page.locator('[data-suxiu="stitch-gun"]').waitFor();assert.equal((await diag()).alive,false);assert.equal((await diag()).player.pendingFrame,false);assert.equal((await diag()).render.disposed,true);
 await goto();await page.locator('#lab-demo').selectOption('demo-santao-pear-petal');
 await page.waitForFunction(()=>lihuaStitchDiagnostics().player.total===56&&!lihuaStitchDiagnostics().loading);
 assert.equal(await page.locator('#lab-demo option').count(),4);
 assert((await page.locator('#lab-authenticity').innerText()).includes('并非某件历史苏绣作品的逐针复原，未经苏绣专家人工审定'));
 assert.equal(await page.locator('#lab-color-note').innerText(),'批次颜色与高亮仅用于数字结构区分，不代表真实苏绣丝线配色。');
 for(const [n,label,shot] of [[28,'第一批 · 出边','08-santao-batch1'],[42,'第二批 · 套入','09-santao-batch2'],[56,'第三批 · 相嵌','10-santao-batch3']]){
   await seek(n);assert.equal((await diag()).render.vertices,n*6);assert.equal(await page.locator('#lab-batch').innerText(),label);await screenshot(shot);
 }
 for(const [n,label] of [[28.1,'第二批 · 套入'],[42.1,'第三批 · 相嵌'],[28,'第一批 · 出边']]){await seek(n);assert.equal(await page.locator('#lab-batch').innerText(),label);}
 await seek(56);await page.locator('#lab-points').check();assert.equal((await diag()).render.points,112);await screenshot('11-santao-points');
 await seek(28);await page.locator('#lab-next').click();assert.equal((await diag()).player.position,29);assert.equal(await page.locator('#lab-batch').innerText(),'第二批 · 套入');await page.locator('#lab-previous').click();assert.equal((await diag()).player.position,28);
 for(const speed of ['0.5','1','1.5']){await page.locator('#lab-speed').selectOption(speed);assert.equal((await diag()).player.speed,Number(speed));}
 await seek(55.95);await page.locator('#lab-play').click();await page.waitForFunction(()=>lihuaStitchDiagnostics().player.position===56&&!lihuaStitchDiagnostics().player.playing);
 await page.locator('#lab-restart').click();await page.waitForFunction(()=>lihuaStitchDiagnostics().player.position>0);await page.locator('#lab-play').click();
 await page.locator('#lab-knowledge a').waitFor();assert.equal(await page.locator('#lab-knowledge a').getAttribute('href'),'#guide/stitch-santao');
 await page.locator('#lab-knowledge a').click();await page.locator('[data-suxiu="stitch-santao"]').waitFor();assert.equal((await diag()).render.disposed,true);
 checks.push('散套56针：28/42/56截图、28.1/42.1标签、112针落点、逐针/三档速度/自动结束/重播暂停、正式散套档案及真实性文案');
 await goto();await page.locator('#lab-points').check();await seek(16);const resource=(await diag()).render.resources;
 for(let i=0;i<4;i++){
   for(const id of ['demo-tao-basic','demo-gun-basic','demo-santao-pear-petal','demo-straight-basic']){await page.locator('#lab-demo').selectOption(id);await page.waitForFunction(id=>lihuaStitchDiagnostics().player.id===id&&!lihuaStitchDiagnostics().loading,id);await seek(10);}
   assert(await page.locator('#lab-batch').isHidden());assert(await page.locator('#lab-color-note').isHidden());
   const state=await diag();assert.deepEqual(state.render.resources,resource);samples.push({cycle:i,resources:state.render.resources});
 }
 for(let i=0;i<3;i++){
   await page.locator('#lab-play').click();await page.waitForFunction(()=>lihuaStitchDiagnostics().player.playing);await page.evaluate(()=>location.hash='#home');await page.locator('.ivory-hero').waitFor();
   const d=await diag();assert(!d.alive);assert(!d.player.pendingFrame);assert.equal(d.render.resources.geometries,0);assert.equal(d.render.resources.textures,0);samples.push({exit:i,resources:d.render.resources});await goto();
 }
 checks.push('16次四套数据切换几何/纹理数量不增长，旧练习无散套标签残留；3次播放中离页RAF取消、几何/纹理计数归零');
 await page.locator('[data-video="suzhou-craft-background"]').waitFor();assert.equal(await page.locator('#official-videos [data-video]').count(),6);
 const links=await page.locator('#official-videos [data-video] a').evaluateAll(all=>all.map(a=>({url:a.href,target:a.target,rel:a.rel})));
 assert(links.every(x=>x.url.startsWith('https:')&&x.target==='_blank'&&x.rel.includes('noopener')));
 assert.equal(await page.locator('#official-videos video,#official-videos iframe,#official-videos img').count(),0);
 await page.locator('#official-videos').screenshot({path:path.join(out,'06-official-archive.png')});
 checks.push('4个视频、1门课程、1条延伸阅读，仅外链，无视频元素、iframe或第三方封面');
 for(const query of queries){await page.goto(base+'#search/'+encodeURIComponent(query));await page.locator('[data-video]').first().waitFor();assert((await page.locator('#main').innerText()).includes('官方影像'));}
 checks.push('7个指定查询命中官方影像，原知识搜索结果并存');
 await page.setViewportSize({width:390,height:844});await goto();await page.locator('#lab-demo').selectOption('demo-tao-basic');await page.waitForFunction(()=>lihuaStitchDiagnostics().player.id==='demo-tao-basic');await seek(12);await page.locator('#lab-points').check();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('#stitch-lab').evaluate(el=>el.scrollIntoView({block:'start'}));
 await page.screenshot({path:path.join(out,'07-mobile-390.png')});
 await page.locator('#lab-next').click();await page.locator('#lab-previous').click();await page.locator('#lab-play').click();await page.waitForFunction(()=>lihuaStitchDiagnostics().player.playing);await page.locator('#lab-play').click();
 await page.locator('#official-videos').scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks.push('390×844手机视口控制可操作，实验室/官方影像均无横向溢出');
 await page.locator('#lab-demo').selectOption('demo-santao-pear-petal');await page.waitForFunction(()=>lihuaStitchDiagnostics().player.total===56&&!lihuaStitchDiagnostics().loading);await page.locator('#lab-points').uncheck();await seek(56);
 await page.locator('#stitch-lab').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'12-santao-mobile.png')});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('#lab-previous').click();assert.equal((await diag()).player.position,55);await page.locator('#lab-next').click();assert.equal((await diag()).player.position,56);
 await seek(28);await page.locator('#lab-play').click();await page.waitForFunction(()=>lihuaStitchDiagnostics().player.position>28);await page.locator('#lab-play').click();assert(!(await diag()).player.playing);
 await page.locator('#lab-points').check();assert((await diag()).render.pointsVisible);await page.locator('#lab-speed').selectOption('0.5');assert.equal((await diag()).player.speed,.5);
 checks.push('散套390×844截图、进度/逐针/播放暂停/调速/针落点可操作，无横向溢出（非实体手机）');
 if(!publicBase){
   const broken=await browser.newPage();broken.on('pageerror',e=>errors.push(e.message));await broken.route('**/stitch-demos/demo-straight-basic.json',r=>r.fulfill({status:200,contentType:'application/json',body:'{"broken":'}));await broken.goto(base+'#ar');await broken.getByText('针迹 JSON 损坏，请选择其他练习。').waitFor();await broken.locator('[data-learn]').first().waitFor();await broken.locator('#lab-demo').selectOption('demo-tao-basic');await broken.waitForFunction(()=>lihuaStitchDiagnostics().player.total===24);await broken.close();
   const unavailable=await browser.newPage();await unavailable.route('**/stitch/StitchRenderer.js',r=>r.abort());await unavailable.goto(base+'#ar');await unavailable.getByText('Three.js 或 WebGL 未能启动', {exact:false}).waitFor();await unavailable.locator('[data-video]').first().waitFor();await unavailable.close();
   const noVideo=await browser.newPage();noVideo.on('pageerror',e=>errors.push(e.message));await noVideo.route('**/stitch-video-sources.json',r=>r.fulfill({status:503,body:'offline'}));await noVideo.goto(base+'#ar');await noVideo.getByText('官方影像目录暂未载入，原有练习仍可使用。').waitFor();await noVideo.unroute('**/stitch-video-sources.json');await noVideo.getByText('重新加载影像目录').click();await noVideo.locator('[data-video]').first().waitFor();await noVideo.close();
   const delayed=await browser.newPage();await delayed.route('**/stitch-demos/*.json',async r=>{await new Promise(resolve=>setTimeout(resolve,800));await r.continue().catch(()=>{});});await delayed.goto(base+'#ar');await delayed.locator('#lab-demo').waitFor();await delayed.evaluate(()=>location.hash='#home');await delayed.locator('.ivory-hero').waitFor();await delayed.waitForTimeout(1000);assert.equal(await delayed.locator('#stitch-lab').count(),0);assert(!(await delayed.evaluate(()=>lihuaStitchDiagnostics())).alive);await delayed.close();
   checks.push('损坏JSON不影响原练习且可换练习恢复；Three模块失败有提示；影像503可重试；慢加载离页不会复活');
 }
 assert.deepEqual(errors,[]);const report={ok:true,target:publicBase?'GitHub Pages':'local',checks,resourceSamples:samples,queries,links,errors,limits:['移动测试为桌面浏览器390×844视口，不等于实体手机全机型验证','外部来源仅核验网页/公开目录；未播放或下载第三方视频']};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.error(e);fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({ok:false,error:e.stack,checks,errors},null,2));process.exitCode=1;}finally{await browser?.close();server?.close();}})();
