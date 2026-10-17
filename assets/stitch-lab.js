import {StitchPlayer} from './stitch/StitchPlayer.js';
import {getSuxiuKnowledgeById} from './suxiu-knowledge-store.js';

export const demoCatalogue = Object.freeze([
  {id:'demo-straight-basic',title:'直线针'}, {id:'demo-tao-basic',title:'套针'}, {id:'demo-gun-basic',title:'滚针'},
  {id:'demo-santao-pear-petal',title:'散套针 · 梨花瓣数字示意'}
]);
export function ensureStitchStyles() {
  if(document.querySelector('link[data-stitch-style]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./stitch-lab.css',import.meta.url).href;link.dataset.stitchStyle='';document.head.append(link);
}
export function mountStitchLab(root) {
  ensureStitchStyles();
  root.innerHTML=`<div class="lab-heading"><div><h2>数字针迹实验室</h2><p class="small">数字练习示意 · 一针一针，看路径如何形成。</p></div><label>选择练习<select id="lab-demo">${demoCatalogue.map(d=>`<option value="${d.id}">${d.title}</option>`).join('')}</select></label></div>
    <div class="lab-stage"><div id="lab-canvas"></div><span class="lab-empty">正在准备数字针迹…</span></div>
    <div id="lab-cinematic" hidden>
      <button id="lab-cinema-start" class="primary">播放数字显影</button>
      <div id="lab-cinema-controls" hidden>
        <div class="lab-cinema-caption"><div><p id="lab-cinema-caption"></p><p id="lab-cinema-detail" class="small"></p></div><span id="lab-cinema-time" class="small">0.0 / 11.0 秒</span></div>
        <label>数字显影进度<input id="lab-cinema-scrubber" type="range" min="0" max="11" step="0.01" value="0"></label>
        <div class="lab-controls"><button id="lab-cinema-play">暂停显影</button><button id="lab-cinema-restart">重播显影</button><button id="lab-cinema-exit">返回逐针</button></div>
      </div>
      <p class="lab-note lab-cinema-note">本体验依据《梨花季》已核验的散套针公开资料进行数字工艺示意。梨花瓣造型、56条示意针迹、针尖运动、空间高度及动画时间均为项目数字视觉设计，并非某件历史苏绣作品的逐针复原，未经苏绣专家人工审定。<br>高亮仅用于数字结构说明，不代表真实丝线配色。</p>
    </div>
    <div id="lab-ordinary-controls"><div class="lab-progress"><span id="lab-count" aria-live="polite">当前第 0 针 / 共 0 针</span><span id="lab-batch" class="small" hidden></span><span id="lab-percent">0%</span></div>
    <label>逐针进度<input id="lab-scrubber" type="range" min="0" max="1" step="0.01" value="0" disabled></label>
    <div class="lab-controls"><button id="lab-previous" disabled>上一针</button><button id="lab-play" class="primary" disabled>播放</button><button id="lab-next" disabled>下一针</button><button id="lab-restart" disabled>重播</button></div>
    <div class="lab-options"><label>速度<select id="lab-speed"><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="1.5">1.5x</option></select></label><label><input id="lab-points" type="checkbox">显示针落点</label><label><input id="lab-plan" type="checkbox">显示完整针迹计划</label><span class="lab-view-tools"><button id="lab-fit" type="button">适合画布</button><span id="lab-zoom" class="small" aria-live="polite">视图 100%</span></span></div></div>
    <p id="lab-status" role="status">正在加载练习…</p><div class="lab-knowledge" id="lab-knowledge"></div>
    <p class="lab-note" id="lab-authenticity">针迹动画为《梨花季》数字练习示意，用于理解路径与先后关系，不替代真实刺绣教学，未经苏绣专家人工审定。</p><p class="lab-note" id="lab-color-note" hidden></p>`;
  const $=selector=>root.querySelector(selector),stage=$('#lab-canvas');stage.style.cssText='width:100%;height:100%';
  let alive=true,renderer=null,ticket=0,request=null,loading=true,observer=null,cinema=null,cinemaEpoch=0,cinemaStarting=false,lastCinema=null;
  const player=new StitchPlayer({onChange:state=>{
    if(!alive)return;
    if(!cinema)renderer?.update(state);
    $('#lab-count').textContent=`当前第 ${state.current} 针 / 共 ${state.total} 针`;
    const group=player.data?.stitches[Math.max(0,state.current-1)]?.group;
    const batch=player.data?.batches?.find(b=>b.group===group);
    $('#lab-batch').hidden=!batch;$('#lab-batch').textContent=batch?.label || '';
    $('#lab-percent').textContent=Math.round(state.normalizedProgress*100)+'%';
    $('#lab-scrubber').max=String(state.total || 1);$('#lab-scrubber').value=String(state.position);
    $('#lab-scrubber').setAttribute('aria-valuetext',`第 ${state.current} 针，共 ${state.total} 针`);
    $('#lab-play').textContent=state.playing?'暂停':state.position===state.total&&state.total?'重新播放':'播放';
    $('#lab-play').setAttribute('aria-pressed',String(state.playing));
    for(const id of ['lab-play','lab-restart','lab-scrubber'])$('#'+id).disabled=loading||!state.total;
    $('#lab-previous').disabled=loading||state.position<=0;$('#lab-next').disabled=loading||state.position>=state.total;
    $('.lab-empty').hidden=!!cinema||state.position>0;$('.lab-empty').textContent='点击播放，或从下一针开始。';
  }});
  function leaveCinema(){
    cinemaEpoch++;cinemaStarting=false;
    if(cinema){cinema.dispose();lastCinema=cinema.diagnostics();cinema=null;}
    root.classList.remove('lab-cinematic-active');
    $('#lab-cinema-controls').hidden=true;$('#lab-cinema-start').hidden=false;$('#lab-cinema-start').disabled=loading;
    $('#lab-ordinary-controls').hidden=false;player.notify();
  }
  async function startCinema(){
    if(loading||cinemaStarting||!renderer||player.data?.id!=='demo-santao-pear-petal')return;
    if(cinema){cinema.restart();return;}
    player.pause();const epoch=++cinemaEpoch;cinemaStarting=true;$('#lab-cinema-start').disabled=true;
    try{
      const {SantaoExperience}=await import('./stitch/SantaoExperience.js');
      if(!alive||epoch!==cinemaEpoch||player.data?.id!=='demo-santao-pear-petal')return;
      cinema=new SantaoExperience(renderer,player.data,{onChange:state=>{
        if(!alive)return;
        $('#lab-cinema-caption').textContent=state.caption;$('#lab-cinema-detail').textContent=state.detail;
        $('#lab-cinema-time').textContent=state.time.toFixed(1)+' / 11.0 秒';$('#lab-cinema-scrubber').value=String(state.time);
        $('#lab-cinema-scrubber').setAttribute('aria-valuetext',`${state.time.toFixed(1)}秒，${state.caption}，${state.detail}`);
        $('#lab-cinema-play').textContent=state.playing?'暂停显影':state.time>=11?'重新显影':'继续显影';$('#lab-cinema-play').setAttribute('aria-pressed',String(state.playing));
        $('#lab-ordinary-controls').hidden=state.time<11;
        if(state.time>=11&&player.position!==56)player.seek(56);
      }});
      cinemaStarting=false;root.classList.add('lab-cinematic-active');$('#lab-cinema-start').hidden=true;$('#lab-cinema-controls').hidden=false;$('.lab-empty').hidden=true;
      // Reduced-motion visitors can scrub the same complete experience without autoplay.
      if(matchMedia('(prefers-reduced-motion: reduce)').matches)cinema.seek(0);else cinema.start();
    }catch{
      if(alive&&epoch===cinemaEpoch){leaveCinema();$('#lab-status').textContent='数字显影暂未载入，可继续逐针查看，或重新点击播放数字显影。';}
    }finally{if(alive&&epoch===cinemaEpoch){cinemaStarting=false;$('#lab-cinema-start').disabled=false;}}
  }
  async function load(id) {
    leaveCinema();$('#lab-cinematic').hidden=true;
    const current=++ticket;request?.abort();request=new AbortController();loading=true;player.pause();$('#lab-knowledge').replaceChildren();
    $('#lab-status').textContent='正在加载练习…';$('#lab-status').className='';
    try {
      if(!demoCatalogue.some(d=>d.id===id))throw Error('练习不存在');
      const response=await fetch(new URL(`../content/stitch-demos/${id}.json`,import.meta.url),{signal:request.signal});
      if(!response.ok)throw Error('针迹资料暂时未载入，请重新选择练习或稍后重试。');
      const data=await response.json();if(!alive||ticket!==current)return;
      player.loadStitchDemo(data);renderer.load(player.data);loading=false;player.notify();
      $('#lab-cinematic').hidden=data.id!=='demo-santao-pear-petal';$('#lab-cinema-start').disabled=false;
      $('#lab-authenticity').textContent=data.authenticityNote || '针迹动画为《梨花季》数字练习示意，用于理解路径与先后关系，不替代真实刺绣教学，未经苏绣专家人工审定。';
      $('#lab-color-note').textContent=data.colorNote || '';$('#lab-color-note').hidden=!data.colorNote;
      $('#lab-status').textContent=data.title+' · 项目自编练习';
      if(data.knowledgeId){
        try{const k=await getSuxiuKnowledgeById(data.knowledgeId);if(!alive||ticket!==current)return;
          if(k){const p=document.createElement('p');p.textContent='相关知识：'+k.title+'。'+k.summary;
            const a=document.createElement('a');a.className='text-link';a.textContent='查看完整知识档案 →';a.href='#guide/'+encodeURIComponent(k.id);$('#lab-knowledge').append(p,a);
            const note=document.createElement('p');note.className='small';note.textContent='知识出处见档案；本示意的坐标、针序与配色为项目自编，并非来源提供的逐针数据。';$('#lab-knowledge').append(note);
          }else $('#lab-knowledge').textContent='关联知识资料待补充；本示意为项目自编练习。';
        }catch{if(alive&&ticket===current)$('#lab-knowledge').textContent='知识档案暂未载入，数字练习仍可使用。';}
      }else $('#lab-knowledge').textContent='本练习尚无对应官方知识条目，不作为官方教学。';
    }catch(error){if(alive&&ticket===current&&error.name!=='AbortError'){loading=true;player.pause();$('#lab-status').className='lab-error';$('#lab-status').textContent=error instanceof SyntaxError?'针迹 JSON 损坏，请选择其他练习。':error.message;}}
  }
  $('#lab-demo').onchange=e=>{if(renderer)load(e.target.value);};
  const ordinary=action=>{if(cinema||cinemaStarting)leaveCinema();action();};
  $('#lab-play').onclick=()=>ordinary(()=>player.playing?player.pause():player.play());$('#lab-restart').onclick=()=>ordinary(()=>player.restart());
  $('#lab-next').onclick=()=>ordinary(()=>player.next());$('#lab-previous').onclick=()=>ordinary(()=>player.previous());
  $('#lab-scrubber').oninput=e=>{const value=Number(e.target.value);ordinary(()=>player.seek(value));};$('#lab-speed').onchange=e=>ordinary(()=>player.setSpeed(Number(e.target.value)));$('#lab-points').onchange=e=>ordinary(()=>player.setPoints(e.target.checked));
  $('#lab-plan').onchange=e=>ordinary(()=>renderer?.setPlanVisible(e.target.checked));$('#lab-fit').onclick=()=>ordinary(()=>renderer?.fitToData());
  $('#lab-cinema-start').onclick=startCinema;$('#lab-cinema-exit').onclick=leaveCinema;
  $('#lab-cinema-play').onclick=()=>{if(cinema){if(cinema.timeline.playing)cinema.pause();else cinema.resume();}};
  $('#lab-cinema-restart').onclick=()=>cinema?.restart();$('#lab-cinema-scrubber').oninput=e=>cinema?.seek(Number(e.target.value));
  const pause=()=>{cinema?.pause();player.pause();},visibility=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',visibility);
  const dispose=()=>{
    if(!alive)return;alive=false;ticket++;cinemaEpoch++;request?.abort();observer?.disconnect();cinema?.dispose();if(cinema)lastCinema=cinema.diagnostics();cinema=null;player.dispose();renderer?.dispose();
    document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',dispose);
    root.querySelectorAll('button,input,select').forEach(el=>{el.onclick=null;el.oninput=null;el.onchange=null;});
  };
  window.addEventListener('pagehide',dispose);
  const diagnostic=()=>({alive,loading,owner:cinema?'cinematic':'ordinary',cinemaStarting,cinema:cinema?.diagnostics()||lastCinema,player:player.state,view:renderer?.getViewState()||{zoom:1,panX:0,panY:0,planVisible:false},render:renderer?.diagnostics()||null});
  // Read-only diagnostics, no cameras, story content or user records.
  window.lihuaStitchDiagnostics=diagnostic;
  import('./stitch/StitchRenderer.js').then(async({StitchRenderer})=>{
    if(!alive)return;renderer=new StitchRenderer(stage);renderer.onViewChange=view=>{$('#lab-zoom').textContent=`视图 ${Math.round(view.zoom*100)}%`;$('#lab-plan').checked=view.planVisible;};
    renderer.renderer.domElement.addEventListener('webglcontextlost',e=>{if(!alive)return;e.preventDefault();loading=true;pause();$('#lab-cinema-start').disabled=true;$('#lab-cinema-controls').querySelectorAll('button,input').forEach(el=>el.disabled=true);$('#lab-status').textContent='图形资源已暂停，请重新进入本页面。';$('#lab-status').className='lab-error';root.classList.remove('lab-cinematic-active');});
    observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)pause();});observer.observe(root);
    await load($('#lab-demo').value);
  }).catch(()=>{if(alive){player.pause();renderer?.dispose();$('#lab-status').textContent='Three.js 或 WebGL 未能启动，请刷新或换用支持 WebGL 的浏览器。下方基础练习和官方影像仍可阅读。';$('#lab-status').className='lab-error';$('.lab-empty').textContent='数字画面暂不可用';}});
  return dispose;
}
