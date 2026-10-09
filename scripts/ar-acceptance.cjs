const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {serve}=require('./ar-local-server.cjs');
const out=path.resolve(__dirname,'../../delivery/ar-layered-2026-10-09');fs.mkdirSync(out,{recursive:true});
(async()=>{const {server,base}=await serve();let browser;const errors=[],checks=[];
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1200,height:1050}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(30000);const url=base+'assets/ar-experience.html';
  await page.goto(url);await page.waitForFunction(()=>document.body.dataset.ready==='1');await page.waitForFunction(()=>lihuaARDiagnostics().layerState==='active');
  let d=await page.evaluate(()=>lihuaARDiagnostics());assert.equal(d.layerCount,6);assert.equal(d.targetIndex,2);assert(d.z[5]>.14);assert(d.pixelRatio<=1.5);
  await page.screenshot({path:out+'/desktop-appreciate.png',fullPage:true});checks.push('六张梨花图层在 /lihuaji/ 子路径加载并顺序展开');
  const resources=d.resources;
  for(let i=0;i<4;i++){await page.locator('#toggle-layers').click();await page.waitForFunction(()=>lihuaARDiagnostics().layerState==='collapsed');assert((await page.evaluate(()=>lihuaARDiagnostics().z)).every(z=>z===0));await page.locator('#toggle-layers').click();await page.waitForFunction(()=>lihuaARDiagnostics().layerState==='active');}
  d=await page.evaluate(()=>lihuaARDiagnostics());assert.deepEqual(d.resources,resources);checks.push('四次展开收拢后图层全部归零，Three.js几何与纹理数量不增长');
  await page.locator('[data-view=explain]').click();await page.waitForFunction(()=>lihuaARDiagnostics().z[5]>.25);assert.equal(await page.locator('[data-layer]').count(),6);
  await page.screenshot({path:out+'/desktop-explain.png',fullPage:true});
  await page.locator('[data-layer="2"]').click();await page.waitForFunction(()=>lihuaARDiagnostics().opacity[0]===.15);assert.equal((await page.evaluate(()=>lihuaARDiagnostics())).selected,2);assert((await page.locator('#craft-info').innerText()).includes('资料待补充'));
  const point=await page.evaluate(async()=>{const THREE=await import('./vendor/three/build/three.module.js');const d=lihuaARDiagnostics(),r=document.querySelector('canvas').getBoundingClientRect(),camera=new THREE.PerspectiveCamera(40,r.width/r.height,.01,100);camera.position.z=2.15;camera.updateMatrixWorld();const p=new THREE.Vector3(659/1024-.5,.5-201/1024,.15*1.7);p.applyEuler(new THREE.Euler(...d.rotation));p.project(camera);return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};});
  await page.mouse.click(point.x,point.y);await page.waitForFunction(()=>lihuaARDiagnostics().selected===5);
  const bounds=await page.locator('#stage canvas').boundingBox();await page.mouse.click(bounds.x+bounds.width-8,bounds.y+bounds.height/2);assert.equal((await page.evaluate(()=>lihuaARDiagnostics())).selected,-1);
  checks.push('解绣拉开1.7倍；看针可按名称与真实Raycaster透明像素拾取，空白处取消');
  await page.locator('#cameraStart').click();assert((await page.locator('#hint').innerText()).includes('勾选'));assert.equal((await page.evaluate(()=>lihuaARDiagnostics())).cameraActive,false);
  await page.evaluate(()=>{window.__requests=0;navigator.mediaDevices.getUserMedia=async()=>{window.__requests++;throw new DOMException('denied for acceptance','NotAllowedError');};});await page.locator('#camera-consent').check();await page.locator('#cameraStart').click();await page.waitForFunction(()=>lihuaARDiagnostics().mode==='preview');assert((await page.locator('#hint').innerText()).includes('未获许可'));assert.equal(await page.evaluate(()=>window.__requests),1);
  checks.push('未同意不请求摄像头；权限拒绝可回到可用3D预览');
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>window.__grantCamera=()=>{window.__lateStream=document.createElement('canvas').captureStream();resolve(window.__lateStream);});});
  await page.locator('#cameraStart').click();await page.waitForFunction(()=>typeof window.__grantCamera==='function');await page.locator('#camera-consent').uncheck();await page.evaluate(()=>window.__grantCamera());
  await page.waitForFunction(()=>window.__lateStream.getTracks().every(t=>t.readyState==='ended'));assert.equal(await page.evaluate(()=>lihuaARDiagnostics().mode),'preview');checks.push('等待授权时撤回相机同意，延迟返回的媒体流也立即关闭');
  for(const index of [2,0,1]){
   await page.goto(url+'?target='+index);await page.waitForFunction(()=>document.body.dataset.ready==='1');await page.locator('#sample').click();
   await page.waitForFunction(i=>document.body.dataset.matched===String(i),index,{timeout:180000});
   assert((await page.locator('#hint').innerText()).includes('真实图片特征匹配'));await page.screenshot({path:out+'/recognition-'+index+'.png',fullPage:true});
   await page.locator('#preview').click();await page.waitForFunction(()=>lihuaARDiagnostics().mode==='preview');
  }
  checks.push('梨花、原眼罩、原莲花三张目标均由实际MindAR特征匹配成功');
  await page.setViewportSize({width:390,height:844});await page.goto(url);await page.waitForFunction(()=>document.body.dataset.ready==='1');await page.waitForFunction(()=>lihuaARDiagnostics().layerState==='active');
  await page.locator('[data-view=craft]').click();await page.locator('[data-layer="4"]').click();await page.waitForFunction(()=>lihuaARDiagnostics().opacity[0]===.15);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/mobile-craft.png',fullPage:true});
  await page.locator('#marker-card summary').click();const downloadPromise=page.waitForEvent('download');await page.locator('#marker-download').click();assert((await downloadPromise).suggestedFilename().endsWith('.png'));checks.push('390px手机无横向溢出、工艺信息可读且识别卡可下载');
  await page.goto(base+'#ar');const frame=page.frameLocator('#ar-frame');await frame.locator('body[data-ready="1"]').waitFor();assert(await frame.locator('#standalone-consent').isHidden());
  await frame.locator('#marker-card summary').click();await page.waitForFunction(()=>{const f=document.querySelector('#ar-frame');return f.clientHeight>=f.contentDocument.body.getBoundingClientRect().height;});
  await page.locator('[data-learn]').first().click();await page.goto(base+'#home');await page.waitForLoadState('networkidle');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks.push('原网站iframe可自适应高度、相机授权来自父页面，原学习记录和首页可用');
  // Camera path uses a synthetic stream containing the actual marker, never a physical camera or personal image.
  await page.goto(url);await page.waitForFunction(()=>document.body.dataset.ready==='1');await page.evaluate(async()=>{
   const image=new Image();image.src='./ar-assets/markers/pear-blossom.png';await image.decode();const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;const ctx=canvas.getContext('2d');
   window.__markerPaint=show=>{ctx.fillStyle='#e9e7dc';ctx.fillRect(0,0,800,600);if(show)ctx.drawImage(image,170,70,460,460);};window.__markerPaint(true);window.__fakeStream=canvas.captureStream(12);
   window.__paintTimer=setInterval(()=>window.__markerPaint(window.__showMarker!==false),80);navigator.mediaDevices.getUserMedia=async constraints=>{if(constraints.audio!==false)throw Error('Audio requested');return window.__fakeStream;};
  });
  await page.locator('#camera-consent').check();await page.locator('#cameraStart').click();await page.waitForFunction(()=>lihuaARDiagnostics().found,{timeout:180000});await page.waitForFunction(()=>lihuaARDiagnostics().tracking==='ACTIVE');
  const opens=await page.evaluate(()=>lihuaARDiagnostics().playCount);await page.waitForTimeout(1300);assert.equal(await page.evaluate(()=>lihuaARDiagnostics().playCount),opens);
  await page.evaluate(()=>window.__showMarker=false);await page.waitForFunction(()=>lihuaARDiagnostics().tracking==='LOST',{timeout:60000});await page.evaluate(()=>window.__showMarker=true);await page.waitForFunction(()=>lihuaARDiagnostics().found,{timeout:60000});assert.equal(await page.evaluate(()=>lihuaARDiagnostics().playCount),opens+1);
  await page.locator('#stop').click();assert(await page.evaluate(()=>window.__fakeStream.getTracks().every(t=>t.readyState==='ended')));await page.evaluate(()=>clearInterval(window.__paintTimer));checks.push('合成相机流经过真实追踪：持续识别只展开一次、长丢失后重现再展开、关闭释放轨道');
  const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const rp=await reduced.newPage();rp.on('pageerror',e=>errors.push(e.message));await rp.goto(url);await rp.waitForFunction(()=>document.body.dataset.ready==='1');assert.equal(await rp.evaluate(()=>lihuaARDiagnostics().layerState),'active');await reduced.close();checks.push('减少动态效果偏好下仍可直接查看完整分层');
  const fallback=await browser.newContext();const fp=await fallback.newPage();fp.on('pageerror',e=>errors.push(e.message));await fp.route('**/layer_*.png',r=>r.fulfill({status:404,body:'missing'}));await fp.goto(url);await fp.waitForFunction(()=>document.body.dataset.ready==='1');assert.equal(await fp.evaluate(()=>lihuaARDiagnostics().layerCount),0);assert(await fp.locator('#layer-tools').isHidden());await fallback.close();checks.push('全部分层纹理加载失败时回退原单图3D预览');
  assert.deepEqual(errors,[]);const report={ok:true,checks,errors,physicalAndroid:'未真机验证',physicalIPhone:'未真机验证',physicalWebXR:'未真机验证',cameraScope:'真实MindAR算法+合成Canvas媒体流，不是物理摄像头真机验收'};fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(e){fs.writeFileSync(out+'/report.json',JSON.stringify({ok:false,checks,errors,error:e.stack},null,2));console.error(e);process.exitCode=1;}
 finally{await browser?.close();server.close();}
})();
