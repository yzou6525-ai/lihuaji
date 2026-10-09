// Tracking state is independent of rendering and timer scheduling, so brief losses cannot replay an opening.
export class TrackingState {
  constructor({grace=700,onFound=()=>{},onLost=()=>{},onState=()=>{}}={}){Object.assign(this,{grace,onFound,onLost,onState});this.reset();}
  reset(){this.target=null;this.lastSeen=0;this.missing=false;this.change('SEARCHING');}
  change(state){if(this.state!==state){this.state=state;this.onState(state);}}
  observe(index,visible,now){
    if(visible){
      const opening=this.target!==index||this.state==='SEARCHING'||this.state==='LOST';
      this.target=index;this.lastSeen=now;this.missing=false;
      if(opening){this.change('FOUND');this.onFound(index);this.change('PLAYING');}
    }else if(index===this.target){this.missing=true;this.tick(now);}
  }
  tick(now){if(this.missing&&this.state!=='LOST'&&this.state!=='SEARCHING'&&now-this.lastSeen>=this.grace){this.change('LOST');this.onLost(this.target);}}
  active(){if(this.state==='PLAYING'||this.state==='FOUND')this.change('ACTIVE');}
}
