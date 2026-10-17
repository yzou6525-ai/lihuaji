const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {validateLearningPaths,createLearningPathStore,learningProgressKey}=require('../assets/learning-path-store.js');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/learning-paths.json'),'utf8'));

test('only the two requested paths exist, each has five exact validated targets',()=>{
 const data=validateLearningPaths(source);
 assert.deepEqual(data.paths.map(x=>x.id),['tao','gun']);
 assert(data.paths.every(path=>path.steps.length===5));
 const targets=Object.fromEntries(data.paths.map(path=>[path.id,Object.fromEntries(path.steps.map(step=>[step.id,step.target]))]));
 assert.deepEqual(targets.tao,{course:'mooc-suxiu-02',knowledge:'stitch-tao',practice:'demo-tao-basic',art:'santao-pear-petal',tool:'ricuci'});
 assert.deepEqual(targets.gun,{course:'mooc-suxiu-03',knowledge:'stitch-gun',practice:'demo-gun-basic',art:'santao-pear-petal',tool:'ricuci'});
 assert(!JSON.stringify(data).includes('demo-straight-basic'));
 assert(!JSON.stringify(data).includes('demo-dazi'));
 assert(data.paths.every(path=>path.steps.find(step=>step.id==='art').target==='santao-pear-petal'));
 assert(data.paths.every(path=>path.steps.find(step=>step.id==='tool').target==='ricuci'));
});

test('schema rejects extra paths, missing steps, wrong mappings, and needle conflation',()=>{
 const clone=()=>JSON.parse(JSON.stringify(source));
 const extra=clone();extra.paths.push({...extra.paths[0],id:'plum'});assert.throws(()=>validateLearningPaths(extra));
 const short=clone();short.paths[0].steps.pop();assert.throws(()=>validateLearningPaths(short));
 const wrong=clone();wrong.paths[0].steps.find(step=>step.id==='course').target='mooc-suxiu-03';assert.throws(()=>validateLearningPaths(wrong));
 const confusion=clone();confusion.paths[0].steps.find(step=>step.id==='art').description='散套针就是套针。';assert.throws(()=>validateLearningPaths(confusion));
});

function memoryStorage(initial=null){let raw=initial;return {getItem(key){assert.equal(key,learningProgressKey);return raw;},setItem(key,value){assert.equal(key,learningProgressKey);raw=value;},get raw(){return raw;}};}
const fetchPaths=async()=>({ok:true,json:async()=>source});

test('progress starts at 0/5, only reaches practice completion at 0.95, persists separately by path, and resets one path',async()=>{
 const storage=memoryStorage(),store=createLearningPathStore({fetcher:fetchPaths,storage});await store.load();
 assert.equal(Object.values(store.getProgress().tao).filter(Boolean).length,0);
 store.complete('tao','course');store.complete('tao','knowledge');
 assert.equal(store.recordDemoProgress({id:'demo-tao-basic',normalizedProgress:.5}),false);
 assert.equal(store.recordDemoProgress({id:'demo-tao-basic',normalizedProgress:.94}),false);
 assert.equal(store.getProgress().tao.practice,false);
 assert.equal(store.recordDemoProgress({id:'demo-tao-basic',normalizedProgress:.95}),true);
 assert.equal(store.recordDemoProgress({id:'demo-tao-basic',normalizedProgress:1}),true);
 assert.equal(Object.values(store.getProgress().tao).filter(Boolean).length,3);
 store.complete('gun','course');assert.equal(Object.values(store.getProgress().gun).filter(Boolean).length,1);
 const restored=createLearningPathStore({fetcher:fetchPaths,storage});assert.equal(restored.getProgress().tao.practice,true);assert.equal(restored.getProgress().gun.course,true);
 restored.resetPath('gun');assert.equal(Object.values(restored.getProgress().gun).filter(Boolean).length,0);assert.equal(Object.values(restored.getProgress().tao).filter(Boolean).length,3);
 assert.equal(storage.raw.includes('"tao"'),true);
});

test('corrupt local progress fails closed to 0/5 and unavailable storage keeps current-session actions usable',async()=>{
 const corrupt=createLearningPathStore({fetcher:fetchPaths,storage:memoryStorage('{broken')});
 assert.equal(Object.values(corrupt.getProgress().tao).filter(Boolean).length,0);
 const unavailable={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 const volatile=createLearningPathStore({fetcher:fetchPaths,storage:unavailable});await volatile.load();
 assert.equal(volatile.canPersist(),false);assert.equal(volatile.complete('gun','course'),true);assert.equal(volatile.getProgress().gun.course,true);assert.equal(volatile.canPersist(),false);
});
