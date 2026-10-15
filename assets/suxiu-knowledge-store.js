// Independent, static craft knowledge. Never writes the story cultural catalogue.
export const categories = Object.freeze({overview:'认识苏绣',history:'历史与发展','craft-system':'技艺体系',process:'工艺流程',material:'材料',tool:'工具',stitch:'针法','work-form':'作品形式',branch:'国家级扩展项目',inheritor:'国家级代表性传承人',institution:'保护与传承机构',standard:'标准',terminology:'技艺术语'});
export const scopes = Object.freeze({suxiu:'苏绣相关技艺（不表示独有）','suzhou-suxiu':'苏州苏绣','suxiu-branch':'苏绣扩展项目','traditional-embroidery-general':'传统刺绣通用知识'});
const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s\u200b]+/g,'');
export function createSuxiuKnowledgeStore(fetcher = (...args) => fetch(...args)) {
 let cache = null, pending = null;
 async function loadSuxiuKnowledge() {
  if(cache)return cache;
  if(!pending)pending=Promise.all(['knowledge','sources'].map(async name=>{
   const response=await fetcher(new URL(`../content/suxiu-${name}.json`,import.meta.url));
   if(!response.ok)throw Error('苏绣知识资料暂时未载入，请稍后重试');
   const data=await response.json();if(!Array.isArray(data))throw Error('知识资料格式错误');return data;
  })).then(([knowledge,sources])=>{
   const validSources=sources.filter(s=>s.verified===true&&/^https:\/\//.test(s.url));
   const ids=new Set(validSources.map(s=>s.id));
   const rows=knowledge.filter(k=>k.verified===true&&k.sourceIds?.length&&k.sourceIds.every(id=>ids.has(id))&&k.facts?.length&&k.facts.every(f=>f.sourceIds?.length&&f.sourceIds.every(id=>ids.has(id)&&k.sourceIds.includes(id))));
   cache={knowledge:rows,sources:validSources};return cache;
  }).finally(()=>{pending=null});
  return pending;
 }
 async function searchSuxiuKnowledge(query='') {
  const {knowledge}=await loadSuxiuKnowledge(),q=normalize(query);
  if(!q)return [...knowledge];
  return knowledge.map(record=>{
   const title=normalize(record.title),aliases=record.aliases.map(normalize),keywords=record.keywords.map(normalize);
   const body=normalize([record.summary,...record.facts.map(f=>f.text),record.category,categories[record.category],record.standardNumber||''].join(' '));
   const score=title===q?1000:aliases.includes(q)?900:title.includes(q)?800:keywords.some(k=>k.includes(q))?600:aliases.some(k=>k.includes(q))?500:body.includes(q)?200:0;
   return {record,score};
  }).filter(x=>x.score).sort((a,b)=>b.score-a.score||a.record.id.localeCompare(b.record.id)).map(x=>x.record);
 }
 async function getSuxiuKnowledgeById(id){return (await loadSuxiuKnowledge()).knowledge.find(k=>k.id===id)||null}
 async function getSuxiuSourceById(id){return (await loadSuxiuKnowledge()).sources.find(s=>s.id===id)||null}
 async function getSuxiuKnowledgeByCategory(category){return (await loadSuxiuKnowledge()).knowledge.filter(k=>k.category===category)}
 return {loadSuxiuKnowledge,searchSuxiuKnowledge,getSuxiuKnowledgeById,getSuxiuSourceById,getSuxiuKnowledgeByCategory};
}
export const {loadSuxiuKnowledge,searchSuxiuKnowledge,getSuxiuKnowledgeById,getSuxiuSourceById,getSuxiuKnowledgeByCategory}=createSuxiuKnowledgeStore();
