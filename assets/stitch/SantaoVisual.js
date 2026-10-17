import * as THREE from '../vendor/three/build/three.module.js';
import {sampleNeedle,quadraticPoint,REPRESENTATIVE_ORDERS} from './SantaoTimeline.js';

// Presentation only: never changes, regenerates or writes the 56 stored stitches.
function convexHull(points){
  const sorted=points.map(p=>[...p]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out.slice(0,-1);};return [...half(sorted),...half([...sorted].reverse())];
}
function petalSurface(data,bounds){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');
  const width=bounds.w+12,height=bounds.h+12,scale=Math.min(512/width,512/height);
  const toCanvas=p=>[256+(p[0]-bounds.x)*scale,256-(p[1]-bounds.y)*scale];
  const hull=convexHull(data.stitches.flatMap(s=>[s.start,s.end])).map(p=>[bounds.x+(p[0]-bounds.x)*1.045,bounds.y+(p[1]-bounds.y)*1.045]);
  const outline=[];for(let i=0;i<hull.length;i++){const previous=hull[(i+hull.length-1)%hull.length],p=hull[i],next=hull[(i+1)%hull.length];const a=previous.map((v,j)=>(v+p[j])/2),b=p.map((v,j)=>(v+next[j])/2);for(let j=0;j<8;j++)outline.push(quadraticPoint(a,p,b,j/8));}
  ctx.beginPath();outline.map(toCanvas).forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.save();ctx.clip();ctx.fillStyle='#EDE9DF';ctx.fillRect(0,0,512,512);
  // Fine original fibers follow the data directions, not an imported embroidery image.
  for(const [i,s] of data.stitches.entries())for(let j=-5;j<=5;j++){
    const dx=s.end[0]-s.start[0],dy=s.end[1]-s.start[1],len=Math.hypot(dx,dy),offset=j*.48;
    const a=[s.start[0]-dy/len*offset,s.start[1]+dx/len*offset],b=[s.end[0]-dy/len*offset,s.end[1]+dx/len*offset];
    const c=[(a[0]+b[0])/2+.6*Math.sin(i+j),(a[1]+b[1])/2+.4*Math.cos(i-j)];
    ctx.beginPath();ctx.moveTo(...toCanvas(a));ctx.quadraticCurveTo(...toCanvas(c),...toCanvas(b));ctx.strokeStyle=j%2?'rgba(255,254,249,.45)':'rgba(148,134,112,.16)';ctx.lineWidth=(.11+.04*Math.sin(i*2+j))*scale;ctx.stroke();
  }
  ctx.restore();const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return {texture,outline,size:512/scale};
}
export class SantaoVisual {
  constructor(renderer,data,parent){
    if(data.id!=='demo-santao-pear-petal'||data.stitches.length!==56)throw Error('显影数据不匹配');
    this.renderer=renderer;this.data=data;this.disposed=false;this.ownedGeometries=[];this.ownedMaterials=[];this.ownedTextures=[];
    this.saved={width:renderer.width,colors:renderer.mesh.geometry.attributes.color.array.slice(),opacity:renderer.material.opacity};
    this.group=new THREE.Group();parent.add(this.group);
    const ownGeometry=g=>{this.ownedGeometries.push(g);return g;},ownMaterial=m=>{this.ownedMaterials.push(m);return m;};
    try{
      const face=petalSurface(data,renderer.bounds);this.ownedTextures.push(face.texture);
      this.face=new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(face.size,face.size)),ownMaterial(new THREE.MeshBasicMaterial({map:face.texture,transparent:true,depthWrite:false,side:THREE.DoubleSide})));
      this.face.position.set(renderer.bounds.x,renderer.bounds.y,.16);this.face.renderOrder=2;this.group.add(this.face);
      this.outline=new THREE.LineLoop(ownGeometry(new THREE.BufferGeometry().setFromPoints(face.outline.map(p=>new THREE.Vector3(...p,.18)))),ownMaterial(new THREE.LineBasicMaterial({color:0x8e9585,transparent:true,opacity:.25,depthWrite:false})));
      this.outline.renderOrder=3;this.group.add(this.outline);
      this.needle=new THREE.Group();this.needleMaterial=ownMaterial(new THREE.MeshBasicMaterial({color:0x969a94,transparent:true,opacity:.9,clippingPlanes:[new THREE.Plane(new THREE.Vector3(0,0,1),0)]}));
      const shaft=new THREE.Mesh(ownGeometry(new THREE.CylinderGeometry(.22,.22,10,8)),this.needleMaterial);shaft.position.y=7;
      const tip=new THREE.Mesh(ownGeometry(new THREE.ConeGeometry(.22,2,8)),this.needleMaterial);tip.rotation.z=Math.PI;tip.position.y=1;
      shaft.renderOrder=6;tip.renderOrder=6;this.needle.add(shaft,tip);this.group.add(this.needle);
      const geometry=ownGeometry(new THREE.BufferGeometry()),positions=new Float32Array(12*18),uvs=new Float32Array(12*12);
      for(let i=0;i<12;i++)uvs.set([i/12,0,(i+1)/12,0,(i+1)/12,1,i/12,0,(i+1)/12,1,i/12,1],i*12);
      geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
      // Same silk texture as the ordinary renderer; the borrowed texture is NOT disposed here.
      this.thread=new THREE.Mesh(geometry,ownMaterial(new THREE.MeshBasicMaterial({map:renderer.texture,color:0xd8c8a2,transparent:true,depthWrite:false,side:THREE.DoubleSide})));
      this.thread.frustumCulled=false;this.thread.renderOrder=5;this.group.add(this.thread);

    }catch(error){this.dispose();throw error;}
  }
  update(state){
    if(this.disposed)return;const r=this.renderer,key=state.key;
    r.width=this.saved.width*(.45-.06*state.merge);
    this.face.material.opacity=state.surfaceOpacity;this.face.visible=state.surfaceOpacity>0;
    this.outline.material.opacity=.18*(1-state.surfaceOpacity*.55);
    r.material.opacity=state.stage==='batch2-key' ? .7 : 1-state.merge*.9;
    const colors=r.mesh.geometry.attributes.color,white=new THREE.Color('#EDE9DF');
    for(let i=0;i<colors.array.length;i++)colors.array[i]=this.saved.colors[i]*(1-state.merge)+[white.r,white.g,white.b][i%3]*state.merge;
    colors.needsUpdate=true;
    for(let i=0;i<56;i++)r.setSegment(i,state.stitchFractions[i]);
    this.needle.visible=!!key;this.thread.visible=!!key;
    this.motion=key?sampleNeedle(this.data.stitches[key.order-1],key):null;
    if(key){
      const motion=this.motion;this.needle.position.fromArray(motion.tip);this.needle.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...motion.axis).normalize());this.needleMaterial.opacity=.85*motion.alpha;
      const points=Array.from({length:13},(_,i)=>quadraticPoint(motion.start,motion.control,motion.end,i/12));
      const vertices=this.thread.geometry.attributes.position.array,half=this.saved.width*.23;
      for(let i=0;i<12;i++){
        const a=points[i],b=points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len*half,ny=dx/len*half;
        vertices.set([a[0]-nx,a[1]-ny,a[2],b[0]-nx,b[1]-ny,b[2],b[0]+nx,b[1]+ny,b[2],a[0]-nx,a[1]-ny,a[2],b[0]+nx,b[1]+ny,b[2],a[0]+nx,a[1]+ny,a[2]],i*18);
      }
      this.thread.geometry.attributes.position.needsUpdate=true;
    }
    r.partialIndex=null;r.mesh.geometry.attributes.position.needsUpdate=true;r.mesh.geometry.setDrawRange(0,56*6);if(r.points)r.points.visible=false;this.syncWorld();
  }
  syncWorld(){
    if(this.disposed)return;this.group.updateWorldMatrix(true,false);
    this.needleMaterial.clippingPlanes[0].set(new THREE.Vector3(0,0,1),0).applyMatrix4(this.group.matrixWorld);
  }
  diagnostics(){return {disposed:this.disposed,needleMotion:'illustrative',motion:this.motion,owned:{geometries:this.ownedGeometries.length,materials:this.ownedMaterials.length,textures:this.ownedTextures.length},ribbonSegments:12,representatives:[...REPRESENTATIVE_ORDERS]};}
  dispose(){
    if(this.disposed)return;this.disposed=true;this.group.removeFromParent();
    for(const resource of [...this.ownedGeometries,...this.ownedMaterials,...this.ownedTextures])resource.dispose();this.ownedGeometries=[];this.ownedMaterials=[];this.ownedTextures=[];this.group.clear();
    const r=this.renderer;if(!r.disposed&&r.mesh){r.width=this.saved.width;r.material.opacity=this.saved.opacity;r.mesh.geometry.attributes.color.array.set(this.saved.colors);r.mesh.geometry.attributes.color.needsUpdate=true;for(let i=0;i<this.data.stitches.length;i++)r.setSegment(i,1);}
  }
}
