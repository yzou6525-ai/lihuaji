import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {categories,scopes} from '../assets/suxiu-knowledge-store.js';
export const officialHosts=['ihchina.cn','dpm.org.cn','openstd.samr.gov.cn','std.samr.gov.cn','szfy.wglj.suzhou.com.cn'];
export function validateSuxiu(knowledge,sources){
 const errors=[],check=(ok,msg)=>{if(!ok)errors.push(msg)},ids=new Set(knowledge.map(k=>k.id)),sourceMap=new Map(sources.map(s=>[s.id,s]));
 check(ids.size===knowledge.length,'duplicate knowledge IDs');check(sourceMap.size===sources.length,'duplicate source IDs');
 for(const s of sources){
  for(const key of ['id','title','organization','url','sourceType','authorityLevel','publicationDate','accessedDate','licenseOrUsage','verified','notes'])check(key in s,`${s.id}: missing ${key}`);
  try{const u=new URL(s.url);check(u.protocol==='https:'&&!u.username&&!u.password&&officialHosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)),`${s.id}: not an official HTTPS URL`)}catch{errors.push(`${s.id}: invalid URL`)}
  check(['national','local-official'].includes(s.authorityLevel),`${s.id}: authority level`);
 }
 for(const k of knowledge){
  for(const key of ['id','type','title','aliases','category','summary','facts','keywords','scope','relations','sourceIds','verified','expertReviewed','review'])check(key in k,`${k.id}: missing ${key}`);
  check(typeof k.id==='string'&&/^[a-z][a-z0-9-]+$/.test(k.id),`${k.id}: invalid ID`);
  check(typeof k.title==='string'&&!!k.title.trim(),`${k.id}: empty title`);check(typeof k.summary==='string'&&!!k.summary.trim(),`${k.id}: empty summary`);
  check(k.category in categories,`${k.id}: category`);check(k.scope in scopes,`${k.id}: scope`);
  for(const field of ['aliases','facts','keywords','relations','sourceIds'])check(Array.isArray(k[field]),`${k.id}: ${field} must be array`);
  const refs=Array.isArray(k.sourceIds)?k.sourceIds:[],facts=Array.isArray(k.facts)?k.facts:[];
  check(!k.verified||(refs.length>0&&facts.length>0),`${k.id}: verified without evidence`);
  for(const id of refs)check(sourceMap.has(id)&&(!k.verified||sourceMap.get(id).verified===true),`${k.id}: unknown/unverified source ${id}`);
  for(const f of facts){check(typeof f.text==='string'&&!!f.text.trim()&&Array.isArray(f.sourceIds)&&f.sourceIds.length>0,`${k.id}: empty fact`);for(const id of f.sourceIds||[]){check(sourceMap.has(id)&&refs.includes(id),`${k.id}: fact source ${id}`);check(f.evidenceLevel===(sourceMap.get(id)?.authorityLevel==='national'?'A':'B'),`${k.id}: evidence level`);}}
  for(const r of k.relations||[])check(ids.has(r.target)&&['subtypeOf','relatedTo','partOf','stepOf'].includes(r.type),`${k.id}: invalid relation`);
  for(const step of k.orderedSteps||[])check(ids.has(step),`${k.id}: missing process step`);
  if(k.category==='standard')check(/^(GB\/T|DB\d+\/T)\s*[\d]+-\d{4}$/.test(k.standardNumber||''),`${k.id}: standard number`);
  check(k.expertReviewed===false,`${k.id}: no expert signoff exists for this release`);
  check(k.review?.method==='official-source-paraphrase'&&/^\d{4}-\d{2}-\d{2}$/.test(k.review?.accessedDate||''),`${k.id}: review provenance`);
 }
 if(errors.length)throw Error(errors.join('\n'));
 const counts=field=>Object.fromEntries([...new Set(knowledge.map(k=>k[field]))].map(c=>[c,knowledge.filter(k=>k[field]===c).length]));
 return {ok:true,knowledgeCount:knowledge.length,sourceCount:sources.length,categories:counts('category'),scopes:counts('scope'),national:sources.filter(s=>s.authorityLevel==='national').length,localOfficial:sources.filter(s=>s.authorityLevel==='local-official').length,organizations:Object.fromEntries([...new Set(sources.map(s=>s.organization))].map(o=>[o,sources.filter(s=>s.organization===o).length])),checks:['唯一ID','非空标题与摘要','完整字段','事实逐条引用存在的已核验来源','官方HTTPS域名白名单','证据分级','关系目标存在','流程步骤存在','针法范围明确','标准号明确','核验记录存在','未经专家审定如实标记']};
}
export function validateSuxiuFiles(){return validateSuxiu(...['knowledge','sources'].map(n=>JSON.parse(fs.readFileSync(new URL(`../content/suxiu-${n}.json`,import.meta.url),'utf8'))))}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(validateSuxiuFiles(),null,2));
