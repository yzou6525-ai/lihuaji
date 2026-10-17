const toolHosts=new Set(['ricuci.app']);
const categories=new Set(['机器刺绣文件查看与转换']);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function validateDigitalTools(rows){
 if(!Array.isArray(rows)||!rows.length)throw Error('数字工具目录为空');
 const ids=new Set();
 for(const row of rows){
  for(const key of ['id','title','provider','repository','license','officialWebApp','repositoryUrl','processing','category','displayNote','privacyNote','craftBoundary'])if(typeof row[key]!=='string'||!row[key].trim())throw Error('数字工具目录缺少 '+key);
  const app=new URL(row.officialWebApp),repo=new URL(row.repositoryUrl);
  if(ids.has(row.id)||row.id!=='ricuci'||row.provider!=='Ricuci'||row.repository!=='Federicokalik/embroidery-converter-kit'||row.license!=='MIT'||row.processing!=='client-side'||row.copiedCode!==false||app.protocol!=='https:'||!toolHosts.has(app.hostname)||app.pathname!=='/convert/'||repo.href!=='https://github.com/Federicokalik/embroidery-converter-kit'||!categories.has(row.category))throw Error('数字工具来源、许可证或处理方式无效');
  if(!Array.isArray(row.keywords)||!row.keywords.length||!Array.isArray(row.formatsRead)||!row.formatsRead.length||!Array.isArray(row.formatsWrite)||!row.formatsWrite.length)throw Error('数字工具格式与搜索词无效');
  if(typeof row.iframeTested!=='boolean'||typeof row.iframeAllowed!=='boolean'||row.iframeAllowed&&!row.iframeTested)throw Error('Ricuci iframe 未经实际验证');
  if(row.iframeTested){const test=row.iframeTest;if(!test||test.testedAt!=='2026-10-17'||test.browser!=='Microsoft Edge via Playwright'||test.httpStatus!==200||typeof test.actualFrameLoad!=='boolean'||test.actualFrameLoad!==row.iframeAllowed)throw Error('Ricuci iframe 验收记录无效');}
  ids.add(row.id);
 }
 return rows;
}

export function createDigitalToolStore(fetcher=(...args)=>fetch(...args)){
 let cache=null,pending=null;
 async function load(){
  if(cache)return cache;
  if(!pending)pending=(async()=>{const r=await fetcher(new URL('../content/digital-tools.json',import.meta.url));if(!r.ok)throw Error('数字工具目录暂未载入');return cache=validateDigitalTools(await r.json());})().finally(()=>{pending=null;});
  return pending;
 }
 async function search(query=''){
  const tokens=String(query).normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return (await load()).filter(tool=>tokens.every(token=>[tool.title,tool.provider,tool.category,tool.repository,...tool.keywords,...tool.formatsRead,...tool.formatsWrite].join(' ').toLowerCase().includes(token)));
 }
 return {load,search};
}

export const digitalToolStore=createDigitalToolStore();

