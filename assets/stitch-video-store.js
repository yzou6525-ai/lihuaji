export const videoHosts=new Set(['tv.cctv.com','www.icourse163.org','szfy.wglj.suzhou.com.cn']);
export function validateVideoSources(rows) {
 if(!Array.isArray(rows)||!rows.length)throw Error('影像来源目录为空');
 const ids=new Set();
 for(const row of rows){
   for(const key of ['id','title','organization','sourceType','url','rightsNote','accessedDate','verificationNote'])if(typeof row[key]!=='string'||!row[key].trim())throw Error('影像来源缺少 '+key);
   const url=new URL(row.url);
   if(ids.has(row.id)||row.official!==true||url.protocol!=='https:'||url.username||url.password||!videoHosts.has(url.hostname)||!['external','iframe'].includes(row.embedMode))throw Error('影像来源不符合官方链接协议');
   if(!Array.isArray(row.topics)||!row.topics.length||row.topics.some(x=>typeof x!=='string'||!x.trim()))throw Error('影像主题无效');
   if(!['official-video','official-course','official-reference'].includes(row.sourceType)||!['verified-page','partial-page','unavailable'].includes(row.accessStatus)||!/^\d{4}-\d{2}-\d{2}$/.test(row.accessedDate))throw Error('影像核验状态无效');
   if(row.downloaded!==false||row.hostedLocally!==false||row.embedMode==='iframe'&&row.iframeTested!==true)throw Error('禁止未经核验的嵌入或本地视频副本');
   ids.add(row.id);
 }
 return rows;
}

const demoKnowledgePairs=new Map([['demo-tao-basic','stitch-tao'],['demo-gun-basic','stitch-gun']]);
export function validateOfficialCourse(course) {
 const fail=()=>{throw Error('官方课程目录格式不正确');};
 if(!course||course.id!=='sgmart-suxiu-course'||course.sourceId!=='mooc-suxiu'||course.official!==true)fail();
 for(const key of ['title','organization','platform','description','courseUrl'])if(typeof course[key]!=='string'||!course[key].trim())fail();
 if(new URL(course.courseUrl).href!=='https://www.icourse163.org/course/SGMART-1206997809')fail();
 if(!Array.isArray(course.modules)||course.modules.length!==5)fail();
 const ids=new Set();
 for(const module of course.modules){
  for(const key of ['id','title','section','type'])if(typeof module[key]!=='string'||!module[key].trim())fail();
  if(ids.has(module.id)||module.official!==true||module.courseUrl!==course.courseUrl||!['lecture','virtual-practice'].includes(module.type))fail();
  if(!Array.isArray(module.topics)||!module.topics.length||!Array.isArray(module.knowledgeIds)||!Array.isArray(module.localDemoIds))fail();
  if(module.knowledgeIds.some(id=>typeof id!=='string'||!/^[a-z0-9-]+$/.test(id)))fail();
  if(module.localDemoIds.some(id=>!demoKnowledgePairs.has(id)||!module.knowledgeIds.includes(demoKnowledgePairs.get(id))))fail();
  ids.add(module.id);
 }
 const stitches=course.modules.find(module=>module.id==='mooc-suxiu-02');
 const roll=course.modules.find(module=>module.id==='mooc-suxiu-03');
 const dog=course.modules.find(module=>module.id==='mooc-suxiu-05');
 if(!stitches?.title.includes('齐针')||!stitches.title.includes('套针')||JSON.stringify(stitches.localDemoIds)!==JSON.stringify(['demo-tao-basic']))fail();
 if(stitches.localDemoIds.includes('demo-straight-basic'))fail();
 if(!roll?.title.includes('滚针')||!roll.title.includes('打籽')||JSON.stringify(roll.localDemoIds)!==JSON.stringify(['demo-gun-basic']))fail();
 if(!dog?.title.includes('生肖肖像-狗')||dog.type!=='virtual-practice'||dog.localDemoIds.length)fail();
 return course;
}
export function createOfficialCourseStore(fetcher=(...args)=>fetch(...args)) {
 let cache=null,pending=null;
 async function load(){
  if(cache)return cache;
  if(!pending)pending=(async()=>{const r=await fetcher(new URL('../content/suxiu-official-course.json',import.meta.url));if(!r.ok)throw Error('官方课程目录暂未载入');return cache=validateOfficialCourse(await r.json());})().finally(()=>{pending=null;});
  return pending;
 }
 return {load};
}
export const officialCourseStore=createOfficialCourseStore();

