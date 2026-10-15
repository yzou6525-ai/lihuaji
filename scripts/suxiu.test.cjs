const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const knowledge=read('content/suxiu-knowledge.json'),sources=read('content/suxiu-sources.json');
const modules=Promise.all([import('../assets/suxiu-knowledge-store.js'),import('./validate-suxiu.mjs')]);
const makeFetcher=()=>async url=>({ok:true,json:async()=>structuredClone(String(url).includes('suxiu-sources')?sources:knowledge)});
test('craft data validates, covers every category, original content remains unchanged across line endings',async()=>{
 const [m,v]=await modules;assert(v.validateSuxiu(knowledge,sources).ok);
 for(const category of Object.keys(m.categories))assert(knowledge.some(k=>k.category===category),category);
 const baseline=read('docs/suxiu-knowledge/preservation-baseline.json');
 for(const [file,hash] of Object.entries(baseline.sha256)){let bytes=fs.readFileSync(path.join(root,file));if(baseline.normalizedTextExtensions.includes(path.extname(file)))bytes=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,file);}
 assert.equal(read('content/patterns.json').length,1038);assert.equal(read('content/cultural-knowledge.json').length,50);
});
test('validation rejects corrupt provenance, nonofficial URLs, missing scope, broken relations and missing standard number',async()=>{
 const [,v]=await modules;
 const cases=[(k,s)=>k.push(k[0]),(k,s)=>s.push(s[0]),k=>k[0].sourceIds=[],k=>k[0].facts[0].sourceIds=['invented'],k=>k[0].facts=[],(k,s)=>s[0].url='https://ihchina.cn.evil.invalid/page',(k,s)=>s[0].url='http://www.ihchina.cn/page',k=>k[0].relations=[{type:'partOf',target:'missing'}],k=>k[0].title=' ',k=>k[0].summary='',k=>k.find(x=>x.category==='stitch').scope='',k=>delete k.find(x=>x.category==='standard').standardNumber,(k,s)=>s[0].verified=false,k=>k[0].facts[0].evidenceLevel='B'];
 for(const mutate of cases){const k=structuredClone(knowledge),s=structuredClone(sources);mutate(k,s);assert.throws(()=>v.validateSuxiu(k,s));}
});
test('search ranks titles and aliases, handles standard whitespace, and resolves all requested scenarios',async()=>{
 const [m]=await modules,store=m.createSuxiuKnowledgeStore(makeFetcher());
 for(const [q,id] of [['苏绣','suxiu'],['散套','stitch-santao'],['套针','stitch-tao'],['打籽','stitch-dazi'],['设计绣稿','process-design'],['绷架','tool-frame'],['乱针绣','craft-random'],['双面三异绣','craft-double-three'],['顾文霞','inheritor-gu-wenxia'],['李娥瑛','inheritor-li-eying'],['GB/T38029-2019','standard-gb']])assert.equal((await store.searchSuxiuKnowledge(q))[0].id,id,q);
 assert((await store.searchSuxiuKnowledge('乱针绣')).some(k=>k.id==='branch-changzhou'));
 assert.equal((await store.getSuxiuKnowledgeById('stitch-santao')).relations[0].target,'stitch-tao');
 assert.equal((await store.getSuxiuKnowledgeByCategory('inheritor')).length,12);
 assert.equal(await store.getSuxiuKnowledgeById('does-not-exist'),null);
 assert.equal((await store.searchSuxiuKnowledge('not-a-real-term')).length,0);
 assert.equal((await store.searchSuxiuKnowledge(' ')).length,knowledge.length);
 assert.equal((await store.getSuxiuSourceById('ih-suxiu')).organization,'中国非物质文化遗产网');
});
test('load caches and deduplicates simultaneous calls; retries failed requests; filters unverified data',async()=>{
 const [m]=await modules;let calls=0,fail=true;
 const store=m.createSuxiuKnowledgeStore(async url=>{calls++;if(fail)throw Error('network unavailable');return makeFetcher()(url)});
 await assert.rejects(()=>store.loadSuxiuKnowledge());fail=false;
 await Promise.all([store.loadSuxiuKnowledge(),store.searchSuxiuKnowledge('苏绣')]);assert.equal(calls,4);
 await store.getSuxiuKnowledgeByCategory('tool');assert.equal(calls,4);
 const filter=m.createSuxiuKnowledgeStore(async url=>({ok:true,json:async()=>String(url).includes('sources')?sources:knowledge.map((k,i)=>i===0?{...k,verified:false}:k)}));
 assert.equal(await filter.getSuxiuKnowledgeById('suxiu'),null);
});
test('craft distinctions are preserved; process is ordered; standards contain no invented clauses',()=>{
 assert.equal(knowledge.find(k=>k.id==='stitch-dazi').scope,'traditional-embroidery-general');
 assert.equal(knowledge.find(k=>k.id==='branch-changzhou').category,'branch');
 const process=knowledge.find(k=>k.id==='process-main');assert.equal(process.orderedSteps.length,9);
 process.orderedSteps.forEach((id,i)=>assert.equal(knowledge.find(k=>k.id===id).order,i+1));
 for(const k of knowledge.filter(k=>k.category==='standard')){assert.equal(k.fullTextRead,false);assert(!('clauses' in k));}
 assert(knowledge.every(k=>k.expertReviewed===false));
});
