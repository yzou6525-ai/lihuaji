export const learningProgressKey='lihuaji.learning.paths.v1';
const stepIds=['course','knowledge','practice','art','tool'];
const targets={
 tao:{course:'mooc-suxiu-02',knowledge:'stitch-tao',practice:'demo-tao-basic',art:'santao-pear-petal',tool:'ricuci'},
 gun:{course:'mooc-suxiu-03',knowledge:'stitch-gun',practice:'demo-gun-basic',art:'santao-pear-petal',tool:'ricuci'}
};
const emptyProgress=()=>Object.fromEntries(['tao','gun'].map(id=>[id,Object.fromEntries(stepIds.map(step=>[step,false]))]));

export function validateLearningPaths(data){
 if(!data||data.version!==1||!Array.isArray(data.paths)||data.paths.length!==2)throw Error('学习路径目录必须包含版本 1 的两条路径');
 const byId=new Map();
 for(const path of data.paths){
  if(!path||!['tao','gun'].includes(path.id)||byId.has(path.id)||typeof path.title!=='string'||!path.title.trim()||typeof path.subtitle!=='string'||!Array.isArray(path.steps)||path.steps.length!==5)throw Error('学习路径或步骤数量不正确');
  const steps=new Map();
  for(const step of path.steps){
   if(!step||!stepIds.includes(step.id)||steps.has(step.id)||step.type!==step.id||typeof step.title!=='string'||!step.title.trim()||typeof step.description!=='string'||!step.description.trim()||typeof step.buttonLabel!=='string'||!step.buttonLabel.trim()||step.target!==targets[path.id][step.id])throw Error(`学习路径 ${path.id} 的 ${step?.id||'未知'} 步骤无效`);
   steps.set(step.id,step);
  }
  if(stepIds.some(id=>!steps.has(id)))throw Error(`学习路径 ${path.id} 缺少固定步骤`);
  if(path.id==='tao'&&!/散套针.*另一种针法/.test(steps.get('art').description))throw Error('套针作品进阶观察必须标明这是另一种针法');
  if(path.id==='gun'&&!/散套针不是滚针/.test(steps.get('art').description))throw Error('滚针作品进阶观察必须明确区分散套针');
  if(!/机器刺绣文件与苏绣传统手工针法并非同一体系/.test(steps.get('tool').description))throw Error('机器刺绣与苏绣手工边界说明缺失');
  byId.set(path.id,path);
 }
 if(!byId.has('tao')||!byId.has('gun'))throw Error('只允许套针与滚针两条学习路径');
 return data;
}

function sanitizeProgress(value){
 const clean=emptyProgress();
 for(const pathId of ['tao','gun'])for(const stepId of stepIds)clean[pathId][stepId]=value?.[pathId]?.[stepId]===true;
 return clean;
}

export function createLearningPathStore({fetcher=(...args)=>fetch(...args),storage}={}){
 let catalogue=null,pending=null,progress=emptyProgress(),initialized=false,persisted=true;
 const getStorage=()=>{if(storage!==undefined)return storage;try{return globalThis.localStorage}catch{return null}};
 const read=()=>{
  if(initialized)return;
  initialized=true;
  try{const local=getStorage();if(!local){persisted=false;return;}const raw=local.getItem(learningProgressKey);if(raw!==null)progress=sanitizeProgress(JSON.parse(raw));}
  catch{progress=emptyProgress();persisted=false;}
 };
 const write=()=>{
  try{const local=getStorage();if(!local){persisted=false;return false;}local.setItem(learningProgressKey,JSON.stringify(progress));persisted=true;return true;}
  catch{persisted=false;return false;}
 };
 async function load(){
  if(catalogue)return catalogue;
  if(!pending)pending=(async()=>{const response=await fetcher(new URL('../content/learning-paths.json',import.meta.url));if(!response.ok)throw Error('学习路径暂未载入');return catalogue=validateLearningPaths(await response.json());})().finally(()=>{pending=null;});
  return pending;
 }
 function getProgress(){read();return structuredClone(progress);}
 function canPersist(){read();return persisted;}
 function complete(pathId,stepId){
  if(!targets[pathId]||!stepIds.includes(stepId))return false;
  read();progress[pathId][stepId]=true;write();return true;
 }
 function recordDemoProgress({id,normalizedProgress}={}){
  const pathId=id==='demo-tao-basic'?'tao':id==='demo-gun-basic'?'gun':null;
  if(!pathId||!Number.isFinite(normalizedProgress)||normalizedProgress<.95)return false;
  return complete(pathId,'practice');
 }
 function resetPath(pathId){if(!targets[pathId])return false;read();progress[pathId]=Object.fromEntries(stepIds.map(id=>[id,false]));write();return true;}
 return {load,getProgress,canPersist,complete,recordDemoProgress,resetPath};
}

export const learningPathStore=createLearningPathStore();
