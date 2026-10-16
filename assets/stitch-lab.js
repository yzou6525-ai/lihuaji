import {StitchPlayer} from './stitch/StitchPlayer.js';
import {getSuxiuKnowledgeById} from './suxiu-knowledge-store.js';

export const demoCatalogue = Object.freeze([
  {id:'demo-straight-basic',title:'直线针'}, {id:'demo-tao-basic',title:'套针'}, {id:'demo-gun-basic',title:'滚针'}
]);
export function ensureStitchStyles() {
  if(document.querySelector('link[data-stitch-style]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./stitch-lab.css',import.meta.url).href;link.dataset.stitchStyle='';document.head.append(link);
}
export function mountStitchLab(root) {
  ensureStitchStyles();
  root.innerHTML=`<div class="lab-heading"><div><h2>数字针迹实验室</h2><p class="small">数字练习示意 · 一针一针，看路径如何形成。</p></div><label>选择练习<select id="lab-demo">${demoCatalogue.map(d=>`<option value="${d.id}">${d.title}</option>`).join('')}</select></label></div>
    <div class="lab-stage"><div id="lab-canvas"></div><span class="lab-empty">正在准备数字针迹…</span></div>
    <div class="lab-progress"><span id="lab-count" aria-live="polite">当前第 0 针 / 共 0 针</span><span id="lab-percent">0%</span></div>
    <label>逐针进度<input id="lab-scrubber" type="range" min="0" max="1" step="0.01" value="0" disabled></label>
    <div class="lab-controls"><button id="lab-previous" disabled>上一针</button><button id="lab-play" class="primary" disabled>播放</button><button id="lab-next" disabled>下一针</button><button id="lab-restart" disabled>重播</button></div>
    <div class="lab-options"><label>速度<select id="lab-speed"><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="1.5">1.5x</option></select></label><label><input id="lab-points" type="checkbox">显示针落点</label></div>
    <p id="lab-status" role="status">正在加载练习…</p><div class="lab-knowledge" id="lab-knowledge"></div>
    <p class="lab-note">针迹动画为《梨花季》数字练习示意，用于理解路径与先后关系，不替代真实刺绣教学，未经苏绣专家人工审定。</p>`;
  const $=selector=>root.querySelector(selector),stage=$('#lab-canvas');stage.style.cssText='width:100%;height:100%';
  let alive=true,renderer=null,ticket=0,request=null,loading=true,observer=null;
  const player=new StitchPlayer({onChange:state=>{
    if(!alive)return;
    renderer?.update(state);
    $('#lab-count').textContent=`当前第 ${state.current} 针 / 共 ${state.total} 针`;
    $('#lab-percent').textContent=(state.total?Math.round(state.position/state.total*100):0)+'%';
    $('#lab-scrubber').max=String(state.total || 1);$('#lab-scrubber').value=String(state.position);
    $('#lab-scrubber').setAttribute('aria-valuetext',`第 ${state.current} 针，共 ${state.total} 针`);
    $('#lab-play').textContent=state.playing?'暂停':state.position===state.total&&state.total?'重新播放':'播放';
    $('#lab-play').setAttribute('aria-pressed',String(state.playing));
    for(const id of ['lab-play','lab-restart','lab-scrubber'])$('#'+id).disabled=loading||!state.total;
    $('#lab-previous').disabled=loading||state.position<=0;$('#lab-next').disabled=loading||state.position>=state.total;
    $('.lab-empty').hidden=state.position>0;$('.lab-empty').textContent='点击播放，或从下一针开始。';
  }});
  async function load(id) {
    const current=++ticket;request?.abort();request=new AbortController();loading=true;player.pause();$('#lab-knowledge').replaceChildren();
    $('#lab-status').textContent='正在加载练习…';$('#lab-status').className='';
    try {
      if(!demoCatalogue.some(d=>d.id===id))throw Error('练习不存在');
      const response=await fetch(new URL(`../content/stitch-demos/${id}.json`,import.meta.url),{signal:request.signal});
      if(!response.ok)throw Error('针迹资料暂时未载入，请重新选择练习或稍后重试。');
      const data=await response.json();if(!alive||ticket!==current)return;
      player.loadStitchDemo(data);renderer.load(player.data);loading=false;player.notify();
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
  $('#lab-play').onclick=()=>player.playing?player.pause():player.play();$('#lab-restart').onclick=()=>player.restart();
  $('#lab-next').onclick=()=>player.next();$('#lab-previous').onclick=()=>player.previous();
  $('#lab-scrubber').oninput=e=>player.seek(Number(e.target.value));$('#lab-speed').onchange=e=>player.setSpeed(Number(e.target.value));$('#lab-points').onchange=e=>player.setPoints(e.target.checked);
  const pause=()=>player.pause(),visibility=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',visibility);
  const dispose=()=>{
    if(!alive)return;alive=false;ticket++;request?.abort();observer?.disconnect();player.dispose();renderer?.dispose();
    document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',dispose);
    root.querySelectorAll('button,input,select').forEach(el=>{el.onclick=null;el.oninput=null;el.onchange=null;});
  };
  window.addEventListener('pagehide',dispose);
  const diagnostic=()=>({alive,loading,player:player.state,render:renderer?.diagnostics()||null});
  // Read-only diagnostics, no cameras, story content or user records.
  window.lihuaStitchDiagnostics=diagnostic;
  import('./stitch/StitchRenderer.js').then(async({StitchRenderer})=>{
    if(!alive)return;renderer=new StitchRenderer(stage);
    renderer.renderer.domElement.addEventListener('webglcontextlost',e=>{if(!alive)return;e.preventDefault();loading=true;player.pause();$('#lab-status').textContent='图形资源已暂停，请重新进入本页面。';});
    observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)pause();});observer.observe(root);
    await load($('#lab-demo').value);
  }).catch(()=>{if(alive){player.pause();renderer?.dispose();$('#lab-status').textContent='Three.js 或 WebGL 未能启动，请刷新或换用支持 WebGL 的浏览器。下方基础练习和官方影像仍可阅读。';$('#lab-status').className='lab-error';$('.lab-empty').textContent='数字画面暂不可用';}});
  return dispose;
}
