const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const catalog=read('content/patterns.json'),selection=read('docs/library-2026-10-11/selection.json');
const batch=catalog.filter(p=>p.batch===selection.batch),byId=new Map(catalog.map(p=>[p.id,p]));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function sorted(x){if(Array.isArray(x))return x.map(sorted);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])]));return x;}
test('museum import adds at least 200 unique records and preserves original catalogue',()=>{
 assert(batch.length>=200);assert.equal(batch.length,selection.records.length);assert.equal(byId.size,catalog.length);
 const preserved=selection.preservedIds.map(id=>{assert(byId.has(id),id);return byId.get(id)});
 assert.equal(hash(JSON.stringify(sorted(preserved))),selection.preservedRecordsSha256);
 assert.equal(new Set(batch.map(p=>p.sourceUrl)).size,batch.length);
 assert.equal(new Set(batch.map(p=>p.sha256)).size,batch.length);
 assert.equal(new Set(batch.map(p=>p.imageSha256)).size,batch.length);
 const oldSources=new Set(preserved.map(p=>p.sourceUrl));for(const p of batch)assert(!oldSources.has(p.sourceUrl),p.id);
});
test('every added record matches the official CC0 source and attribution snapshot',()=>{
 for(const row of selection.records){
  const p=byId.get(row.id),r=row.sourceRecord;assert.equal(r.share_license_status,'CC0');assert.equal(p.license,'CC0');
  assert.equal(p.originalTitle,r.title);assert.equal(p.accession,r.accession_number);assert.equal(p.sourceUrl,r.url);
  assert.deepEqual(p.culture,r.culture);assert.equal(p.technique,r.technique);assert.equal(p.sha256,row.sourceImageSha256);
  assert.equal(p.downloadUrl,r.images.web.url);assert.equal(p.review.expertReviewed,false);
  for(const field of ['author','licenseUrl','rightsPolicyUrl','sourceApiUrl','curationNote','labelNote','changes','rightsVerifiedAt'])assert(p[field],`${p.id} ${field}`);
  for(const field of ['sourceUrl','sourceApiUrl','downloadUrl','licenseUrl'])assert.equal(new URL(p[field]).protocol,'https:');
 }
});
test('new entries cover nine regions and retain searchable flower, animal, figure, geometry and border subjects',()=>{
 const regions=new Set(selection.preservedIds.map(id=>byId.get(id).region));assert.equal(regions.size,9);
 assert.deepEqual(new Set(batch.map(p=>p.region)),regions);
 const tags=new Set(batch.flatMap(p=>p.tags));for(const tag of ['花草藤蔓','鸟兽鱼虫','人物故事','几何与团花','边饰与织锦'])assert(tags.has(tag));
 for(const kind of ['basic','archive'])assert(batch.some(p=>p.collection===kind));
});
test('all new display images and thumbnails are local WebP files with verified bytes',()=>{
 for(const p of batch)for(const [key,sha] of [['image','imageSha256'],['thumbnail','thumbnailSha256']]){
  assert(/^assets\/patterns\/museum-CMA-\d+(?:-thumb)?\.webp$/.test(p[key]));const b=fs.readFileSync(path.join(root,p[key]));
  assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WEBP');assert.equal(hash(b),p[sha]);
 }
});
