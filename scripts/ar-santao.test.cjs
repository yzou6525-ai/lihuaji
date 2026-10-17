const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('AR and Lab share one visual, one timeline and one 56-stitch asset; target compiler bytes unchanged',()=>{
 for(const file of ['assets/stitch/SantaoExperience.js','assets/ar/SantaoARAdapter.js']){const s=read(file);assert(s.includes("SantaoVisual.js"));assert(s.includes('SantaoTimeline.js'));assert(!s.includes('new THREE.WebGLRenderer'));assert(!s.includes('new THREE.Scene'));assert(!s.includes('requestAnimationFrame'));}
 assert.equal((read('assets/ar-experience.js').match(/new THREE.WebGLRenderer/g)||[]).length,1);assert.equal((read('assets/ar-experience.js').match(/setAnimationLoop\(animate\)/g)||[]).length,1);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets/ar-assets/targets.mind'))).digest('hex'),'4f1d11dcc9d3b07dbe66092f7e94e4ab2b04595eba0310b898f621ab3875c1b8');
 const data=JSON.parse(read('content/stitch-demos/demo-santao-pear-petal.json'));assert.deepEqual(data.batches.map(b=>b.count),[28,14,14]);assert.equal(data.knowledgeId,'stitch-santao');
 const targets=JSON.parse(read('assets/ar-assets/targets.json'));assert.deepEqual(targets.map(t=>t.id),['embroidered-eye-mask','lotus','pear-blossom']);assert(!targets[0].craftExperiences&&!targets[1].craftExperiences);const entry=targets[2].craftExperiences[0];assert.equal(entry.layerIndex,4);assert(entry.hotspot.u>0&&entry.hotspot.u<1&&entry.hotspot.v>0&&entry.hotspot.v<1);assert(entry.transform.z<.01);
});
test('internal and manual clocks produce identical states for all 11 seconds, with no manual RAF',async()=>{
 const {SantaoTimeline}=await import('../assets/stitch/SantaoTimeline.js');let now=0,callback;
 const internal=new SantaoTimeline({now:()=>now,requestFrame:cb=>{callback=cb;return 1;},cancelFrame:()=>{callback=null;}});
 const manual=new SantaoTimeline({clockMode:'manual',now:()=>now,requestFrame:()=>assert.fail('manual RAF')});internal.start();manual.start();
 for(now=100;now<=11000;now+=100){callback?.(now);manual.tick(now);const {pendingFrame:a,...one}=internal.state,{pendingFrame:b,...two}=manual.state;assert.deepEqual(one,two);assert.equal(b,false);}
 manual.seek(5);assert.equal(manual.time,5);manual.resume();now+=500;manual.tick(now);assert.equal(manual.time,5.5);manual.dispose();manual.tick(now+500);assert.equal(manual.time,5.5);
});
test('tracking pauses retain time, only automatic pauses resume; manual intent wins',async()=>{
 const {SantaoARAdapter}=await import('../assets/ar/SantaoARAdapter.js'),{SantaoTimeline}=await import('../assets/stitch/SantaoTimeline.js');let now=0;
 const adapter=Object.create(SantaoARAdapter.prototype);Object.assign(adapter,{disposed:false,trackingAvailable:true,pausedByTracking:false,timeline:new SantaoTimeline({clockMode:'manual',now:()=>now})});
 adapter.start();now=5000;adapter.timeline.tick(now);adapter.trackingLost();assert.equal(adapter.timeline.time,5);assert(adapter.pausedByTracking);now=9000;adapter.timeline.tick(now);assert.equal(adapter.timeline.time,5);adapter.trackingFound();assert(adapter.timeline.playing);now+=100;adapter.timeline.tick(now);assert.equal(adapter.timeline.time,5.1);
 adapter.pause();adapter.trackingLost();adapter.trackingFound();assert(!adapter.timeline.playing);assert(!adapter.pausedByTracking);
 adapter.resume();adapter.trackingLost();adapter.pause();adapter.trackingFound();assert(!adapter.timeline.playing);
});
test('capture/restore preserves every layer property without loading textures again',async()=>{
 const THREE=await import('../assets/vendor/three/build/three.module.js'),{captureARVisualState,restoreARVisualState}=await import('../assets/ar/SantaoARAdapter.js');
 const layered={selected:4,expanded:true,amount:1.7,state:'active',stopTweens(){},entries:Array.from({length:6},(_,i)=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial());mesh.visible=i!==1;mesh.position.set(.01*i,.02*i,.03*i);mesh.rotation.set(.01,.02,.03);mesh.scale.set(1.1,.9,1);mesh.material.opacity=.2+i*.1;return {mesh};})};
 const saved=captureARVisualState(layered);layered.entries.forEach(({mesh})=>{mesh.position.set(0,0,9);mesh.visible=true;mesh.material.opacity=0;mesh.scale.setScalar(3);mesh.rotation.set(1,1,1);});layered.selected=-1;restoreARVisualState(layered,saved);assert.deepEqual(captureARVisualState(layered),saved);layered.entries.forEach(({mesh})=>{mesh.geometry.dispose();mesh.material.dispose();});
});
