export const COMPOSITIONS=['circular','diagonal','paired'];
export function approvedKnowledge(knowledge,sources,{generatable=false}={}){
 const verified=new Set(sources.filter(s=>s.verified===true&&/^https:\/\//.test(s.url)).map(s=>s.id));
 return knowledge.filter(k=>k.reviewStatus==='approved'&&Array.isArray(k.sourceIds)&&k.sourceIds.length&&k.sourceIds.every(id=>verified.has(id))&&Array.isArray(k.verifiedFacts)&&k.verifiedFacts.length&&k.verifiedFacts.every(f=>k.sourceIds.includes(f.sourceId))&&Array.isArray(k.verifiedMeanings)&&k.verifiedMeanings.every(m=>k.sourceIds.includes(m.sourceId))&&(!generatable||k.generationEnabled===true));
}
export function retrieveKnowledge(story,intent,knowledge,sources){
 const rows=approvedKnowledge(knowledge,sources,{generatable:true});
 return rows.map(k=>({record:k,score:[k.canonicalName,...k.aliases].reduce((n,w)=>n+(w&&story.includes(w)?8:0),0)+k.emotions.reduce((n,w)=>n+(intent.emotions.includes(w)?3:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.record.id.localeCompare(b.record.id)).slice(0,6);
}
export function motifCandidate(record,score=0){return {id:record.id,name:record.canonicalName,key:record.generatorKey,score,reason:record.verifiedMeanings.length?record.verifiedMeanings.map(m=>m.label).join('；'):'仅选取有来源的视觉题材，不附加象征含义',sourceIds:record.sourceIds,context:record.verifiedFacts.map(f=>f.summary).join(' ')};}
export function evidenceFor(ids,knowledge,sources){const used=approvedKnowledge(knowledge,sources).filter(k=>ids.includes(k.id));return [...new Set(used.flatMap(k=>k.sourceIds))].map(id=>{const s=sources.find(s=>s.id===id);return {sourceId:id,title:s.title,url:s.url,knowledgeIds:used.filter(k=>k.sourceIds.includes(id)).map(k=>k.id)};});}
