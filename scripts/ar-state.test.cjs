const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const readModule=name=>import('data:text/javascript;base64,'+fs.readFileSync(path.join(__dirname,'../assets/ar',name)).toString('base64'));
test('short losses do not replay; sustained loss and different target open once',async()=>{
 const {TrackingState}=await readModule('TrackingState.js');let opens=0,losses=0;
 const t=new TrackingState({onFound:()=>opens++,onLost:()=>losses++});
 t.observe(2,true,100);t.active();for(let now=150;now<=350;now+=50)t.observe(2,true,now);
 assert.equal(opens,1);t.observe(2,false,400);t.tick(900);assert.equal(losses,0);t.observe(2,true,950);assert.equal(opens,1);
 t.observe(2,false,1000);t.tick(1649);assert.equal(losses,0);t.tick(1650);assert.equal(losses,1);t.tick(2500);assert.equal(losses,1);
 t.observe(2,true,2600);assert.equal(opens,2);t.observe(1,true,2700);assert.equal(opens,3);t.observe(2,false,2800);assert.equal(t.missing,false);
 t.reset();assert.equal(t.state,'SEARCHING');t.observe(1,true,3000);assert.equal(opens,4);
});
test('manual tween respects delay, cancellation, zero duration and exact completion',async()=>{
 const {animate,easeOutBack}=await readModule('Tween.js');let value=-1,done=0;
 const t=animate(0,10,100,v=>value=v,()=>done++,50,{manual:true,start:0});
 t.update(49);assert.equal(value,-1);t.update(100);assert(value>0&&value<10);t.update(150);assert.equal(value,10);t.update(160);assert.equal(done,1);
 const cancelled=animate(0,1,100,()=>assert.fail('cancelled'),()=>{},0,{manual:true,start:0});cancelled.cancel();cancelled.update(200);assert(cancelled.finished);
 const immediate=animate(0,1,0,v=>value=v,()=>{},0,{manual:true,start:0});immediate.update(0);assert.equal(value,1);assert.equal(easeOutBack(0),0);assert.equal(easeOutBack(1),1);assert(easeOutBack(.7)>1);
});
