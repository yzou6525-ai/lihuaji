// A deterministic presentation clock. All heights/timings are illustrative, not MoCap.
export const SANTAO_DURATION=11;
// Orders 32 / 46 sit further inside the existing organization than edge orders 29 / 43.
export const REPRESENTATIVE_ORDERS=Object.freeze([1,32,46]);
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function santaoFrame(seconds) {
  const time=clamp(Number.isFinite(seconds)?seconds:0,0,11);
  let stage,position=0,key=null,caption='',detail='';
  const keyFrame=(batch,start,end)=>{
    const p=clamp((time-start)/(end-start)),cuts=[0,.14,.28,.6,.76,1];
    const found=cuts.findIndex((v,i)=>i>0&&p<v),index=found<0?4:found-1;
    key={order:REPRESENTATIVE_ORDERS[batch-1],progress:p,phase:['出针','抬针','行针','入针','拉线'][index],phaseProgress:clamp((p-cuts[index])/(cuts[index+1]-cuts[index]))};
    position=[0,28,42][batch-1];stage=`batch${batch}-key`;caption=['第一批 · 出边','第二批 · 套入','第三批 · 相嵌'][batch-1];detail=key.phase;
  };
  if(time<1){stage='intro';caption='散套针 · 梨花一瓣数字显影';detail='梨花季原创数字完成面';}
  else if(time<2){stage='reveal';caption='由绣面，看见丝线';detail='数字工艺显影视图';}
  else if(time<3.2)keyFrame(1,2,3.2);
  else if(time<4.5){stage='batch1-fill';position=1+27*clamp((time-3.2)/1.3);caption='第一批 · 出边';detail='外缘相对齐整，内侧针迹长短错落。';}
  else if(time<5.8)keyFrame(2,4.5,5.8);
  else if(time<7){stage='batch2-fill';position=29+13*clamp((time-5.8)/1.2);caption='第二批 · 套入';detail='新针进入前一批丝线组织。';}
  else if(time<8)keyFrame(3,7,8);
  else if(time<9){stage='batch3-fill';position=43+13*clamp(time-8);caption='第三批 · 相嵌';detail='批批相迭 · 针针相嵌';}
  else if(time<10.2){stage='merge';position=56;caption='由针迹，回到绣面';detail='批批相迭 · 针针相嵌';}
  else{stage='complete';position=56;caption='一瓣花，由一批批丝线相嵌而成。';detail='散套针数字工艺示意';}
  const merge=smooth((time-9)/1.2);
  const stitchFractions=Array(56).fill(0),batch=stage.startsWith('batch')?Number(stage[5]):0;
  if(batch){const base=[0,28,42][batch-1],total=[28,14,14][batch-1];stitchFractions.fill(1,0,base);
    if(stage.endsWith('fill')){const chosen=REPRESENTATIVE_ORDERS[batch-1]-1;stitchFractions[chosen]=1;let rest=position-base-1;for(let i=base;i<base+total;i++)if(i!==chosen){stitchFractions[i]=clamp(rest);rest--;}}
  }else if(time>=9)stitchFractions.fill(1);
  return {time,stage,position,key,caption,detail,merge,stitchFractions,surfaceOpacity:time<1?1:time<2?1-smooth(time-1):time<9?0:merge};
}

export function sampleNeedle(stitch,key) {
  const a=[...stitch.start,.12],b=[...stitch.end,.12],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),direction=[dx/length,dy/length];
  const p=key.phaseProgress,u=smooth(p);let tip,slack=1,alpha=1,threadEnd;
  const axis=[-direction[0]*.72,-direction[1]*.72,.69];
  switch(key.phase){
    case '出针':tip=[a[0],a[1],-1+2.2*u];axis[2]=-.8;alpha=smooth(p);threadEnd=[...a];break;
    case '抬针':tip=[a[0],a[1],1.2+2*u];axis[2]=-.8+1.49*u;threadEnd=[...tip];break;
    case '行针':tip=mix(a,b,u);tip[2]=3.2+.6*Math.sin(Math.PI*u);threadEnd=[...tip];break;
    case '入针':tip=[b[0],b[1],3.2-4.2*u];threadEnd=[b[0],b[1],Math.max(.12,tip[2])];break;
    default:tip=[b[0]-axis[0]*10*u,b[1]-axis[1]*10*u,-1-axis[2]*10*u];threadEnd=[...b];slack=1-u;alpha=1-u;
  }
  const control=mix(a,threadEnd,.5);
  // Lateral bow keeps the tiny Z height readable in the existing front-facing camera.
  control[0]+=-direction[1]*5*slack;control[1]+=direction[0]*5*slack;control[2]+=4*slack;
  return {tip,axis,alpha,start:a,end:threadEnd,control,slack};
}
export function quadraticPoint(a,c,b,t){return a.map((v,i)=>(1-t)*(1-t)*v+2*(1-t)*t*c[i]+t*t*b[i]);}

export class SantaoTimeline {
  constructor({onChange=()=>{},requestFrame=cb=>requestAnimationFrame(cb),cancelFrame=id=>cancelAnimationFrame(id),now=()=>performance.now(),clockMode='internal'}={}){
    if(!['internal','manual'].includes(clockMode))throw Error('Unknown timeline clock');
    Object.assign(this,{onChange,requestFrame,cancelFrame,now,clockMode});this.time=0;this.playing=false;this.started=false;this.disposed=false;this.raf=null;
  }
  get state(){return {...santaoFrame(this.time),stage:this.started?santaoFrame(this.time).stage:'idle',playing:this.playing,pendingFrame:this.raf!==null,disposed:this.disposed,duration:SANTAO_DURATION};}
  notify(){if(!this.disposed)this.onChange(this.state);}
  start(){if(this.disposed)return;this.pause();this.time=0;this.started=true;this.resume();}
  pause(){if(this.disposed)return;this.playing=false;if(this.raf!==null)this.cancelFrame(this.raf);this.raf=null;this.notify();}
  resume(){if(this.disposed||this.playing)return;if(this.time>=11)this.time=0;this.started=true;this.playing=true;this.last=this.now();
    const tick=time=>{this.raf=null;this.tick(time);if(!this.disposed&&this.playing)this.raf=this.requestFrame(tick);};
    if(this.clockMode==='internal')this.raf=this.requestFrame(tick);this.notify();
  }
  tick(time){if(this.disposed||!this.playing||!Number.isFinite(time))return;this.time=clamp(this.time+Math.max(0,time-this.last)/1000,0,11);this.last=time;if(this.time>=11)this.playing=false;this.notify();}
  seek(time){if(this.disposed||!Number.isFinite(time))return;this.pause();this.started=true;this.time=clamp(time,0,11);this.notify();}
  restart(){this.start();}
  dispose(){if(this.disposed)return;this.pause();this.disposed=true;this.onChange=()=>{};}
}
