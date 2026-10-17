const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',name),'utf8'));
const source=read('content/stitch-video-sources.json'),course=read('content/suxiu-official-course.json');
const modules=Promise.all([import('../assets/stitch-video-store.js'),import('./validate-stitch.mjs')]);

test('official course catalog validates and reuses the single existing MOOC source',async()=>{
 const [store,validator]=await modules;
 assert.equal(store.validateOfficialCourse(course),course);
 assert.equal(source.filter(row=>row.id==='mooc-suxiu').length,1);
 assert.equal(source.find(row=>row.id==='mooc-suxiu').url,course.courseUrl);
 assert.equal(course.organization,'苏州工艺美术职业技术学院');
 assert.equal(course.platform,'中国大学MOOC');
 assert.equal(course.title,'意线情针——苏绣技艺');
 assert.equal(course.iframeTested,true);
 assert.equal(course.iframeAllowed,true);
 assert.equal(course.iframeTest.lessonPlayback,'not-tested');
 assert.equal(course.modules.length,5);
 assert.equal(validator.validateStitchFiles().videos,source.length);
});

test('course modules preserve official titles and safe practice mappings',async()=>{
 const [store]=await modules;
 assert.doesNotThrow(()=>store.validateOfficialCourse(course));
 const [intro,tao,roll,plum,dog]=course.modules;
 assert.match(intro.title,/针法、开绣演示/);
 assert.match(tao.title,/齐针、套针演示/);
 assert.deepEqual(tao.localDemoIds,['demo-tao-basic']);
 assert(!tao.localDemoIds.includes('demo-straight-basic'));
 assert.match(roll.title,/滚针、打籽演示/);
 assert.deepEqual(roll.localDemoIds,['demo-gun-basic']);
 assert(roll.knowledgeIds.includes('stitch-dazi'));
 assert.deepEqual(plum.localDemoIds,[]);
 assert.match(plum.title,/梅花/);
 assert.equal(dog.type,'virtual-practice');
 assert.deepEqual(dog.localDemoIds,[]);
 assert(!('assets' in dog));
 assert(course.modules.every(module=>module.courseUrl===course.courseUrl&&module.official===true));
});

test('course source rejects invented practice, duplicate modules and untrusted URLs',async()=>{
 const [store]=await modules;
 for(const mutate of [
  data=>data.modules[1].localDemoIds=['demo-straight-basic'],
  data=>data.modules[2].localDemoIds=['demo-santao-pear-petal'],
  data=>data.modules[4].localDemoIds=['demo-tao-basic'],
  data=>data.modules[0].courseUrl='https://example.org/course',
  data=>data.modules[0].id=data.modules[1].id,
  data=>data.sourceId='other-source'
 ]){const copy=structuredClone(course);mutate(copy);assert.throws(()=>store.validateOfficialCourse(copy));}
});

test('MOOC course is indexed under all requested teaching terms and a local directory entry',async()=>{
 const [store]=await modules,record=source.find(row=>row.id==='mooc-suxiu');
 for(const term of ['针法','开绣','齐针','套针','滚针','打籽','梅花','生肖肖像','虚拟刺绣','意线情针','苏州工艺美术职业技术学院']){
  assert(store.searchVideoRows(source,term).some(row=>row.id==='mooc-suxiu'),term);
 }
 const card=store.videoCard(record);
 assert.match(card,/官方公开课程来源/);
 assert.match(card,/#ar\/mooc-suxiu/);
 assert.doesNotMatch(card,/target="_blank"/);
});

test('course store loads, validates, caches, and can recover from a failed request',async()=>{
 const [storeModule]=await modules;let fail=true,calls=0;
 const store=storeModule.createOfficialCourseStore(async()=>{calls++;if(fail)throw Error('offline');return {ok:true,json:async()=>course};});
 await assert.rejects(store.load,/offline/);fail=false;
 const [a,b]=await Promise.all([store.load(),store.load()]);
 assert.equal(a,b);await store.load();assert.equal(calls,2);
});

test('MOOC archives no videos, dog practice package, or rehosted course files',()=>{
 const paths=fs.readdirSync(path.join(__dirname,'..','content','stitch-demos'));
 const courseFiles=fs.readdirSync(path.join(__dirname,'..','content')).map(name=>name.toLowerCase());
 for(const list of [paths,courseFiles])assert(!list.some(name=>/\.mp4$|\.m3u8$|\.ts$|\.zip$/.test(name)));
 assert.equal(course.modules[4].localDemoIds.length,0);
 assert.equal(source.find(row=>row.id==='mooc-suxiu').downloaded,false);
 assert.equal(source.find(row=>row.id==='mooc-suxiu').hostedLocally,false);
});
