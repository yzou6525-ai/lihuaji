const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const load=import('../assets/stitch/SantaoTimeline.js');
const data=JSON.parse(fs.readFileSync(require('path').join(__dirname,'../content/stitch-demos/demo-santao-pear-petal.json'),'utf8'));
function clock(){let time=0,next=0;const jobs=new Map();return {now:()=>time,requestFrame:cb=>{jobs.set(++next,cb);return next;},cancelFrame:id=>jobs.delete(id),tick:ms=>{time+=ms;const list=[...jobs.values()];jobs.clear();list.forEach(cb=>cb(time));},get size(){return jobs.size;}};}
test('cinematic source is exactly the accepted V0, no regenerated stitch data',()=>{
 const raw=fs.readFileSync(require('path').join(__dirname,'../content/stitch-demos/demo-santao-pear-petal.json'),'utf8').replace(/\r\n/g,'\n');
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),'92af2e12212dd652767d79b8f758ca3da314dab02ac1f942345e9bf1d0fa1d31');assert.equal(data.stitches.length,56);
});
test('11-second pure timeline has exact requested stages, completed counts and reversible seek frames',async()=>{
 const {santaoFrame,SANTAO_DURATION}=await load;assert.equal(SANTAO_DURATION,11);
 for(const [t,stage] of [[0,'intro'],[1.5,'reveal'],[2.5,'batch1-key'],[4,'batch1-fill'],[5,'batch2-key'],[6.5,'batch2-fill'],[7.5,'batch3-key'],[8.5,'batch3-fill'],[9.5,'merge'],[11,'complete']])assert.equal(santaoFrame(t).stage,stage);
 for(const [t,n] of [[4.5,28],[7,42],[9,56],[11,56]])assert.equal(santaoFrame(t).position,n);
 assert.equal(santaoFrame(0).surfaceOpacity,1);assert.equal(santaoFrame(1.5).surfaceOpacity,.5);assert.equal(santaoFrame(11).surfaceOpacity,1);
 assert(santaoFrame(4).position>15&&santaoFrame(4).position<28);assert(santaoFrame(6.5).position>35&&santaoFrame(6.5).position<42);assert(santaoFrame(8.5).position>49&&santaoFrame(8.5).position<56);
 const frame=santaoFrame(5);santaoFrame(11);assert.deepEqual(santaoFrame(5),frame);
});
test('all three representative stitches go through five phases, needle height and a tightening Bézier',async()=>{
 const {santaoFrame,sampleNeedle,quadraticPoint,REPRESENTATIVE_ORDERS}=await load;assert.deepEqual(REPRESENTATIVE_ORDERS,[1,32,46]);
 for(const [start,duration,order] of [[2,1.2,1],[4.5,1.3,32],[7,1,46]]){
   for(const [p,phase] of [[.07,'出针'],[.2,'抬针'],[.45,'行针'],[.68,'入针'],[.88,'拉线']]){const frame=santaoFrame(start+duration*p);assert.equal(frame.key.order,order);assert.equal(frame.key.phase,phase);const pose=sampleNeedle(data.stitches[order-1],frame.key);assert([...pose.tip,...pose.control,...pose.end].every(Number.isFinite));}
   const s=data.stitches[order-1],loose=sampleNeedle(s,{phase:'拉线',phaseProgress:0}),tight=sampleNeedle(s,{phase:'拉线',phaseProgress:1});
   assert(loose.control[2]>tight.control[2]+3);assert.equal(tight.slack,0);
   assert.deepEqual(quadraticPoint(tight.start,tight.control,tight.end,0),tight.start);assert.deepEqual(quadraticPoint(tight.start,tight.control,tight.end,1),tight.end);
   assert(Math.abs(quadraticPoint(tight.start,tight.control,tight.end,.5)[0]-(s.start[0]+s.end[0])/2)<1e-9);
   assert(sampleNeedle(s,{phase:'出针',phaseProgress:0}).tip[2]<0);assert(sampleNeedle(s,{phase:'入针',phaseProgress:1}).tip[2]<0);
 }
});
test('clock start/pause/resume/seek backward/forward/restart/end/dispose owns at most one RAF',async()=>{
 const {SantaoTimeline}=await load,c=clock(),t=new SantaoTimeline(c);assert.equal(t.state.stage,'idle');t.start();t.resume();assert.equal(c.size,1);c.tick(2500);assert.equal(t.state.stage,'batch1-key');
 t.pause();assert.equal(c.size,0);const before=t.time;c.tick(3000);assert.equal(t.time,before);t.resume();c.tick(500);assert.equal(t.time,3);
 t.seek(1.5);assert.equal(t.state.stage,'reveal');assert.equal(c.size,0);t.seek(9.5);assert.equal(t.state.stage,'merge');t.seek(NaN);assert.equal(t.time,9.5);
 t.restart();assert.equal(t.time,0);assert.equal(c.size,1);c.tick(11000);assert.equal(t.time,11);assert(!t.playing);assert.equal(c.size,0);
 t.start();t.dispose();assert.equal(c.size,0);t.resume();t.start();t.seek(5);assert.equal(c.size,0);assert(t.disposed);
});
test('accelerated reveal retains the representative, adds the other 53 once and never loses a settled stitch',async()=>{
 const {santaoFrame}=await load;
 for(const [time,total,order] of [[3.2,1,1],[5.8,29,32],[8,43,46]]){const f=santaoFrame(time);assert.equal(f.stitchFractions[order-1],1);assert.equal(f.stitchFractions.reduce((a,b)=>a+b,0),total);}
 let previous=Array(56).fill(0);
 for(let t=2;t<=11;t+=.01){const f=santaoFrame(t);assert(Math.abs(f.stitchFractions.reduce((a,b)=>a+b,0)-f.position)<1e-8);assert(f.stitchFractions.every((v,i)=>v>=previous[i]));previous=f.stitchFractions;}
 assert.equal(santaoFrame(11).stitchFractions.filter(v=>v===1).length,56);
});
