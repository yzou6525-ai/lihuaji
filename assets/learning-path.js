import {learningPathStore} from './learning-path-store.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={course:'官方工艺教学',knowledge:'针法知识档案',practice:'梨花季数字示意',art:'作品进阶观察',tool:'机器刺绣拓展'};
const entered={course:'已进入官方课程',knowledge:'已进入针法知识',practice:'已完成数字练习',art:'已进入作品观察',tool:'已进入数字工具拓展'};
const pending={course:'未进入',knowledge:'未进入',practice:'未完成数字练习',art:'未进入',tool:'未进入'};

export function ensureLearningPathStyles(){
 let link=document.querySelector('link[data-learning-path-style]');
 if(!link){link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./learning-path.css',import.meta.url).href;link.dataset.learningPathStyle='';document.head.append(link);}
 return link;
}

export function mountLearningPath(root,{initialPath='tao',onOpenCourse=()=>{},onOpenKnowledge=()=>{},onOpenPractice=()=>{},onOpenArt=()=>{},onOpenTool=()=>{},confirmReset=(message)=>window.confirm(message)}={}){
 let active=true,selected=['tao','gun'].includes(initialPath)?initialPath:'tao',catalogue=null;
 const handlers={course:onOpenCourse,knowledge:onOpenKnowledge,practice:onOpenPractice,art:onOpenArt,tool:onOpenTool};
 const showError=()=>{if(!active)return;root.innerHTML='<p class="small" role="status">学习路径暂未载入，原有课程与练习仍可使用。</p><button type="button" data-learning-retry>重新加载</button>';root.querySelector('[data-learning-retry]')?.addEventListener('click',load);};
 const render=()=>{
  if(!active||!catalogue)return;
  const path=catalogue.paths.find(item=>item.id===selected),progress=learningPathStore.getProgress()[selected],done=Object.values(progress).filter(Boolean).length,complete=done===5;
  const steps=path.steps.map((step,index)=>{const checked=progress[step.id];return `<li class="learning-step" data-learning-step="${esc(step.id)}" data-complete="${checked}"><span class="learning-step-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><div class="learning-step-copy"><p class="learning-step-label">${esc(labels[step.type])}</p><h3>${esc(step.title)}</h3><p>${esc(step.description)}</p><span class="learning-step-state"><span class="learning-step-state-mark" aria-hidden="true">${checked?'✓':'○'}</span><span>${esc(checked?entered[step.type]:pending[step.type])}</span></span></div><button class="learning-step-action${checked?'':' primary'}" type="button" data-learning-action="${esc(step.type)}" data-target="${esc(step.target)}">${esc(step.buttonLabel)}</button></li>`;}).join('');
  root.innerHTML=`<div class="learning-path-head"><div><p class="learning-path-kicker">针法学习导览</p><h2 class="learning-path-title">今日学一针</h2><p class="learning-path-subtitle">${esc(path.subtitle)}</p></div><div class="learning-path-switch" role="group" aria-label="选择学习路径"><button type="button" data-path="tao" aria-pressed="${selected==='tao'}">套针</button><button type="button" data-path="gun" aria-pressed="${selected==='gun'}">滚针</button></div></div><div class="learning-progress" aria-live="polite"><span class="learning-progress-count">学习进度 ${done} / 5</span><span class="learning-progress-line" role="progressbar" aria-label="${esc(path.title)}学习进度" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${done}" style="--learning-progress:${done*20}%"><span></span></span></div><h3 class="learning-path-current-title">${esc(path.title)}</h3><ol class="learning-step-list">${steps}</ol><p class="learning-path-complete" ${complete?'':'hidden'}>这条学习路径已完成。你已经从官方课程、知识、数字针迹、作品观察和数字刺绣拓展五个角度理解这一针法。<br>已完成本项目的数字学习路径。</p><div class="learning-reset-row"><button type="button" class="learning-reset" data-learning-reset>重置本路径进度</button></div><p class="learning-path-truth">官方课程用于了解真实苏绣教学；梨花季数字针迹为项目数字示意；散套针作品观察属于进阶拓展；Ricuci 展示机器刺绣文件结构。以上内容性质不同，不互相替代。</p>${learningPathStore.canPersist()?'':'<p class="learning-path-storage" role="status">浏览器暂不允许本地保存；切换页面后进度可能无法恢复。</p>'}`;
 };
 async function load(){try{catalogue=await learningPathStore.load();if(active)render();}catch{showError();}}
 const recordDemoProgress=detail=>{if(!active||!detail)return false;const changed=learningPathStore.recordDemoProgress(detail);if(changed)render();return changed;};
 const handleClick=async event=>{
  if(!active)return;
  const switcher=event.target.closest('[data-path]');
  if(switcher&&root.contains(switcher)){selected=switcher.dataset.path;render();return;}
  const reset=event.target.closest('[data-learning-reset]');
  if(reset&&root.contains(reset)){if(confirmReset(`重置${selected==='tao'?'套针':'滚针'}学习路径的本机进度？`)){learningPathStore.resetPath(selected);render();}return;}
  const button=event.target.closest('[data-learning-action]');
  if(!button||!root.contains(button)||button.disabled)return;
  const pathId=selected,type=button.dataset.learningAction,target=button.dataset.target;
  button.disabled=true;
  try{
   const success=await handlers[type]?.({pathId,target});
   if(success!==false&&type!=='practice')learningPathStore.complete(pathId,type);
  }catch{}
  if(active){render();if(type!=='tool')root.querySelector(`[data-learning-step="${type}"] [data-learning-action]`)?.focus({preventScroll:true});}
 };
 root.addEventListener('click',handleClick);
 ensureLearningPathStyles();root.innerHTML='<p class="small" role="status">正在准备学习路径…</p>';void load();
 return {dispose(){active=false;root.removeEventListener('click',handleClick);root.replaceChildren();},selectPath(id){if(!['tao','gun'].includes(id))return false;selected=id;render();return true;},recordDemoProgress,getState(){return {selected,progress:learningPathStore.getProgress()};}};
}