export function searchVideoRows(rows,query='') {
 const tokens=query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
 return rows.filter(row=>{const words=[row.title,row.organization,...row.topics,row.sourceType==='official-reference'?'延伸阅读 官方工艺背景':'官方影像 视频 课程'].join(' ').toLowerCase();return tokens.every(t=>words.includes(t));});
}
export function createVideoStore(fetcher=(...args)=>fetch(...args)) {
 let cache=null,pending=null;
 async function load(){
  if(cache)return cache;
  if(!pending)pending=(async()=>{const r=await fetcher(new URL('../content/stitch-video-sources.json',import.meta.url));if(!r.ok)throw Error('官方影像目录暂未载入');return cache=validateVideoSources(await r.json());})().finally(()=>{pending=null;});
  return pending;
 }
 return {load,search:async query=>searchVideoRows(await load(),query)};
}
export const stitchVideoStore=createVideoStore();
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function videoCard(row) {
 if(row.sourceType==='official-course')return `<article class="card video-card" data-video="${esc(row.id)}"><p class="video-source-mark">${esc(row.organization)} · 官方公开课程来源</p><h3>${esc(row.title)}</h3><p>${row.topics.map(esc).join(' · ')}</p><a class="btn" href="#ar/mooc-suxiu">在教学页查看课程目录</a><p class="small">课程内容由课程提供方和中国大学MOOC发布；梨花季仅整理目录并关联本地数字练习。</p></article>`;
 const label=row.sourceType==='official-reference'?'打开官方资料':row.sourceType==='official-course'?'打开官方课程':'打开官方视频';
 return `<article class="card video-card" data-video="${esc(row.id)}"><p class="video-source-mark">${esc(row.organization)}</p><h3>${esc(row.title)}</h3><p>${row.topics.map(esc).join(' · ')}</p>${row.accessStatus!=='verified-page'?`<p class="small">${row.accessStatus==='unavailable'?'当前官方页面暂不可访问':'已核对页面标题，播放状态待原站确认'}</p>`:''}<a class="btn" href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">${label} →</a><p class="small">来源：${esc(row.organization)} · 原站观看</p></article>`;
}
export function mountVideoArchive(root,{openCourse=false}={}) {
 let active=true;
 root.innerHTML='<h2>官方针法影像</h2><p>整理苏绣相关官方公开影像与课程入口，用于继续观看真实技艺、传承人与针法演示。</p><p class="small">课程与影像由原提供方发布。本页只整理公开目录和来源，不复制、下载或重新托管课程内容。</p><div data-video-content role="status">正在读取官方影像目录…</div>';
 const content=root.querySelector('[data-video-content]');
 const knowledgeLabels=new Map([['stitch-tao','套针知识'],['stitch-gun','滚针知识'],['stitch-dazi','打籽知识'],['tool-needle','绣针知识'],['craft-plain','平绣知识']]);
 const courseCard=(course)=>{
  const contentMarkup=module=>{
   const knowledgeLinks=module.knowledgeIds.map(id=>knowledgeLabels.has(id)?`<a href="#guide/${encodeURIComponent(id)}">${knowledgeLabels.get(id)}</a>`:'').filter(Boolean).join('')||'<span class="small">课程体验文件由官方提供</span>';
   const practice=module.localDemoIds.map(id=>`<button class="text-link official-course-practice" type="button" data-course-practice="${esc(id)}">开始${id==='demo-tao-basic'?'套针':'滚针'}数字练习</button>`).join('')||'<span class="small">本地暂无对应数字练习</span>';
   let note='';
   if(module.id==='mooc-suxiu-02')note='课程包含齐针、套针演示；当前梨花季数字练习仅提供套针。未将直线针映射为齐针。';
   if(module.id==='mooc-suxiu-03')note='滚针可进入数字练习；打籽提供知识档案入口，当前没有对应数字练习。';
   if(module.id==='mooc-suxiu-04')note='这是官方《梅花》课程节点。梨花季不以梨花练习替代梅花课程。';
   if(module.id==='mooc-suxiu-05')note='苏绣技能虚拟实践课题：官方课程采用数字化虚拟刺绣方式帮助学习者排列针脚，并提供原创“生肖肖像”图形模板体验；当前节点为“生肖肖像-狗”。体验文件请从官方课程获取。梨花季不下载、不托管或解析该文件。';
   const buttonText=module.type==='virtual-practice'?'前往官方课程获取体验文件':'进入官方课程播放';
   const viewer=course.embedMode==='iframe'&&course.iframeTested===true
    ?`<div class="official-course-frame-wrap"><iframe class="official-course-frame" title="${esc(course.title)} · 中国大学MOOC官方课程" src="${esc(module.courseUrl)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; fullscreen"></iframe><p class="small">官方课程 · 中国大学MOOC · 内容由官方服务器提供</p></div>`
    :'<div class="official-course-frame-fallback" role="status"><strong>课程在中国大学MOOC官方页面播放</strong><p>梨花季在此保留章节选择与数字练习。请使用上方按钮进入官方课程；选课、登录与视频播放由原平台处理。</p></div>';
   return `<div class="official-course-viewer" aria-label="官方课程观看区"><div class="official-course-viewer-heading"><div><p class="small">${esc(course.organization)} · ${esc(course.platform)}</p><h4 data-course-current-title>${esc(module.title)}</h4><p class="small">课程视频和学习权限由中国大学MOOC提供；需要登录或选课时，请按原平台提示操作。若下方页面未显示，请使用右侧按钮在官方平台打开。</p></div><a class="btn primary" data-official-course-link href="${esc(module.courseUrl)}" target="_blank" rel="noopener noreferrer">${buttonText}</a></div>${viewer}<div class="official-course-links"><div><strong>课程来源</strong><a href="${esc(course.courseUrl)}" target="_blank" rel="noopener noreferrer">查看官方课程原页</a></div><div><strong>针法知识</strong><span data-course-knowledge>${knowledgeLinks}</span></div><div><strong>数字练习</strong><span data-course-practice>${practice}</span></div></div><p class="small official-course-note" data-course-note ${note?'':'hidden'}>${esc(note)}</p></div>`;
  };
  let card=null;
  const render=(moduleId,scrollViewer=false)=>{
   const selected=course.modules.find(m=>m.id===moduleId)||course.modules[0];
   if(!card){
    content.insertAdjacentHTML('afterbegin',`<article class="card official-course" data-official-course="${esc(course.id)}"><div class="official-course-head"><div><p class="official-course-label">官方公开课程来源</p><h3>${esc(course.title)}</h3><p>${esc(course.organization)} · ${esc(course.platform)}</p></div><span class="official-course-seal" aria-hidden="true">绣</span></div><p class="official-course-description">${esc(course.description)}</p><h4>课程目录</h4><ol class="official-course-modules">${course.modules.map((module,index)=>`<li><button class="official-course-module" type="button" data-course-module="${esc(module.id)}" aria-pressed="false"><span class="course-number">${String(index+1).padStart(2,'0')}</span><span class="course-module-copy"><strong>${esc(module.title)}</strong><small>${esc(module.section)} · ${module.topics.map(esc).join('、')}</small></span><span class="course-module-mark" aria-hidden="true">查看</span></button></li>`).join('')}</ol>${contentMarkup(selected)}<p class="small official-course-source">课程来源：${esc(course.organization)} · ${esc(course.platform)} · <a href="${esc(course.courseUrl)}" target="_blank" rel="noopener noreferrer">查看官方课程原页</a></p></article>`);
    card=content.querySelector('[data-official-course]');
    card.querySelectorAll('[data-course-module]').forEach(button=>button.onclick=()=>render(button.dataset.courseModule,true));
   }
   card.querySelectorAll('[data-course-module]').forEach(button=>{const current=button.dataset.courseModule===selected.id;button.setAttribute('aria-pressed',String(current));button.querySelector('.course-module-mark').textContent=current?'已选':'查看';});
   card.querySelector('[data-course-current-title]').textContent=selected.title;
   const link=card.querySelector('[data-official-course-link]');link.href=selected.courseUrl;link.textContent=selected.type==='virtual-practice'?'前往官方课程获取体验文件':'进入官方课程播放';
   const knowledgeLinks=selected.knowledgeIds.map(id=>knowledgeLabels.has(id)?`<a href="#guide/${encodeURIComponent(id)}">${knowledgeLabels.get(id)}</a>`:'').filter(Boolean).join('')||'<span class="small">课程体验文件由官方提供</span>';
   card.querySelector('[data-course-knowledge]').innerHTML=knowledgeLinks;
   const practice=selected.localDemoIds.map(id=>`<button class="text-link official-course-practice" type="button" data-course-practice="${esc(id)}">开始${id==='demo-tao-basic'?'套针':'滚针'}数字练习</button>`).join('')||'<span class="small">本地暂无对应数字练习</span>';
   card.querySelector('[data-course-practice]').innerHTML=practice;
   const practiceButton=card.querySelector('[data-course-practice] button');if(practiceButton)practiceButton.onclick=()=>startPractice(practiceButton.dataset.coursePractice);
   const note=card.querySelector('[data-course-note]');note.textContent='';note.hidden=true;
   if(selected.id==='mooc-suxiu-02')note.textContent='课程包含齐针、套针演示；当前梨花季数字练习仅提供套针。未将直线针映射为齐针。';
   if(selected.id==='mooc-suxiu-03')note.textContent='滚针可进入数字练习；打籽提供知识档案入口，当前没有对应数字练习。';
   if(selected.id==='mooc-suxiu-04')note.textContent='这是官方《梅花》课程节点。梨花季不以梨花练习替代梅花课程。';
   if(selected.id==='mooc-suxiu-05')note.textContent='苏绣技能虚拟实践课题：官方课程采用数字化虚拟刺绣方式帮助学习者排列针脚，并提供原创“生肖肖像”图形模板体验；当前节点为“生肖肖像-狗”。体验文件请从官方课程获取。梨花季不下载、不托管或解析该文件。';
   note.classList.toggle('official-course-virtual-note',selected.id==='mooc-suxiu-05');
   note.hidden=!note.textContent;
   if(scrollViewer)card.querySelector('.official-course-viewer').scrollIntoView({behavior:'smooth',block:'nearest'});
   else if(openCourse)card.scrollIntoView({behavior:'smooth',block:'start'});
  };
  const startPractice=id=>{const lab=root.ownerDocument.querySelector('#stitch-lab'),picker=lab?.querySelector('#lab-demo');if(!lab||!picker)return;picker.value=id;picker.dispatchEvent(new Event('change',{bubbles:true}));lab.setAttribute('tabindex','-1');lab.scrollIntoView({behavior:'smooth',block:'start'});lab.focus({preventScroll:true});};
  render(course.modules[0].id);
 };
 const load=()=>Promise.all([stitchVideoStore.load(),officialCourseStore.load()]).then(([rows,course])=>{if(!active)return;content.innerHTML='<div class="grid">'+rows.filter(r=>r.sourceType==='official-video').map(videoCard).join('')+'</div><h3 style="margin-top:24px">延伸阅读 · 官方工艺背景</h3>'+rows.filter(r=>r.sourceType==='official-reference').map(videoCard).join('');courseCard(course);}).catch(()=>{if(active){content.innerHTML='<p>官方影像或课程目录暂未载入，原有练习仍可使用。</p><button>重新加载影像目录</button>';content.querySelector('button').onclick=load;}});
 load();return()=>{active=false;};
}
