import * as THREE from '../vendor/three/build/three.module.js';

// A single textured triangle buffer, plus a single Points buffer. No tubes or imported textures.
export class StitchRenderer {
  constructor(host) {
    this.host = host; this.disposed = false;
    this.renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0xf8f6ef, 1);
    this.renderer.domElement.setAttribute('aria-label', '数字针迹画面；使用下方按钮或进度条逐针查看');
    this.renderer.domElement.setAttribute('role', 'img');
    host.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
    this.camera.position.z = 10;
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
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host);
  }
  clear() {
    for (const object of [this.mesh,this.points]) if (object) { object.geometry.dispose(); this.scene.remove(object); }
    this.mesh = null; this.points = null;
  }
  load(data) {
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
    this.mesh=new THREE.Mesh(geometry,this.material);this.mesh.frustumCulled=false;this.scene.add(this.mesh);
    const pointGeometry=new THREE.BufferGeometry();pointGeometry.setAttribute('position',new THREE.BufferAttribute(dots,3));pointGeometry.setDrawRange(0,0);
    this.points=new THREE.Points(pointGeometry,this.pointMaterial);this.points.frustumCulled=false;this.scene.add(this.points);
    data.stitches.forEach((s,i)=>this.setSegment(i,1));
    this.partialIndex=null;this.state={position:0,showPoints:false};this.resize();this.update(this.state);
  }
  setSegment(i,fraction) {
    const s=this.data.stitches[i],dx=s.end[0]-s.start[0],dy=s.end[1]-s.start[1],length=Math.hypot(dx,dy);
    const nx=-dy/length*this.width/2,ny=dx/length*this.width/2,ax=s.start[0],ay=s.start[1],bx=ax+dx*fraction,by=ay+dy*fraction;
    this.mesh.geometry.attributes.position.array.set([ax-nx,ay-ny,0,bx-nx,by-ny,0,bx+nx,by+ny,0,ax-nx,ay-ny,0,bx+nx,by+ny,0,ax+nx,ay+ny,0],i*18);
  }
  update(state) {
    if(this.disposed || !this.mesh)return;
    this.state=state;const completed=Math.floor(state.position),fraction=state.position-completed;
    if(this.partialIndex!==null)this.setSegment(this.partialIndex,1);
    this.partialIndex=fraction>0?completed:null;
    if(this.partialIndex!==null)this.setSegment(completed,fraction);
    this.mesh.geometry.attributes.position.needsUpdate=true;
    this.mesh.geometry.setDrawRange(0,(completed+(fraction>0?1:0))*6);
    this.points.visible=state.showPoints;this.points.geometry.setDrawRange(0,completed*2+(fraction>0?1:0));
    this.render();
  }
  resize() {
    if(this.disposed || !this.bounds)return;
    const w=Math.max(1,this.host.clientWidth),h=Math.max(1,this.host.clientHeight),ratio=w/h;
    const height=Math.max(this.bounds.h*1.45,this.bounds.w*1.45/ratio),width=height*ratio;
    Object.assign(this.camera,{left:this.bounds.x-width/2,right:this.bounds.x+width/2,top:this.bounds.y+height/2,bottom:this.bounds.y-height/2});
    this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);this.render();
  }
  render() { if(!this.disposed)this.renderer.render(this.scene,this.camera); }
  diagnostics() { return {disposed:this.disposed,resources:{...this.renderer.info.memory},vertices:this.mesh?.geometry.drawRange.count || 0,points:this.points?.geometry.drawRange.count || 0,pointsVisible:this.points?.visible || false}; }
  dispose() {
    if(this.disposed)return;this.disposed=true;this.observer.disconnect();this.clear();
    this.material.dispose();this.pointMaterial.dispose();this.texture.dispose();this.data=null;this.scene.clear();
    this.renderer.renderLists.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();
  }
}
