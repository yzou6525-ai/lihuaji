const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',name),'utf8'));
const tools=read('content/digital-tools.json'),videos=read('content/stitch-video-sources.json');
const imported=Promise.all([import('../assets/digital-tools-store.js'),import('../assets/stitch-video-store.js')]);

test('two new Suzhou/CCTV records retain only verified official titles/topics and original sources',async()=>{
 const [,video]=await imported;
 assert.equal(videos.length,8);
 const yu=videos.find(x=>x.id==='suzhou-yu-fuzhen'),zou=videos.find(x=>x.id==='cctv-zou-yingzi-2026');
 assert(yu&&zou);assert.equal(yu.category,'传承人');assert.equal(zou.category,'传承人');
 assert.equal(yu.url,'https://szfy.wglj.suzhou.com.cn/2025yxyp/detail.php?id=1');
 assert.equal(zou.url,'https://tv.cctv.com/2026/05/21/VIDExvawSD5WLYRud6PlcQuU260521.shtml');
 assert.deepEqual(yu.topics,['苏绣','余福臻','传统细绣','乱针绣','双面绣','双面三异绣']);
 assert.deepEqual(zou.topics,['苏绣','邹英姿','苏绣大师','以针为笔','锦绣时代']);
 for(const row of [yu,zou]){assert.equal(row.official,true);assert.equal(row.sourceType,'official-video');assert.equal(row.embedMode,'external');assert.equal(row.downloaded,false);assert.equal(row.hostedLocally,false);video.validateVideoSources([row]);}
 assert.equal(video.searchVideoRows(videos,'余福臻').length,1);assert.equal(video.searchVideoRows(videos,'邹英姿').length,1);
 assert.equal(video.searchVideoRows(videos,'邹英姿 针法教学').length,0,'人物片不得凭空标成针法教学');
});

test('Ricuci entry has validated MIT, client-side processing, repository and measured lazy iframe policy',async()=>{
 const [store]=await imported,row=store.validateDigitalTools(tools)[0];
 assert.equal(row.provider,'Ricuci');assert.equal(row.repository,'Federicokalik/embroidery-converter-kit');assert.equal(row.license,'MIT');assert.equal(row.processing,'client-side');assert.equal(row.copiedCode,false);
 assert.equal(row.iframeTested,true);assert.equal(row.iframeAllowed,true);assert.equal(row.iframeTest.httpStatus,200);assert.equal(row.iframeTest.xFrameOptions,null);assert.equal(row.iframeTest.contentSecurityPolicy,null);assert.equal(row.iframeTest.frameAncestors,null);assert.equal(row.iframeTest.actualFrameLoad,true);
});

test('Ricuci search finds requested Chinese and machine-format queries without disturbing video catalog',async()=>{
 const [store,video]=await imported,rowStore=store.createDigitalToolStore(async()=>({ok:true,json:async()=>tools}));
 for(const query of ['Ricuci','数字刺绣','机器刺绣','DST','PES','JEF','刺绣文件','转换'])assert.equal((await rowStore.search(query)).length,1,query);
 assert.equal((await rowStore.search('unknown format')).length,0);
 assert.equal(video.searchVideoRows(videos,'余福臻').length,1);assert.equal((await rowStore.search('余福臻')).length,0);
});

test('digital-tool validation fails closed for license, provider, URLs, local processing, copy, and iframe claims',async()=>{
 const [store]=await imported,mutations=[
  row=>row.license='GPL-3.0',row=>row.provider='Other',row=>row.repository='other/repo',row=>row.officialWebApp='http://ricuci.app/convert/',row=>row.officialWebApp='https://ricuci.app.evil.test/convert/',row=>row.processing='server-upload',row=>row.copiedCode=true,row=>{row.iframeAllowed=true;row.iframeTested=false;},row=>row.iframeTest.httpStatus=403,row=>row.keywords=[]
 ];
 for(const mutate of mutations){const bad=structuredClone(tools);mutate(bad[0]);assert.throws(()=>store.validateDigitalTools(bad));}
});
