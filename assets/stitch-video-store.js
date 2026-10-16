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
 // Even a future iframe-capable record opens externally until a dedicated embed UI is approved/tested.
 const label=row.sourceType==='official-reference'?'打开官方资料':row.sourceType==='official-course'?'打开官方课程':'打开官方视频';
 return `<article class="card video-card" data-video="${esc(row.id)}"><p class="video-source-mark">${esc(row.organization)}</p><h3>${esc(row.title)}</h3><p>${row.topics.map(esc).join(' · ')}</p>${row.accessStatus!=='verified-page'?`<p class="small">${row.accessStatus==='unavailable'?'当前官方页面暂不可访问':'已核对页面标题，播放状态待原站确认'}</p>`:''}<a class="btn" href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">${label} →</a><p class="small">来源：${esc(row.organization)} · 原站观看</p></article>`;
}
export function mountVideoArchive(root) {
 let active=true;
 root.innerHTML='<h2>官方针法影像</h2><p>整理苏绣相关官方公开影像与课程入口，用于继续观看真实技艺、传承人与针法演示。</p><p class="small">本页仅整理官方公开来源并跳转原站观看，不复制、下载或重新托管视频内容。</p><div data-video-content role="status">正在读取官方影像目录…</div>';
 const content=root.querySelector('[data-video-content]');
 const load=()=>stitchVideoStore.load().then(rows=>{if(active)content.innerHTML='<div class="grid">'+rows.filter(r=>r.sourceType!=='official-reference').map(videoCard).join('')+'</div><h3 style="margin-top:24px">延伸阅读 · 官方工艺背景</h3>'+rows.filter(r=>r.sourceType==='official-reference').map(videoCard).join('');}).catch(()=>{if(active){content.innerHTML='<p>官方影像目录暂未载入，原有练习仍可使用。</p><button>重新加载影像目录</button>';content.querySelector('button').onclick=load;}});
 load();return()=>{active=false;};
}
