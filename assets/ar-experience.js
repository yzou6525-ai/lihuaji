import * as THREE from './vendor/three/build/three.module.js';
import {LayeredPattern} from './ar/LayeredPattern.js';
import {CraftOverlay} from './ar/CraftOverlay.js';
import {TrackingState} from './ar/TrackingState.js';

const $=s=>document.querySelector(s),post=data=>{if(parent!==window)parent.postMessage({scope:'lihua-ar',...data},location.origin);};
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

async function main(){
 const response=await fetch('./ar-assets/targets.json');if(!response.ok)throw Error('纹样目录暂未加载，请刷新重试。');
 const targets=await response.json();if(!targets.length)throw Error('没有可用的纹样。');
 const baseTargetCount=targets.length;let customIndex=-1;
 const requested=new URLSearchParams(location.search).get('target');
 let targetIndex=requested===null?Math.max(0,targets.findIndex(t=>t.id==='pear-blossom')):Math.min(targets.length-1,Math.max(0,Math.floor(Number(requested)||0)));
 let stream=null,controller=null,alive=true,epoch=0,mode='preview',found=false,consent=false,xrSession=null,hitSource=null,referenceSpace=null;
 let layered=null,visualIndex=-1,visualEpoch=0,pendingVisual=-1,view='appreciate',collapseDeadline=0,inputWidth=800,inputHeight=600,busy=false,drag=null;
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));$('#stage').append(renderer.domElement);renderer.domElement.setAttribute('aria-label','立体纹样，拖动旋转；看针模式可点选图层');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,4/3,.01,100);camera.position.z=2.15;
 scene.add(new THREE.HemisphereLight(0xffffff,0x777c57,2.4));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(2,3,5);scene.add(light);
 const anchor=new THREE.Group(),content=new THREE.Group(),legacy=new THREE.Group();scene.add(anchor);anchor.add(content);content.add(legacy);
 const hoop=new THREE.Mesh(new THREE.TorusGeometry(.53,.026,12,96),new THREE.MeshStandardMaterial({color:0xaf8550,roughness:.6}));legacy.add(hoop);
 const cloth=new THREE.Mesh(new THREE.CircleGeometry(.505,72),new THREE.MeshStandardMaterial({color:0xf9f5e9,side:THREE.DoubleSide,roughness:1}));legacy.add(cloth);
 const artwork=new THREE.Mesh(new THREE.PlaneGeometry(.78,.78),new THREE.MeshBasicMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false}));artwork.position.z=.008;legacy.add(artwork);
 const needle=new THREE.Mesh(new THREE.CylinderGeometry(.004,.008,.26,8),new THREE.MeshStandardMaterial({color:0xc6ced1,metalness:.8,roughness:.25}));needle.rotation.x=Math.PI/2;legacy.add(needle);
 const thread=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0x698b50}));legacy.add(thread);
 const reticle=new THREE.Mesh(new THREE.RingGeometry(.065,.078,40).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x629276,side:THREE.DoubleSide}));reticle.matrixAutoUpdate=false;reticle.visible=false;scene.add(reticle);
 const overlay=new CraftOverlay($('#craft-info')),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const tracking=new TrackingState({grace:700,onState:s=>{$('#tracking-state').textContent=s;document.body.dataset.tracking=s;},onFound:index=>{
   collapseDeadline=0;found=true;
   if(visualIndex===index){layered?.playExplosion();updateToggle();}
   else loadVisual(index,true).catch(e=>status(e.message,false));
   status('已识别 '+targets[index].name+' · 纹样跟随识别卡移动',true);
 },onLost:()=>{found=false;layered?.collapse();overlay.hide();collapseDeadline=performance.now()+340;status('请再次对准识别卡，纹样会重新展开。',false);}});
 function status(text,detected=found){$('#hint').textContent=text;post({type:'status',mode,detected,targetIndex,text});}
 function metadata(index){const data=targets[index];$('#pattern-title').textContent=data.name;$('#target').value=String(index);$('#marker').src=data.image;$('#marker').alt=data.name+'识别卡';$('#marker-download').href=data.image;$('#marker-download').download=data.id+'-识别卡'+(data.image.endsWith('.jpg')?'.jpg':'.png');$('#credit').textContent=data.credit||'';}
 function updateToggle(){$('#toggle-layers').textContent=layered?.expanded?'收拢':'展开';}
 function showLayers(){const list=$('#layer-list');list.replaceChildren();for(const [i,entry] of (layered?.entries||[]).entries()){const b=document.createElement('button');b.textContent=entry.definition.name||'图层';b.dataset.layer=String(i);b.setAttribute('aria-pressed','false');b.onclick=()=>{setView('craft');selectLayer(i);};list.append(b);}list.hidden=view==='appreciate';}
 function selectLayer(index){if(!layered)return;if(index<0){layered.clearHighlight();overlay.hide();}else{layered.highlightLayer(index);overlay.show(layered.entries[index]);}document.querySelectorAll('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.layer)===index)));}
 function setView(next){view=next;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));overlay.hide();layered?.clearHighlight();layered?.setExplodeAmount(view==='appreciate'?1:1.7);if(layered&&!layered.expanded)layered.playExplosion();$('#layer-list').hidden=view==='appreciate';document.querySelectorAll('[data-layer]').forEach(b=>b.setAttribute('aria-pressed','false'));$('#view-help').textContent={appreciate:'拖动欣赏层次，点击“解绣”细看构图。',explain:'各层拉开距离。选择下方名称，或进入“看针”点选画面。',craft:'点击花瓣、叶片或下方名称。点击画面空白处取消选择。'}[view];if(mode==='preview')content.rotation.set(-.2,view==='appreciate'?-.22:-.55,0);updateToggle();}
 async function loadVisual(index,open=true){
   const ticket=++visualEpoch;pendingVisual=index;targetIndex=index;metadata(index);
   layered?.dispose();layered=null;legacy.visible=false;$('#layer-tools').hidden=true;overlay.hide();
   const data=targets[index];let candidate=null;
   if(data.layers?.length){candidate=new LayeredPattern({reducedMotion,onWarning:text=>status(text)});const loaded=await candidate.load(data);if(!alive||ticket!==visualEpoch){candidate.dispose();return;}if(loaded){layered=candidate;layered.mount(content);showLayers();$('#layer-tools').hidden=false;$('#toggle-layers').disabled=false;layered.amount=view==='appreciate'?1:1.7;if(open)layered.playExplosion();}else candidate.dispose();}
   if(!layered){const texture=await new THREE.TextureLoader().loadAsync(data.artworkImage||data.image);if(!alive||ticket!==visualEpoch){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;artwork.material.map?.dispose();artwork.material.map=texture;artwork.material.needsUpdate=true;legacy.visible=true;}
   visualIndex=index;pendingVisual=-1;updateToggle();
 }
 function resize(){
   if(!alive||mode==='plane')return;
   const w=$('#stage').clientWidth,h=$('#stage').clientHeight;let rw=w,rh=h;
   if(mode==='preview'){camera.aspect=w/h;camera.updateProjectionMatrix();}
   else{const scale=Math.min(w/inputWidth,h/inputHeight);rw=inputWidth*scale;rh=inputHeight*scale;}
   renderer.setSize(Math.max(1,Math.round(rw)),Math.max(1,Math.round(rh)),false);renderer.domElement.style.width=rw+'px';renderer.domElement.style.height=rh+'px';
 }
 function animate(t,xrFrame){
   if(!alive)return;
   layered?.update(t);if(mode==='scan')tracking.tick(t);if(layered?.state==='active')tracking.active();
   if(collapseDeadline&&t>=collapseDeadline){anchor.visible=false;collapseDeadline=0;}
   if(legacy.visible){const a=t*.0012,x=Math.sin(a)*.27,y=Math.cos(a*1.3)*.26,z=.06+Math.sin(t*.006)*.13;needle.position.set(x,y,z);const p=thread.geometry.attributes.position;p.setXYZ(0,x,y,.018);p.setXYZ(1,x,y,z+.12);p.needsUpdate=true;}
   if(mode==='plane'&&xrFrame&&hitSource){const hits=xrFrame.getHitTestResults(hitSource);reticle.visible=hits.length>0;if(hits.length){const pose=hits[0].getPose(referenceSpace);if(pose)reticle.matrix.fromArray(pose.transform.matrix);}}
   renderer.render(scene,camera);
 }
 renderer.setAnimationLoop(animate);
 function closeInput(){epoch++;collapseDeadline=0;delete document.body.dataset.matched;tracking.reset();controller?.stopProcessVideo();controller?.dispose();controller?.worker?.terminate();controller=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('#camera').pause();$('#camera').srcObject=null;$('#camera').style.display='none';found=false;}
 function preview({open=true}={}){
   if(xrSession){xrSession.end();return;}closeInput();mode='preview';anchor.matrixAutoUpdate=true;anchor.position.set(0,0,0);anchor.quaternion.identity();anchor.scale.setScalar(1);anchor.visible=true;content.rotation.set(-.2,view==='appreciate'?-.22:-.55,0);camera.position.set(0,0,2.15);camera.quaternion.identity();camera.fov=40;camera.near=.01;camera.far=100;camera.updateProjectionMatrix();resize();
   if(open)layered?.playExplosion();updateToggle();$('#badge').textContent='3D 预览 · 摄像头未开启';status(layered?'拖动旋转，欣赏梨花逐层浮起；也可用示例图片验证识别。':'拖动旋转绣品。针线动作用于示意，真实针法请查看教学资料。',false);
 }
 async function setupController(width,height,input,current=epoch){
   const {Controller}=await import('./vendor/mindar/mindar-image.prod.js');if(!alive||current!==epoch)return null;
   let postMatrices=[];
   const ctl=new Controller({inputWidth:width,inputHeight:height,warmupTolerance:3,missTolerance:2,maxTrack:1,onUpdate:data=>{
     if(current!==epoch||data.type!=='updateMatrix'||!targets[data.targetIndex])return;
     const detected=data.worldMatrix!==null;
     const displayedIndex=targetIndex===customIndex&&data.targetIndex===2?customIndex:data.targetIndex;
     if(detected){if(tracking.target!==displayedIndex&&visualIndex!==displayedIndex&&pendingVisual!==displayedIndex){if(layered)layered.group.visible=false;legacy.visible=false;}
       anchor.matrix.fromArray(data.worldMatrix).multiply(postMatrices[data.targetIndex]);anchor.visible=true;content.rotation.set(0,0,0);targetIndex=displayedIndex;}
     tracking.observe(displayedIndex,detected,performance.now());
   }});controller=ctl;
   const response=await fetch('./ar-assets/targets.mind');if(!response.ok)throw Error('识别卡数据未加载，请使用 3D 预览或稍后重试。');
   const buffer=await response.arrayBuffer();if(!alive||current!==epoch)return null;
   const {dimensions}=ctl.addImageTargetsFromBuffer(buffer);if(dimensions.length!==baseTargetCount)throw Error('识别卡版本不一致，请刷新页面。');
   postMatrices=dimensions.map(([w,h])=>new THREE.Matrix4().compose(new THREE.Vector3(w/2,h/2,0),new THREE.Quaternion(),new THREE.Vector3(w,w,w)));
   anchor.matrixAutoUpdate=false;anchor.visible=false;camera.position.set(0,0,0);camera.quaternion.identity();camera.projectionMatrix.fromArray(ctl.getProjectionMatrix());camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();inputWidth=width;inputHeight=height;resize();await ctl.dummyRun(input);return {ctl,postMatrices};
 }
 async function scan(){
   if(!consent){status('请先勾选摄像头使用说明。',false);return;}
   if(!navigator.mediaDevices?.getUserMedia)throw Error('当前浏览器无法使用相机，请用 HTTPS 页面在系统浏览器打开，或使用示例识别。');
   closeInput();const current=epoch;mode='scan';status('正在请求摄像头权限…',false);
   const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:960},height:{ideal:720}},audio:false});
   if(!alive||current!==epoch||!consent){next.getTracks().forEach(t=>t.stop());return;}stream=next;
   const video=$('#camera');video.srcObject=stream;await video.play();video.width=video.videoWidth;video.height=video.videoHeight;if(!alive||current!==epoch)return;
   video.style.display='block';$('#badge').textContent='实时图像跟踪 · 画面不上传';status('正在准备识别，请稍候…',false);
   const runtime=await setupController(video.videoWidth,video.videoHeight,video,current);if(runtime&&current===epoch){status('请对准完整识别卡，保持光线均匀。',false);const task=runtime.ctl.processVideo(video);task?.catch?.(error=>{if(current===epoch)recover(error);});}
 }
 async function sample(){
   closeInput();const current=epoch;mode='sample';$('#badge').textContent='示例识别 · 摄像头未开启';status('正在匹配示例图片的真实特征…',false);
   const index=targetIndex,markerIndex=targets[index].trackingIndex??index,img=new Image();img.src=targets[index].image;await img.decode();if(!alive||current!==epoch)return;
   const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;const ctx=canvas.getContext('2d');ctx.fillStyle='#e9e7dc';ctx.fillRect(0,0,800,600);
   const scale=Math.min(520/img.width,460/img.height),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(800-w)/2,(600-h)/2,w,h);
   const runtime=await setupController(800,600,canvas,current);if(!runtime||current!==epoch)return;
   const features=await runtime.ctl.detect(canvas);if(current!==epoch)return;const match=await runtime.ctl.match(features.featurePoints,markerIndex);if(current!==epoch)return;
   if(!match.modelViewTransform)throw Error('这次示例匹配没有成功，可重试或继续 3D 预览。');
   anchor.matrix.fromArray(runtime.ctl.getWorldMatrix(match.modelViewTransform,markerIndex)).multiply(runtime.postMatrices[markerIndex]);anchor.visible=true;content.rotation.set(0,0,0);
   tracking.observe(index,true,performance.now());status('识别成功：'+targets[index].name+' · 真实图片特征匹配已触发展开',true);document.body.dataset.matched=String(index);
 }
 function recover(error){if(!alive)return;preview({open:false});status(error.name==='NotAllowedError'?'摄像头未获许可，已返回 3D 预览，可随时重试。':(error.message||'启动未完成，已返回 3D 预览。'),false);post({type:'error',message:error.message});}
 function setBusy(value){busy=value;$('#target').disabled=value;for(const id of ['preview','sample','cameraStart'])$('#'+id).disabled=value;$('.controls').setAttribute('aria-busy',String(value));}
 function guard(fn){return async()=>{if(busy)return;setBusy(true);try{await fn();}catch(error){recover(error);}finally{if(alive)setBusy(false);}};}
 $('#preview').onclick=guard(()=>preview());$('#sample').onclick=guard(sample);$('#cameraStart').onclick=guard(scan);$('#stop').onclick=()=>{preview();setBusy(false);};
 for(const [i,t] of targets.entries()){const option=document.createElement('option');option.value=String(i);option.textContent=t.name;$('#target').append(option);}
 $('#target').onchange=guard(async()=>{const index=Number($('#target').value);if(xrSession)await xrSession.end();preview({open:false});await loadVisual(index,true);preview({open:false});});
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
 $('#toggle-layers').onclick=()=>{if(!layered)return;overlay.hide();document.querySelectorAll('[data-layer]').forEach(b=>b.setAttribute('aria-pressed','false'));if(layered.expanded)layered.collapse();else layered.playExplosion();updateToggle();};
 const element=renderer.domElement;
 element.onpointerdown=e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};element.setPointerCapture(e.pointerId);};
 element.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved ||= Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>7;if(mode==='preview'&&drag.moved){content.rotation.y=Math.max(-1.15,Math.min(1.15,content.rotation.y+dx*.009));content.rotation.x=Math.max(-.9,Math.min(.9,content.rotation.x+dy*.009));}drag.x=e.clientX;drag.y=e.clientY;};
 element.onpointerup=e=>{if(drag&&!drag.moved&&view==='craft'&&layered&&anchor.visible){const r=element.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);selectLayer(layered.pick(raycaster));}drag=null;};element.onpointercancel=()=>drag=null;
 if(parent===window){$('#standalone-consent').hidden=false;$('#camera-consent').onchange=e=>{consent=e.target.checked;if(!consent&&(mode==='scan'||mode==='plane'||stream||xrSession))preview();};}
 async function importGenerated(data){
   const png=s=>typeof s==='string'&&s.length<2500000&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s);
   if(!data||!Array.isArray(data.layers)||data.layers.length!==5||!data.layers.every(l=>png(l.src))||!png(data.artworkImage))throw Error('作品图层数据无效');
   preview({open:false});const definition={id:'my-story',name:String(data.name||'我的故事纹样').slice(0,70),image:targets[2].image,trackingIndex:2,widthMeters:.16,artworkImage:data.artworkImage,credit:'此作品使用梨花识别卡作为定位载体，不是对生成图案本身的识别。五层为当代构图示意，真实工艺资料待补充。',layers:data.layers.map((l,i)=>({name:String(l.name).slice(0,30),src:l.src,depth:i*.035}))};
   if(customIndex<0){customIndex=targets.length;targets.push(definition);const o=document.createElement('option');o.value=customIndex;o.textContent='我的故事纹样';$('#target').append(o);}else targets[customIndex]=definition;
   await loadVisual(customIndex,true);if(!alive)return;preview({open:false});status('我的作品已进入绣境。扫描时请使用下方的梨花识别卡。',false);document.body.dataset.custom='1';post({type:'generated-ready'});
 }
 function message(e){if(e.origin!==location.origin||e.source!==parent||e.data?.scope!=='lihua-ar-host')return;if(e.data.type==='consent'){consent=e.data.value===true;if(!consent&&(mode==='scan'||mode==='plane'||stream||xrSession))preview();}if(e.data.type==='generated-pattern')guard(()=>importGenerated(e.data.pattern))();if(e.data.type==='stop')destroy();}window.addEventListener('message',message);
 async function plane(){
   if(!consent)throw Error('请先勾选摄像头使用说明。');if(!navigator.xr)throw Error('当前设备不支持平面 AR，可使用图像扫描。');
   closeInput();const current=epoch,session=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test'],optionalFeatures:['dom-overlay'],domOverlay:{root:document.body}});
   if(!alive||current!==epoch||!consent){await session.end();return;}xrSession=session;
   session.addEventListener('end',()=>{hitSource?.cancel();hitSource=null;xrSession=null;renderer.xr.enabled=false;reticle.visible=false;if(alive)preview();});
   try{renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local');await renderer.xr.setSession(session);mode='plane';anchor.visible=false;anchor.matrixAutoUpdate=true;anchor.scale.setScalar(targets[targetIndex].widthMeters||.16);
   referenceSpace=await session.requestReferenceSpace('local');const viewer=await session.requestReferenceSpace('viewer');hitSource=await session.requestHitTestSource({space:viewer});status('缓慢移动手机扫描桌面，看到圆环后轻触放置。',false);
   session.addEventListener('select',()=>{if(!reticle.visible)return;anchor.position.setFromMatrixPosition(reticle.matrix);anchor.quaternion.setFromRotationMatrix(reticle.matrix);content.rotation.set(-Math.PI/2,0,0);anchor.visible=true;layered?.playExplosion();updateToggle();});
   }catch(error){await session.end();throw error;}
 }
 if(navigator.xr){navigator.xr.isSessionSupported('immersive-ar').then(ok=>{if(!alive)return;$('#plane').disabled=!ok;$('#plane').textContent=ok?'扫描平面并放置':'本设备不支持平面 AR';}).catch(()=>$('#plane').textContent='本设备不支持平面 AR');}else $('#plane').textContent='本设备不支持平面 AR';$('#plane').onclick=guard(plane);
 const observer=new ResizeObserver(()=>{resize();post({type:'resize',height:document.body.getBoundingClientRect().height});});observer.observe($('#stage'));observer.observe(document.body);
 function destroy(){if(!alive)return;alive=false;closeInput();visualEpoch++;layered?.dispose();layered=null;xrSession?.end();observer.disconnect();window.removeEventListener('message',message);renderer.setAnimationLoop(null);scene.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});renderer.dispose();renderer.forceContextLoss();}
 window.addEventListener('pagehide',destroy,{once:true});
 renderer.domElement.addEventListener('webglcontextlost',e=>{if(!alive)return;e.preventDefault();closeInput();status('图形资源已暂停。请刷新页面恢复；也可下载识别卡稍后体验。',false);});
 await loadVisual(targetIndex,true);preview({open:false});setBusy(false);$('#stop').disabled=false;document.body.dataset.ready='1';post({type:'ready'});
 // Read-only local diagnostics never expose camera frames or user records.
 window.lihuaARDiagnostics=()=>({mode,targetIndex,visualIndex,tracking:tracking.state,found,layerCount:layered?.entries.length||0,playCount:layered?.playCount||0,layerState:layered?.state,z:layered?.entries.map(e=>e.mesh.position.z)||[],opacity:layered?.entries.map(e=>e.mesh.material.opacity)||[],rotation:content.rotation.toArray().slice(0,3),selected:layered?.selected??-1,resources:{...renderer.info.memory},pixelRatio:renderer.getPixelRatio(),cameraActive:!!stream?.active,alive});
}
main().catch(error=>{document.body.dataset.ready='error';$('#hint').textContent='3D 体验暂未启动。请在支持 WebGL 的系统浏览器中重新打开。';$('#fatal').hidden=false;$('#fatal').textContent=error.message;post({type:'error',message:error.message});});