export function ensureDigitalToolsStyles(){
 let style=document.querySelector('link[data-digital-tools-style]');
 if(!style){style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./digital-tools.css',import.meta.url).href;style.dataset.digitalToolsStyle='';document.head.append(style);}
 return style;
}

export function digitalToolSearchCard(tool){
 return `<article class="card digital-tool-card digital-tool-search-card" data-digital-tool="${esc(tool.id)}"><p class="digital-tool-mark">${esc(tool.provider)} · ${esc(tool.license)} 开源许可</p><h3>${esc(tool.title)}</h3><p>${esc(tool.category)} · 支持 DST / PES / JEF 等多种机器刺绣格式。</p><p class="small">${esc(tool.craftBoundary)}</p><a class="btn" href="#ar">在教学页打开工具入口 →</a></article>`;
}

function cardMarkup(tool){
 const formatList=tool.formatsRead.map(x=>x+'.').join(' / ');
 return `<article class="card digital-tool-card" data-digital-tool="${esc(tool.id)}"><div class="digital-tool-card-head"><div><p class="digital-tool-mark">${esc(tool.provider)} · 开源工具 · ${esc(tool.license)}</p><h2>${esc(tool.title)}</h2><p>${esc(tool.displayNote)}</p></div><a class="digital-tool-outlink" href="${esc(tool.officialWebApp)}" target="_blank" rel="noopener noreferrer">打开 Ricuci 官方站 ↗</a></div><p class="digital-tool-local-note">${esc(tool.privacyNote)}</p><p class="digital-tool-boundary">${esc(tool.craftBoundary)}</p><p class="small digital-tool-formats">支持读取例如 DST / PES / JEF 等多种机器刺绣格式。</p><details class="digital-tool-details"><summary>查看完整格式与项目信息</summary><p><strong>可读取：</strong>${esc(formatList)}</p><p><strong>可导出：</strong>${tool.formatsWrite.map(esc).join(' / ')}</p><p><strong>代码许可证：</strong>MIT。梨花季仅链接官方 Web 工具，未复制源代码；不包含其独立许可的字体或 GSAP。</p><a href="${esc(tool.repositoryUrl)}" target="_blank" rel="noopener noreferrer">Ricuci GitHub 源码与许可证 →</a></details><div class="digital-tool-actions"><button type="button" class="primary" data-digital-open>打开工具</button><span class="small" data-digital-status role="status">工具默认未加载；点击后在本页打开。</span></div><div class="digital-tool-frame" data-digital-frame hidden></div></article>`;
}

export function mountDigitalTools(root){
 let active=true,frame=null;
 let readyPromise=Promise.resolve(false);
 const showError=()=>{if(active){root.innerHTML='<p class="small">数字工具目录暂未载入，其他教学内容不受影响。</p><button type="button" data-digital-retry>重新加载</button>';root.querySelector('[data-digital-retry]').onclick=()=>{readyPromise=load();};}};
 const load=async()=>{
  try{
   const [tool]=await digitalToolStore.load();if(!active)return;
   root.innerHTML=cardMarkup(tool);
   const open=root.querySelector('[data-digital-open]'),container=root.querySelector('[data-digital-frame]'),status=root.querySelector('[data-digital-status]');
   const close=()=>{frame?.remove();frame=null;container.replaceChildren();container.hidden=true;open.disabled=false;open.textContent='打开工具';status.textContent='工具已关闭，页面资源已释放。';};
   open.onclick=()=>{
    if(!tool.iframeAllowed){window.open(tool.officialWebApp,'_blank','noopener,noreferrer');status.textContent='已在新标签页打开 Ricuci 官方工具。';return;}
    if(frame)return;
    open.disabled=true;open.textContent='工具已打开';container.hidden=false;
    const controls=document.createElement('div');controls.className='digital-tool-frame-controls';
    const closeButton=document.createElement('button');closeButton.type='button';closeButton.textContent='关闭工具';closeButton.dataset.digitalClose='';closeButton.setAttribute('aria-label','关闭并卸载 Ricuci 数字刺绣工具');closeButton.onclick=close;controls.append(closeButton);
    frame=document.createElement('iframe');frame.className='digital-tool-iframe';frame.title='Ricuci 数字刺绣文件查看与转换工具';frame.src=tool.officialWebApp;frame.loading='eager';frame.referrerPolicy='strict-origin-when-cross-origin';
    container.append(controls,frame);status.textContent='Ricuci 官方工具已在本页载入；文件由该浏览器工具处理。';
   };
  }catch{showError();return false;}
  return true;
 };
 ensureDigitalToolsStyles();
 readyPromise=load();
 const dispose=()=>{active=false;frame?.remove();root.replaceChildren();};
 dispose.focusOpenButton=async()=>{await readyPromise;if(!active)return false;const button=root.querySelector('[data-digital-open]');if(!button)return false;button.focus({preventScroll:true});return true;};
 return dispose;
}
