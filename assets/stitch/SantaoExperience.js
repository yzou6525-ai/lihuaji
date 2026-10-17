import {SantaoTimeline} from './SantaoTimeline.js';
import {SantaoVisual} from './SantaoVisual.js';

// Stitch Lab host: the shared visual owns no renderer, camera or clock.
export class SantaoExperience {
  constructor(renderer,data,{onChange=()=>{}}={}){
    this.renderer=renderer;this.disposed=false;
    this.saved={zoom:renderer.camera.zoom,z:renderer.camera.position.z,clipping:renderer.renderer.localClippingEnabled};
    this.visual=new SantaoVisual(renderer,data,renderer.scene);
    renderer.camera.position.z=30;renderer.renderer.localClippingEnabled=true;
    this.timeline=new SantaoTimeline({onChange:state=>{
      this.visual.update(state);
      renderer.camera.zoom=1+(state.stage==='batch2-key'?.12*Math.sin(Math.PI*state.key.progress):0);
      renderer.camera.updateProjectionMatrix();renderer.render();onChange(state);
    }});
  }
  start(){this.timeline.start();}pause(){this.timeline.pause();}resume(){this.timeline.resume();}seek(t){this.timeline.seek(t);}restart(){this.timeline.restart();}
  diagnostics(){return {...this.visual.diagnostics(),timeline:this.timeline.state};}
  dispose(){
    if(this.disposed)return;this.timeline.dispose();this.visual.dispose();this.disposed=true;
    const r=this.renderer;if(!r.disposed){r.camera.zoom=this.saved.zoom;r.camera.position.z=this.saved.z;r.camera.updateProjectionMatrix();r.renderer.localClippingEnabled=this.saved.clipping;}
  }
}
