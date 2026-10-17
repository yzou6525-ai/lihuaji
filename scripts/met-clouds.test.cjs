const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const catalog=read('content/patterns.json'),batch=catalog.filter(x=>x.batch==='met-cloud-curated-v1');
const api=read('docs/cloud-library/met-api-snapshot.json'),apiById=new Map(api.map(x=>[String(x.objectID),x]));
const allowed=new Set(['如意/灵芝云','流云/波浪云','团云/朵云','连续/结构云','云气纹']);
test('Met cloud references are merged in the shared catalogue and retain 50 stable records',()=>{
 assert.equal(batch.length,50);assert.equal(new Set(batch.map(x=>x.id)).size,50);assert.equal(new Set(batch.map(x=>x.museumObjectId)).size,25);
 assert.equal(new Set(catalog.map(x=>x.id)).size,catalog.length);assert.equal(new Set(batch.map(x=>x.styleFamily)).size,5);
 for(const p of batch){assert.match(p.id,/^met-cloud-\d{3}$/);assert.equal(p.visible,true);assert.equal(p.featured,true);assert.equal(p.curationLevel,'curated');assert.equal(p.threeDReady,true);assert(allowed.has(p.styleFamily));}
 const current=catalog.filter(p=>!p.id.startsWith('met-cloud-'));
 const report=read('docs/cloud-library/import-report.json');assert.equal(report.preservedRecords,current.length);
 assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(current)).digest('hex'),report.preservedCatalogSha256,'pre-existing catalogue entries must remain unchanged');
});
test('all source objects are API-verified Public Domain with official, present image assets',()=>{
 for(const p of batch){const o=apiById.get(p.museumObjectId);assert(o,`missing API object ${p.museumObjectId}`);assert.equal(o.isPublicDomain,true);assert(o.primaryImage||o.primaryImageSmall);assert.equal(p.sourcePlatform,'The Met');assert.equal(p.publicDomain,true);assert.match(p.sourceUrl,/metmuseum\.org\/art\/collection\/search\//);assert.match(p.sourceApiUrl,/collectionapi\.metmuseum\.org\/public\/collection\/v1\/objects\//);assert.match(p.license,/Public Domain/);assert(fs.existsSync(path.join(root,p.image)));assert.equal(p.image,p.thumbnail);assert(p.imageSha256);}
});
test('Chinese cloud categories and requested search aliases are indexed',()=>{
 for(const q of ['祥云','云纹','如意云','灵芝云','流云','波浪云','团云','朵云','云气纹','云肩','The Met','大都会','清代','明代','西汉','乾隆','康熙'])assert(batch.some(p=>p.searchTerms.includes(q)),q);
 for(const p of batch)assert(p.searchTerms.includes(p.title));
});
test('catalog view prioritizes curated entries and game selection keeps the established non-curated pool',()=>{
 const source=fs.readFileSync(path.join(root,'app.js'),'utf8');assert(source.includes('Number(Boolean(b.featured))-Number(Boolean(a.featured))'));assert(source.includes("p.collection===k&&!p.featured"));
});
