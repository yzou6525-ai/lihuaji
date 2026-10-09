import * as THREE from '../vendor/three/build/three.module.js';
import {animate,easeOutBack,easeInOutCubic} from './Tween.js';

export class LayeredPattern {
  constructor({reducedMotion=false,onWarning=()=>{}}={}){
    this.group=new THREE.Group();this.entries=[];this.tweens=[];this.generation=0;this.disposed=false;
    this.reducedMotion=reducedMotion;this.onWarning=onWarning;this.amount=1;this.expanded=false;this.selected=-1;this.playCount=0;this.state='collapsed';
  }
  async load(data){
    this.clear();this.disposed=false;const generation=++this.generation;
    const definitions=(data.layers||[]).slice(0,8),loader=new THREE.TextureLoader();
    // Sequential loading bounds peak mobile decoding memory. Missing layers are deliberately skipped.
    let size=null;
    for(let index=0;index<definitions.length;index++){
      const definition=definitions[index];if(!definition.src)continue;
      let texture;
      try{
        texture=await loader.loadAsync(definition.src);
        if(this.disposed||generation!==this.generation){texture.dispose();return false;}
        const dimensions=[texture.image.width,texture.image.height];
        if(size&&(size[0]!==dimensions[0]||size[1]!==dimensions[1])){texture.dispose();this.onWarning('图层尺寸不一致，已跳过：'+definition.name);continue;}
        size=dimensions;texture.colorSpace=THREE.SRGBColorSpace;
        const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,alphaTest:.01});
        const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,dimensions[1]/dimensions[0]),material);
        mesh.renderOrder=index+1;mesh.userData.layerIndex=this.entries.length;
        // Keep only alpha bytes for hit testing (1 MB per 1024 layer); never read camera frames.
        const mask=document.createElement('canvas');mask.width=dimensions[0];mask.height=dimensions[1];
        const ctx=mask.getContext('2d',{willReadFrequently:true});ctx.drawImage(texture.image,0,0);
        let pixels=null;try{const rgba=ctx.getImageData(0,0,...dimensions).data;pixels=new Uint8Array(dimensions[0]*dimensions[1]);for(let p=0;p<pixels.length;p++)pixels[p]=rgba[p*4+3];}catch{}
        this.entries.push({mesh,definition,index,depth:Number.isFinite(definition.depth)?definition.depth:index*.012,mask:{pixels,width:dimensions[0],height:dimensions[1]}});
        this.group.add(mesh);
      }catch(error){texture?.dispose();if(generation===this.generation&&!this.disposed)this.onWarning('部分图层未能加载：'+(definition.name||'未命名图层'));}
    }
    return this.entries.length>0;
  }
  mount(parent){parent.add(this.group);return this;}
  stopTweens(){this.tweens.forEach(t=>t.cancel());this.tweens=[];}
  playExplosion(now=performance.now()){
    if(!this.entries.length||this.disposed)return;
    this.stopTweens();this.expanded=true;this.selected=-1;this.state='playing';this.playCount++;
    this.entries.forEach((entry,i)=>{
      const mesh=entry.mesh,target=entry.depth*this.amount;
      mesh.position.z=0;mesh.rotation.z=0;mesh.scale.setScalar(i? .93:1);mesh.material.opacity=i?.2:1;
      if(!i){mesh.position.z=target;return;}
      const twist=(i%2?1:-1)*(1+(i%3)*.35)*Math.PI/180;
      this.tweens.push(animate(0,1,this.reducedMotion?0:680,(_,t)=>{
        mesh.position.z=target*easeOutBack(t);
        mesh.scale.setScalar(t<.7?.93+.105*(1-(1-t/.7)**3):1.035-.035*((t-.7)/.3));
        mesh.rotation.z=twist*Math.sin(Math.PI*t);mesh.material.opacity=.2+.8*Math.min(1,t*1.8);
      },()=>{mesh.position.z=target;mesh.scale.setScalar(1);mesh.rotation.z=0;mesh.material.opacity=1;},this.reducedMotion?0:i*125,{manual:true,start:now}));
    });
    this.update(now);
  }
  collapse(now=performance.now()){
    this.stopTweens();this.expanded=false;this.selected=-1;this.state='collapsing';
    this.entries.forEach(({mesh})=>{
      const z=mesh.position.z,scale=mesh.scale.x,opacity=mesh.material.opacity,rotation=mesh.rotation.z;
      this.tweens.push(animate(0,1,this.reducedMotion?0:320,t=>{mesh.position.z=z*(1-t);mesh.scale.setScalar(scale+(1-scale)*t);mesh.rotation.z=rotation*(1-t);mesh.material.opacity=opacity+(1-opacity)*t;},()=>{},0,{manual:true,start:now,easing:easeInOutCubic}));
    });this.update(now);
  }
  setExplodeAmount(value){this.amount=Math.min(3,Math.max(0,Number(value)||0));if(this.expanded)this.transitionSelection();}
  transitionSelection(){
    this.stopTweens();const now=performance.now();
    this.entries.forEach(({mesh,depth},i)=>{
      const z=mesh.position.z,opacity=mesh.material.opacity;
      const target=(this.expanded?depth*this.amount:0)+(i===this.selected?.018:0),alpha=this.selected<0||this.selected===i?1:.15;
      mesh.scale.setScalar(1);mesh.rotation.z=0;
      this.tweens.push(animate(0,1,this.reducedMotion?0:250,t=>{mesh.position.z=z+(target-z)*t;mesh.material.opacity=opacity+(alpha-opacity)*t;},()=>{mesh.position.z=target;mesh.material.opacity=alpha;},0,{manual:true,start:now}));
    });
  }
  highlightLayer(index){if(!this.entries[index])return;this.selected=index;this.transitionSelection();}
  clearHighlight(){this.selected=-1;this.transitionSelection();}
  pick(raycaster){
    for(const hit of raycaster.intersectObjects(this.entries.map(e=>e.mesh))){
      const i=hit.object.userData.layerIndex,mask=this.entries[i].mask;
      if(hit.uv&&mask.pixels){const x=Math.min(mask.width-1,Math.max(0,Math.floor(hit.uv.x*mask.width))),y=Math.min(mask.height-1,Math.max(0,Math.floor((1-hit.uv.y)*mask.height)));if(mask.pixels[y*mask.width+x]<40)continue;}
      return i;
    }return -1;
  }
  update(time){this.tweens.forEach(t=>t.update(time));this.tweens=this.tweens.filter(t=>!t.finished);if(!this.tweens.length)this.state=this.expanded?'active':'collapsed';}
  clear(){this.stopTweens();this.entries.forEach(({mesh})=>{mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();});this.group.clear();this.entries=[];this.selected=-1;this.state='collapsed';this.expanded=false;}
  dispose(){this.disposed=true;this.generation++;this.clear();this.group.removeFromParent();}
}
