import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
import fs from 'node:fs';
import path from 'node:path';
const patterns=JSON.parse(fs.readFileSync('content/patterns.json','utf8').replace(/^\uFEFF/,''));
const products=JSON.parse(fs.readFileSync('content/products.json','utf8').replace(/^\uFEFF/,''));
const site=JSON.parse(fs.readFileSync('content/site.json','utf8').replace(/^\uFEFF/,''));
const cultural=JSON.parse(fs.readFileSync('content/cultural-knowledge.json','utf8'));
const sources=JSON.parse(fs.readFileSync('content/sources.json','utf8'));
if(new Set(cultural.map(k=>k.id)).size!==cultural.length||new Set(sources.map(s=>s.id)).size!==sources.length)throw Error('Duplicate cultural/source IDs');
for(const k of cultural){
 for(const field of ['id','canonicalName','aliases','category','verifiedMeanings','verifiedFacts','emotions','occasions','compatibleMotifs','incompatibleMotifs','compositionRules','paletteHints','period','region','suzhouSpecific','craft','sourceIds','evidenceLevel','reviewStatus'])if(!(field in k))throw Error('Missing cultural field '+field);
 if(k.reviewStatus==='approved'&&(!k.sourceIds.length||!k.verifiedFacts.length||k.sourceIds.some(id=>!sources.some(s=>s.id===id&&s.verified))||[...k.verifiedMeanings,...k.verifiedFacts].some(f=>!k.sourceIds.includes(f.sourceId))))throw Error('Approved fact lacks verified source: '+k.id);
}
const arTargets=JSON.parse(fs.readFileSync('assets/ar-assets/targets.json','utf8'));
for(const target of arTargets){
  const files=[target.image,...(target.layers||[]).map(l=>l.src)];
  for(const file of files)if(!/^ar-assets\/[\w./-]+$/.test(file)||file.includes('..')||!fs.existsSync('assets/'+file))throw Error('Invalid AR asset: '+file);
  const dimensions=(target.layers||[]).map(layer=>{const bytes=fs.readFileSync('assets/'+layer.src);if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('AR layer must be PNG');return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)].join('x');});
  if(new Set(dimensions).size>1)throw Error('AR layers must share a canvas size');
}
if(!fs.existsSync('assets/ar-assets/targets.mind'))throw Error('AR target database missing');
if(!site.name||!site.title||!site.intro)throw Error('site.json missing text');
if(new Set(patterns.map(p=>p.id)).size!==patterns.length)throw Error('Duplicate pattern IDs');
for(const p of patterns)for(const key of ['image','thumbnail'])if(!p[key].startsWith('assets/')||!fs.existsSync(p[key]))throw Error('Missing or invalid pattern asset: '+p[key]);
for(const p of products)for(const f of [p.image_path,...p.gallery,...p.variants.flatMap(v=>[v.photo,v.sticker].filter(Boolean))])if(f.includes('..')||!fs.existsSync('assets/'+f))throw Error('Missing product asset '+f);
for(const f of ['app.js','face.js','index.html'])if(/trycloudflare\.com|127\.0\.0\.1|fetch\(['"]\/api\//.test(fs.readFileSync(f,'utf8')))throw Error('Local service dependency in '+f);
if(!fs.existsSync('_site'))fs.mkdirSync('_site');
for(const f of ['index.html','app.js','style.css','pages.css','face.html','face.js','design-guide.html','.nojekyll','404.html'])fs.copyFileSync(f,path.join('_site',f));
for(const f of ['content','assets'])fs.cpSync(f,path.join('_site',f),{recursive:true});
console.log(`Validated ${patterns.length} patterns, ${products.length} showcase items; assembled static site.`);
