import * as THREE from '../vendor/three/build/three.module.js';

// Shared strand buffers and original silk texture, without a WebGL renderer or clock.
export class StitchSurface {
  constructor(parent){
    this.scene=parent;this.disposed=false;this.planVisible=false;this.planError=null;
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 32;
    const ctx = canvas.getContext('2d'), image = ctx.createImageData(64, 32);
    for (let y=0;y<32;y++) for (let x=0;x<64;x++) {
      const i=(y*64+x)*4, across=y/31, ridge=Math.sin(across*Math.PI), fiber=Math.cos(y*2.7+x*.24)*5;
      const light=Math.round(160 + ridge*90 + fiber);
      image.data.set([light,light,light,Math.round(Math.min(1,ridge*3)*255)],i);
    }
    ctx.putImageData(image,0,0);
    this.texture = new THREE.CanvasTexture(canvas); this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({map:this.texture,vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide});
    this.pointMaterial = new THREE.PointsMaterial({color:0x3f5a4f,size:5,sizeAttenuation:false});
  }
  clear() {
    for (const object of [this.mesh,this.points,this.planMesh]) if (object) { object.geometry.dispose(); this.scene.remove(object); }
    this.planMaterial?.dispose();this.planMaterial=null;this.mesh = null; this.points = null; this.planMesh=null;
  }
  loadGeometry(data) {
    this.clear(); this.data = data; const n=data.stitches.length;
    const positions=new Float32Array(n*18), colors=new Float32Array(n*18), uvs=new Float32Array(n*12), dots=new Float32Array(n*6);
    const xs=[],ys=[];
    data.stitches.forEach((s,i)=>{
      xs.push(s.start[0],s.end[0]);ys.push(s.start[1],s.end[1]);
      dots.set([s.start[0],s.start[1],.1,s.end[0],s.end[1],.1],i*6);
      const color=new THREE.Color(s.color || '#7B9480');
      for(let j=0;j<6;j++)colors.set([color.r,color.g,color.b],i*18+j*3);
      uvs.set([0,0,1,0,1,1,0,0,1,1,0,1],i*12);
    });
    this.bounds={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,w:Math.max(20,Math.max(...xs)-Math.min(...xs)),h:Math.max(20,Math.max(...ys)-Math.min(...ys))};
    this.width=Math.max(this.bounds.w,this.bounds.h)*(data.renderStyle?.strandWidthRatio ?? .006);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setDrawRange(0,0);
    this.mesh=new THREE.Mesh(geometry,this.material);this.mesh.frustumCulled=false;this.mesh.renderOrder=1;this.scene.add(this.mesh);
    const pointGeometry=new THREE.BufferGeometry();pointGeometry.setAttribute('position',new THREE.BufferAttribute(dots,3));pointGeometry.setDrawRange(0,0);
    this.points=new THREE.Points(pointGeometry,this.pointMaterial);this.points.frustumCulled=false;this.points.renderOrder=2;this.scene.add(this.points);
    data.stitches.forEach((s,i)=>this.setSegment(i,1));
    this.createPlanGeometry(n,colors,uvs);
    this.partialIndex=null;this.state={position:0,showPoints:false};
  }
  createPlanGeometry(n,colors,uvs){
    this.planError=null;let geometry=null,material=null;
    try{
      const positions=new Float32Array(n*18),rgba=new Float32Array(n*24),z=-.02;
      for(let i=0;i<n;i++){
        const s=this.data.stitches[i],vertices=this.segmentVertices(s,1,z);
        positions.set(vertices,i*18);
        for(let vertex=0;vertex<6;vertex++)rgba.set([colors[i*18+vertex*3],colors[i*18+vertex*3+1],colors[i*18+vertex*3+2],1],i*24+vertex*4);
      }
      geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
      geometry.setAttribute('color',new THREE.BufferAttribute(rgba,4).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('uv',new THREE.BufferAttribute(uvs.slice(),2));
      geometry.setDrawRange(0,n*6);
      this.planCompleted=0;
      material=new THREE.MeshBasicMaterial({map:this.texture,vertexColors:true,transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide});this.planMaterial=material;
      this.planMesh=new THREE.Mesh(geometry,this.planMaterial);this.planMesh.frustumCulled=false;this.planMesh.renderOrder=0;this.planMesh.visible=this.planVisible;this.scene.add(this.planMesh);
      this.setPlanProgress(0);
    }catch(error){
      geometry?.dispose();this.scene.remove(this.planMesh);this.planMesh=null;material?.dispose();this.planMaterial=null;this.planError=error?.message||'Stitch Plan unavailable';
    }
  }
  segmentVertices(s,fraction=1,z=0){
    const dx=s.end[0]-s.start[0],dy=s.end[1]-s.start[1],length=Math.hypot(dx,dy),nx=-dy/length*this.width/2,ny=dx/length*this.width/2,ax=s.start[0],ay=s.start[1],bx=ax+dx*fraction,by=ay+dy*fraction;
    return [ax-nx,ay-ny,z,bx-nx,by-ny,z,bx+nx,by+ny,z,ax-nx,ay-ny,z,bx+nx,by+ny,z,ax+nx,ay+ny,z];
  }
  setPlanProgress(position){
    const color=this.planMesh?.geometry?.attributes?.color;if(!color)return;
    const completed=Math.max(0,Math.min(this.data?.stitches.length||0,Math.floor(Number.isFinite(position)?position:0)));
    const previous=this.planCompleted??0;if(previous===completed)return;
    for(let i=Math.min(previous,completed);i<Math.max(previous,completed);i++)for(let vertex=0;vertex<6;vertex++)color.array[i*24+vertex*4+3]=i<completed?0:1;
    this.planCompleted=completed;
    color.needsUpdate=true;
  }
  setPlanVisible(value){
    this.planVisible=!!value;if(this.planMesh)this.planMesh.visible=this.planVisible;this.render?.();
  }
  setSegment(i,fraction) {
    this.mesh.geometry.attributes.position.array.set(this.segmentVertices(this.data.stitches[i],fraction),i*18);
  }
  disposeSurface(){
    this.disposed=true;this.clear();this.material.dispose();this.pointMaterial.dispose();this.planMaterial?.dispose();this.texture.dispose();this.data=null;
  }
}
