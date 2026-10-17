import * as THREE from '../vendor/three/build/three.module.js';
import {StitchSurface} from './StitchSurface.js';

const MIN_ZOOM=.8,MAX_ZOOM=5,clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// One renderer and orthographic camera for both ordinary playback and the cinematic view.
export class StitchRenderer extends StitchSurface {
  constructor(host) {
    super(new THREE.Scene());
    this.host=host;this.disposed=false;this.view={zoom:1,panX:0,panY:0};this.viewLocked=false;this.planSuppressed=false;this.gesture=null;this.pointers=new Map();this.onViewChange=()=>{};
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));
    this.renderer.setClearColor(0xf8f6ef,1);
    this.renderer.domElement.setAttribute('aria-label','数字针迹画面；可在画布内拖动，滚轮或双指缩放');
    this.renderer.domElement.setAttribute('role','img');
    host.append(this.renderer.domElement);
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,100);this.camera.position.z=10;
    this.bindInteractions();
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);
  }
  load(data){this.loadGeometry(data);this.resize();this.fitToData();this.update(this.state);}
  update(state){
    if(this.disposed||!this.mesh)return;
    this.state=state;const completed=Math.floor(state.position),fraction=state.position-completed;
    if(this.partialIndex!==null)this.setSegment(this.partialIndex,1);
    this.partialIndex=fraction>0?completed:null;
    if(this.partialIndex!==null)this.setSegment(completed,fraction);
    this.mesh.geometry.attributes.position.needsUpdate=true;
    this.mesh.geometry.setDrawRange(0,(completed+(fraction>0?1:0))*6);
    this.points.visible=state.showPoints;this.points.geometry.setDrawRange(0,completed*2+(fraction>0?1:0));
    this.setPlanProgress(state.position);this.syncPlanVisibility();this.render();
  }
  resize(){
    if(this.disposed||!this.bounds)return;
    const w=Math.max(1,this.host.clientWidth),h=Math.max(1,this.host.clientHeight),ratio=w/h;
    const height=Math.max(this.bounds.h*1.45,this.bounds.w*1.45/ratio),width=height*ratio;
    this.baseView={width,height};
    Object.assign(this.camera,{left:this.bounds.x-width/2,right:this.bounds.x+width/2,top:this.bounds.y+height/2,bottom:this.bounds.y-height/2});
    this.renderer.setSize(w,h,false);this.applyView(false);this.render();
  }
  applyView(notify=true){
    if(!this.bounds||this.disposed)return;
    const {zoom,panX,panY}=this.view;
    this.camera.position.x=this.bounds.x+panX;this.camera.position.y=this.bounds.y+panY;this.camera.zoom=zoom;this.camera.updateProjectionMatrix();this.render();
    if(notify)this.onViewChange(this.getViewState());
  }
  fitToData(){return this.resetView();}
  resetView(){this.view={zoom:1,panX:0,panY:0};this.applyView();return this.getViewState();}
  setZoom(value){if(!Number.isFinite(value))return this.getViewState();this.view.zoom=clamp(value,MIN_ZOOM,MAX_ZOOM);this.applyView();return this.getViewState();}
  screenToWorld(screenX,screenY){
    const canvas=this.renderer.domElement,w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
    return {x:this.camera.position.x+(screenX/w-.5)*(this.camera.right-this.camera.left)/this.camera.zoom,y:this.camera.position.y+(.5-screenY/h)*(this.camera.top-this.camera.bottom)/this.camera.zoom};
  }
  zoomAt(screenX,screenY,factor){
    if(this.viewLocked||![screenX,screenY,factor].every(Number.isFinite)||factor<=0)return this.getViewState();
    const anchor=this.screenToWorld(screenX,screenY),zoom=clamp(this.view.zoom*factor,MIN_ZOOM,MAX_ZOOM);
    this.view.zoom=zoom;this.applyView(false);const moved=this.screenToWorld(screenX,screenY);
    this.view.panX+=anchor.x-moved.x;this.view.panY+=anchor.y-moved.y;this.applyView();return this.getViewState();
  }
  panBy(dx,dy){
    if(this.viewLocked||![dx,dy].every(Number.isFinite)||!this.baseView)return this.getViewState();
    const canvas=this.renderer.domElement,w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
    const limit=Math.max(this.bounds?.w||0,this.bounds?.h||0,20)*4;
    this.view.panX=clamp(this.view.panX-dx*(this.camera.right-this.camera.left)/this.view.zoom/w,-limit,limit);
    this.view.panY=clamp(this.view.panY+dy*(this.camera.top-this.camera.bottom)/this.view.zoom/h,-limit,limit);
    this.applyView();return this.getViewState();
  }
  getViewState(){return {zoom:this.view.zoom,panX:this.view.panX,panY:this.view.panY,planVisible:this.planVisible};}
  setViewState(state={}){
    if(Number.isFinite(state.zoom))this.view.zoom=clamp(state.zoom,MIN_ZOOM,MAX_ZOOM);
    if(Number.isFinite(state.panX))this.view.panX=clamp(state.panX,-10000,10000);
    if(Number.isFinite(state.panY))this.view.panY=clamp(state.panY,-10000,10000);
    if(typeof state.planVisible==='boolean')this.planVisible=state.planVisible;
    this.syncPlanVisibility();this.applyView();return this.getViewState();
  }
  syncPlanVisibility(){if(this.planMesh)this.planMesh.visible=this.planVisible&&!this.planSuppressed;}
  setPlanVisible(value){this.planVisible=!!value;this.syncPlanVisibility();this.render();this.onViewChange(this.getViewState());}
  setPlanSuppressed(value){this.planSuppressed=!!value;this.syncPlanVisibility();this.render();}
  setViewLocked(value){this.viewLocked=!!value;this.gesture=null;this.pointers.clear();this.renderer.domElement.style.cursor=this.viewLocked?'default':'grab';this.renderer.domElement.style.touchAction=this.viewLocked?'pan-x pan-y':'none';}
  beginPinch(){
    const points=[...this.pointers.values()].slice(0,2),dx=points[1].x-points[0].x,dy=points[1].y-points[0].y;
    this.gesture={type:'pinch',distance:Math.max(1,Math.hypot(dx,dy)),midX:(points[0].x+points[1].x)/2,midY:(points[0].y+points[1].y)/2};
  }
  bindInteractions(){
    const canvas=this.renderer.domElement;
    this.handlePointerDown=event=>{
      if(this.viewLocked||(event.pointerType==='mouse'&&event.button!==0))return;
      event.preventDefault();try{canvas.setPointerCapture?.(event.pointerId);}catch{}
      const rect=canvas.getBoundingClientRect(),point={x:event.clientX-rect.left,y:event.clientY-rect.top,type:event.pointerType};this.pointers.set(event.pointerId,point);
      if(event.pointerType==='touch'&&this.pointers.size>=2)this.beginPinch();else this.gesture={type:'pan',pointerId:event.pointerId,lastX:point.x,lastY:point.y};
      canvas.style.cursor='grabbing';
    };
    this.handlePointerMove=event=>{
      if(this.viewLocked)return;const previous=this.pointers.get(event.pointerId);if(!previous)return;
      const rect=canvas.getBoundingClientRect(),point={...previous,x:event.clientX-rect.left,y:event.clientY-rect.top};this.pointers.set(event.pointerId,point);
      if(point.type==='touch'&&this.pointers.size>=2){
        if(this.gesture?.type!=='pinch')this.beginPinch();
        const points=[...this.pointers.values()].slice(0,2),dx=points[1].x-points[0].x,dy=points[1].y-points[0].y,distance=Math.max(1,Math.hypot(dx,dy)),midX=(points[0].x+points[1].x)/2,midY=(points[0].y+points[1].y)/2,gesture=this.gesture;
        this.panBy(midX-gesture.midX,midY-gesture.midY);this.zoomAt(midX,midY,distance/gesture.distance);this.gesture={type:'pinch',distance,midX,midY};event.preventDefault();
      }else if(this.gesture?.type==='pan'&&this.gesture.pointerId===event.pointerId){
        const dx=point.x-this.gesture.lastX,dy=point.y-this.gesture.lastY;this.gesture.lastX=point.x;this.gesture.lastY=point.y;if(dx||dy)this.panBy(dx,dy);event.preventDefault();
      }
    };
    this.handlePointerEnd=event=>{
      this.pointers.delete(event.pointerId);try{if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);}catch{}
      if(this.pointers.size===1){const [pointerId,point]=this.pointers.entries().next().value;this.gesture={type:'pan',pointerId,lastX:point.x,lastY:point.y};}else if(!this.pointers.size)this.gesture=null;else this.beginPinch();
      canvas.style.cursor=this.gesture?'grabbing':'grab';
    };
    this.handleWheel=event=>{if(this.viewLocked)return;event.preventDefault();this.zoomAt(event.offsetX,event.offsetY,Math.exp(-event.deltaY*.001));};
    this.handleDoubleClick=event=>{if(this.viewLocked)return;event.preventDefault();this.fitToData();};
    canvas.addEventListener('pointerdown',this.handlePointerDown);canvas.addEventListener('pointermove',this.handlePointerMove);canvas.addEventListener('pointerup',this.handlePointerEnd);canvas.addEventListener('pointercancel',this.handlePointerEnd);canvas.addEventListener('lostpointercapture',this.handlePointerEnd);canvas.addEventListener('wheel',this.handleWheel,{passive:false});canvas.addEventListener('dblclick',this.handleDoubleClick);
  }
  render(){if(!this.disposed)this.renderer.render(this.scene,this.camera);}
  diagnostics(){
    const count=this.data?.stitches.length||0,completed=Math.floor(this.state?.position||0);
    return {disposed:this.disposed,resources:{...this.renderer.info.memory},vertices:this.mesh?.geometry.drawRange.count||0,points:this.points?.geometry.drawRange.count||0,pointsVisible:this.points?.visible||false,plan:{exists:!!this.planMesh,geometryId:this.planMesh?.geometry.id??null,visible:!!this.planMesh?.visible,geometrySegments:this.planMesh?.geometry.drawRange.count/6||0,ghostSegments:Math.max(0,count-completed),opacity:this.planMaterial?.opacity??null,suppressed:this.planSuppressed},viewLocked:this.viewLocked,view:this.getViewState()};
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.observer.disconnect();const canvas=this.renderer.domElement;
    canvas.removeEventListener('pointerdown',this.handlePointerDown);canvas.removeEventListener('pointermove',this.handlePointerMove);canvas.removeEventListener('pointerup',this.handlePointerEnd);canvas.removeEventListener('pointercancel',this.handlePointerEnd);canvas.removeEventListener('lostpointercapture',this.handlePointerEnd);canvas.removeEventListener('wheel',this.handleWheel);canvas.removeEventListener('dblclick',this.handleDoubleClick);
    this.pointers.clear();this.gesture=null;this.disposeSurface();this.scene.clear();this.renderer.renderLists.dispose();this.renderer.dispose();this.renderer.forceContextLoss();canvas.remove();
  }
}
