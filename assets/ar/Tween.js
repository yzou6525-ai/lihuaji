export const easeOutCubic=t=>1-(1-t)**3;
export const easeInOutCubic=t=>t<.5?4*t*t*t:1-(-2*t+2)**3/2;
export const easeOutBack=t=>t<=0?0:t>=1?1:1+2.70158*(t-1)**3+1.70158*(t-1)**2;

// A standalone tween may drive its own RAF; the AR scene uses manual ticks to share its render loop.
export function animate(from,to,duration,onUpdate,onComplete=()=>{},delay=0,options={}){
  let start=options.start??performance.now(),cancelled=false,done=false,raf=0;
  const easing=options.easing??easeOutCubic;
  const handle={
    update(now){
      if(cancelled||done||now<start+delay)return;
      const t=duration<=0?1:Math.min(1,Math.max(0,(now-start-delay)/duration));
      onUpdate(from+(to-from)*easing(t),t);
      if(t===1){done=true;onComplete();}
    },
    cancel(){cancelled=true;if(raf)cancelAnimationFrame(raf);},
    get finished(){return cancelled||done;}
  };
  if(!options.manual){const step=t=>{handle.update(t);if(!handle.finished)raf=requestAnimationFrame(step);};raf=requestAnimationFrame(step);}
  return handle;
}
export function cancel(handle){handle?.cancel();}
