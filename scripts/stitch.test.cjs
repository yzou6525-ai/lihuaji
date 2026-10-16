const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',name),'utf8'));
const modules=Promise.all([import('../assets/stitch/StitchPlayer.js'),import('../assets/stitch-video-store.js'),import('./validate-stitch.mjs')]);
function clock(){let time=0,id=0;const callbacks=new Map();return {now:()=>time,requestFrame:cb=>{callbacks.set(++id,cb);return id;},cancelFrame:id=>callbacks.delete(id),tick:ms=>{time+=ms;const queued=[...callbacks.values()];callbacks.clear();queued.forEach(cb=>cb(time));},get size(){return callbacks.size;}};}
test('all three authored demos and official sources validate; linked knowledge exists',async()=>{
 const [,,m]=await modules,r=m.validateStitchFiles();assert.deepEqual(r.demos.map(d=>d.count),[16,24,20]);assert.equal(r.videos,6);
});
test('play/pause, fractional progress, steps, seek boundaries, restart and one scheduled frame',async()=>{
 const [{StitchPlayer}]=await modules,c=clock(),p=new StitchPlayer(c);p.loadStitchDemo(read('content/stitch-demos/demo-tao-basic.json'));
 p.play();p.play();assert.equal(c.size,1);for(let i=0;i<10;i++)c.tick(75);assert(Math.abs(p.position-1)<1e-9);
 p.pause();assert.equal(c.size,0);const before=p.position;c.tick(100);assert.equal(p.position,before);
 p.seek(12.5);assert.equal(p.state.current,13);p.previous();assert.equal(p.position,12);p.next();assert.equal(p.position,13);
 p.seek(-1);assert.equal(p.position,0);p.seek(999);assert.equal(p.position,24);p.seek(NaN);assert.equal(p.position,24);
 p.play();assert.equal(p.position,0);p.seek(23.95);p.play();c.tick(100);assert.equal(p.position,24);assert.equal(p.playing,false);assert.equal(c.size,0);
 p.restart();assert.equal(p.position,0);assert.equal(p.playing,true);p.dispose();assert.equal(c.size,0);assert.equal(p.data,null);p.play();p.seek(10);assert.equal(c.size,0);
});
test('speed ratios, point toggle and arbitrary future stitch-santao ID are independent of UI',async()=>{
 const [{StitchPlayer}]=await modules,c=clock(),p=new StitchPlayer(c),demo=read('content/stitch-demos/demo-straight-basic.json');
 demo.id='future-fixture';demo.knowledgeId='stitch-santao';p.loadStitchDemo(demo);
 for(const speed of [.5,1,1.5]){p.seek(0);p.setSpeed(speed);p.play();c.tick(75);assert(Math.abs(p.position-.1*speed)<1e-9);p.pause();}
 assert.throws(()=>p.setSpeed(99));p.setPoints(true);assert(p.state.showPoints);p.setPoints(false);assert(!p.state.showPoints);p.dispose();
});
test('corrupt coordinates, duplicate IDs, bad order, untrue provenance and missing relation fields are rejected',async()=>{
 const [{validateStitchDemo,StitchPlayer}]=await modules,demo=read('content/stitch-demos/demo-tao-basic.json');
 for(const mutate of [d=>d.stitches[0].start=[NaN,1],d=>d.stitches[0].end=[1],d=>d.stitches[0].order=3,d=>d.stitches[1].id=d.stitches[0].id,d=>d.stitches[0].end=d.stitches[0].start,d=>d.expertReviewed=true,d=>d.historicalReconstruction=true,d=>delete d.knowledgeId,d=>d.stitches=[]]){const d=structuredClone(demo);mutate(d);assert.throws(()=>validateStitchDemo(d));}
 const p=new StitchPlayer(clock());p.loadStitchDemo(demo);demo.stitches[0].start[0]=999;assert.notEqual(p.data.stitches[0].start[0],999);assert.throws(()=>p.loadStitchDemo({}));assert.equal(p.data.id,'demo-tao-basic');p.dispose();
});
test('official video URL, source, rights and embedding validation rejects forged/unsupported records',async()=>{
 const [,m]=await modules,rows=read('content/stitch-video-sources.json');
 for(const mutate of [r=>r.official=false,r=>r.url='http://tv.cctv.com/a',r=>r.url='https://tv.cctv.com.evil.test/a',r=>r.embedMode='video',r=>r.embedMode='iframe',r=>r.downloaded=true,r=>r.hostedLocally=true,r=>r.title='',...['bilibili.com','douyin.com','xiaohongshu.com'].map(host=>r=>r.url='https://'+host+'/a')]){const copy=structuredClone(rows);mutate(copy[0]);assert.throws(()=>m.validateVideoSources(copy));}
});
test('official search uses all words and verified course topics; no fabricated results',async()=>{
 const [,m]=await modules,rows=read('content/stitch-video-sources.json');
 for(const q of ['苏绣 视频','姚惠芬','套针','滚针','打籽','梅花','蒋雪英'])assert(m.searchVideoRows(rows,q).some(r=>r.sourceType!=='official-reference'),q);
 assert.equal(m.searchVideoRows(rows,'不存在的影片').length,0);
 assert(m.searchVideoRows(rows,'姚惠芬').every(r=>r.id==='cctv-yao-huifen'));
});
test('video load deduplicates, caches and recovers from failures',async()=>{
 const [,m]=await modules;let fail=true,calls=0;const store=m.createVideoStore(async()=>{calls++;if(fail)throw Error('offline');return {ok:true,json:async()=>read('content/stitch-video-sources.json')};});
 await assert.rejects(store.load);fail=false;await Promise.all([store.load(),store.search('套针')]);await store.load();assert.equal(calls,2);
});
