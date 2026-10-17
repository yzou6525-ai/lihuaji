import * as THREE from '../vendor/three/build/three.module.js';
import {StitchSurface} from '../stitch/StitchSurface.js';
import {SantaoVisual} from '../stitch/SantaoVisual.js';
import {SantaoTimeline} from '../stitch/SantaoTimeline.js';
import {validateStitchDemo} from '../stitch/StitchPlayer.js';

export function captureARVisualState(layered){
  return {selected:layered.selected,expanded:layered.expanded,amount:layered.amount,state:layered.state,
    layers:layered.entries.map(({mesh})=>({visible:mesh.visible,opacity:mesh.material.opacity,position:mesh.position.toArray(),scale:mesh.scale.toArray(),rotation:mesh.rotation.toArray()}))};
}
export function restoreARVisualState(layered,snapshot){
  layered.stopTweens();Object.assign(layered,{selected:snapshot.selected,expanded:snapshot.expanded,amount:snapshot.amount,state:snapshot.state});
  layered.entries.forEach(({mesh},i)=>{const s=snapshot.layers[i];mesh.visible=s.visible;mesh.material.opacity=s.opacity;mesh.position.fromArray(s.position);mesh.scale.fromArray(s.scale);mesh.rotation.fromArray(s.rotation);});
}

// Owns presentation resources only. The existing AR animate(t) is the only render loop.
export class SantaoARAdapter {
  constructor({content,layered,renderer,data,definition,onChange=()=>{}}){
    validateStitchDemo(data);this.content=content;this.layered=layered;this.renderer=renderer;this.definition=definition;
    this.disposed=false;this.mounted=false;this.pausedByTracking=false;this.trackingAvailable=true;
    this.saved=captureARVisualState(layered);this.savedClipping=renderer.localClippingEnabled;layered.stopTweens();
    this.group=new THREE.Group();this.group.name='santaoARGroup';this.normalized=new THREE.Group();this.group.add(this.normalized);
    try{
      this.surface=new StitchSurface(this.normalized);this.surface.loadGeometry(data);
      // Display contrast only, to keep the same fine silk legible over the AR background.
      this.surface.material.color.set('#a49b89');
      this.visual=new SantaoVisual(this.surface,data,this.normalized);
      this.normalized.position.set(-this.surface.bounds.x,-this.surface.bounds.y,0);
      const t=definition.transform,entry=layered.entries.find(e=>e.index===definition.layerIndex);
      if(!entry)throw Error('目标花瓣未加载');
      this.group.position.set(t.x,t.y,entry.mesh.position.z+t.z);this.group.scale.setScalar(t.scale);this.group.rotation.z=t.rotationZ;
      this.group.traverse(o=>{if(o.isMesh||o.isLine)o.renderOrder+=10;});
      layered.entries.forEach(({mesh},i)=>mesh.material.opacity=i===layered.entries.indexOf(entry)?.1:.08);
      renderer.localClippingEnabled=true;this.mount();
      this.timeline=new SantaoTimeline({clockMode:'manual',onChange:state=>{this.visual.update(state);onChange(state);}});
      this.timeline.seek(0);
    }catch(error){this.dispose();throw error;}
  }
  mount(){if(!this.mounted&&!this.disposed){this.content.add(this.group);this.mounted=true;}}
  start(){this.pausedByTracking=false;this.timeline.start();}
  pause(){this.pausedByTracking=false;this.timeline.pause();}
  resume(){if(this.trackingAvailable){this.pausedByTracking=false;this.timeline.resume();}}
  seek(t){this.pausedByTracking=false;this.timeline.seek(t);}
  restart(){if(this.trackingAvailable){this.pausedByTracking=false;this.timeline.restart();}}
  trackingLost(){if(this.disposed||!this.trackingAvailable)return;this.trackingAvailable=false;this.pausedByTracking=this.timeline.playing;this.timeline.pause();}
  trackingFound(){if(this.disposed)return;this.trackingAvailable=true;const resume=this.pausedByTracking;this.pausedByTracking=false;if(resume)this.timeline.resume();}
  update(t){if(this.disposed)return;this.timeline.tick(t);this.visual.syncWorld();}
  diagnostics(){return {active:!this.disposed,mounted:this.mounted,time:this.timeline?.time||0,playing:this.timeline?.playing||false,pausedByTracking:this.pausedByTracking,trackingAvailable:this.trackingAvailable,clockMode:this.timeline?.clockMode,pendingFrame:this.timeline?.raf!==null&&this.timeline?.raf!==undefined,representatives:[1,32,46],resourceCounts:this.disposed?{geometries:0,materials:0,textures:0}:{geometries:7,materials:6,textures:2},parent:this.group.parent?.name||null,transform:{position:this.group.position.toArray(),scale:this.group.scale.toArray(),rotationZ:this.group.rotation.z},worldMatrix:this.group.matrixWorld.toArray()};}
  exit(){this.dispose();}
  dispose(){
    if(this.disposed)return;this.timeline?.dispose();this.visual?.dispose();this.surface?.disposeSurface();this.group.removeFromParent();this.group.clear();this.disposed=true;this.mounted=false;
    restoreARVisualState(this.layered,this.saved);this.renderer.localClippingEnabled=this.savedClipping;
  }
}
