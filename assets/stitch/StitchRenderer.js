import * as THREE from '../vendor/three/build/three.module.js';
import {StitchSurface} from './StitchSurface.js';

// A single textured triangle buffer, plus a single Points buffer. No tubes or imported textures.
export class StitchRenderer extends StitchSurface {
  constructor(host) {
    super(new THREE.Scene());
    this.host = host; this.disposed = false;
    this.renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0xf8f6ef, 1);
    this.renderer.domElement.setAttribute('aria-label', '数字针迹画面；使用下方按钮或进度条逐针查看');
    this.renderer.domElement.setAttribute('role', 'img');
    host.append(this.renderer.domElement);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
    this.camera.position.z = 10;
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host);
  }
  load(data) {this.loadGeometry(data);this.resize();this.update(this.state);}
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
    if(this.disposed)return;this.disposed=true;this.observer.disconnect();this.disposeSurface();this.scene.clear();
    this.renderer.renderLists.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();
  }
}
