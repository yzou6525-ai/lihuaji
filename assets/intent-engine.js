import {approvedKnowledge,retrieveKnowledge,motifCandidate,evidenceFor,COMPOSITIONS} from './knowledge-retriever.js';
export const PROMPT_VERSION='lihuaji-cultural-intent/1.0.0';
export const EMOTIONS=['惜别','祝愿','重逢','相伴','温柔','希望','坚韧','成长','自然','回忆','平静','喜悦','家庭','平安','祝贺'];
export const RELATIONSHIPS=['未指定','朋友','家人','伴侣','自己'];
export const OCCASIONS=['日常','毕业','生日','婚礼','旅行','纪念','新年'];
const lexicon={惜别:['分别','离别','分离','告别','不同城市'],祝愿:['祝','希望','愿'],重逢:['重逢','再见','相聚','回来'],相伴:['陪伴','一起','相伴'],温柔:['温柔','安静','轻柔'],希望:['希望','未来','盼','明天'],坚韧:['坚持','困难','勇敢','挫折'],成长:['成长','毕业','开始','长大'],自然:['花','草','山','自然','春'],回忆:['记得','回忆','小时候','曾经'],平静:['平静','宁静','安静'],喜悦:['开心','快乐','喜悦'],家庭:['家人','妈妈','父亲','母亲','奶奶'],平安:['平安','健康','安心'],祝贺:['庆祝','祝贺','成功']};
export function checkStory(story){if(typeof story!=='string'||!story.trim())throw Error('请写下故事，或先填写一段示例再修改。');if([...story.trim()].length>500)throw Error('故事请控制在500字以内。');return story.trim();}
export function validateIntentResult(raw,knowledge,sources){
 const fields=['storySummary','emotions','relationship','occasion','motifCandidates','paletteCandidates','compositionCandidates','evidence'];
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!fields.includes(k))||fields.some(k=>!(k in raw)))throw Error('设计决策结构不符合约定');
 if(typeof raw.storySummary!=='string'||raw.storySummary.length>500||!RELATIONSHIPS.includes(raw.relationship)||!OCCASIONS.includes(raw.occasion))throw Error('意图字段不合规');
 for(const key of ['emotions','motifCandidates','paletteCandidates','compositionCandidates','evidence'])if(!Array.isArray(raw[key])||raw[key].length>20)throw Error('意图列表不合规');
 for(const [key,limit] of [['emotions',15],['paletteCandidates',4],['compositionCandidates',3]])if(raw[key].length>limit||new Set(raw[key]).size!==raw[key].length)throw Error('设计列表重复或过长');
 if(raw.emotions.some(e=>!EMOTIONS.includes(e))||raw.paletteCandidates.some(p=>!Number.isInteger(p)||p<0||p>3)||raw.compositionCandidates.some(c=>!COMPOSITIONS.includes(c)))throw Error('设计选项超出允许范围');
 if(!raw.paletteCandidates.length||!raw.compositionCandidates.length)throw Error('缺少色彩或构图选项');
 const allowed=approvedKnowledge(knowledge,sources,{generatable:true});
 const ids=raw.motifCandidates.map(m=>typeof m==='string'?m:m?.id);
 if(ids.some(id=>!allowed.some(k=>k.id===id))||new Set(ids).size!==ids.length||ids.length>6)throw Error('包含未通过资料核对的纹样');
 // Reasons, sources and cultural facts always come from the local reviewed store, never model prose.
 return {...raw,motifCandidates:ids.map(id=>motifCandidate(allowed.find(k=>k.id===id))),evidence:evidenceFor(ids,knowledge,sources)};
}
export class LocalRuleProvider{
 async infer({story,choices={},knowledge,sources}){
  story=checkStory(story);const emotions=[...new Set([...Object.entries(lexicon).filter(([,words])=>words.some(w=>story.includes(w))).map(([e])=>e),...(choices.emotions||[]).filter(e=>EMOTIONS.includes(e))])];
  const relationship=RELATIONSHIPS.includes(choices.relationship)&&choices.relationship!=='未指定'?choices.relationship:/朋友|同学|室友/.test(story)?'朋友':/妈妈|父亲|母亲|家人|奶奶/.test(story)?'家人':/爱人|伴侣|恋人/.test(story)?'伴侣':'未指定';
  const occasion=OCCASIONS.includes(choices.occasion)&&choices.occasion!=='日常'?choices.occasion:OCCASIONS.find(o=>story.includes(o))||'日常';
  const retrieved=retrieveKnowledge(story,{emotions},knowledge,sources);
  const intent={storySummary:story.slice(0,100),emotions,relationship,occasion,motifCandidates:retrieved.map(x=>motifCandidate(x.record,x.score)),paletteCandidates:emotions.includes('喜悦')?[1,0,2]:[0,2,3],compositionCandidates:relationship==='朋友'||emotions.includes('重逢')?['paired','circular','diagonal']:['circular','diagonal','paired'],evidence:evidenceFor(retrieved.map(x=>x.record.id),knowledge,sources)};
  return {intent:validateIntentResult(intent,knowledge,sources),provider:{name:'LocalRuleProvider',model:'none',version:'1.0.0',isAIInference:false,usedRemoteAI:false,promptVersion:PROMPT_VERSION},fallbackReason:null};
 }
}
export class RemoteAIProvider{
 constructor({endpoint,fetcher=globalThis.fetch,timeoutMs=10000}={}){this.endpoint=endpoint;this.fetcher=fetcher;this.timeoutMs=timeoutMs;}
 async infer(request){
  if(!request.consentRemote)throw Error('尚未同意发送故事到远程服务');
  if(!this.endpoint||!/^https:\/\//.test(this.endpoint))throw Error('尚未配置受信任的 HTTPS AI 服务');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
  try{const response=await this.fetcher(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',signal:controller.signal,body:JSON.stringify({story:checkStory(request.story),approvedKnowledge:approvedKnowledge(request.knowledge,request.sources,{generatable:true}),promptVersion:PROMPT_VERSION})});
   if(!response.ok)throw Error('AI 服务暂不可用');const body=await response.json();
   if(!body||typeof body!=='object'||Object.keys(body).some(k=>!['model','intent'].includes(k))||!body.model||Object.keys(body.model).some(k=>!['name','version'].includes(k))||['name','version'].some(k=>typeof body.model[k]!=='string'||!body.model[k].trim()||body.model[k].length>100))throw Error('AI 服务未提供合规的模型身份');
   if(!Array.isArray(body.intent?.motifCandidates)||body.intent.motifCandidates.some(id=>typeof id!=='string'))throw Error('AI 服务应仅返回纹样ID');
   if(!Array.isArray(body.intent.evidence)||body.intent.evidence.length)throw Error('模型不得提供自编来源');
   return {intent:validateIntentResult(body.intent,request.knowledge,request.sources),provider:{name:'RemoteAIProvider',model:body.model.name,version:body.model.version,isAIInference:true,usedRemoteAI:true,promptVersion:PROMPT_VERSION},fallbackReason:null};
  }finally{clearTimeout(timer);}
 }
}
export async function inferWithFallback(request,remote=null){if(remote){try{return await remote.infer(request);}catch(error){const result=await new LocalRuleProvider().infer(request);return {...result,fallbackReason:String(error.message).slice(0,160)};}}return new LocalRuleProvider().infer(request);}
