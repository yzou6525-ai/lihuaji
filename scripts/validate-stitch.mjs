import fs from 'node:fs';
import {validateStitchDemo} from '../assets/stitch/StitchPlayer.js';
import {validateVideoSources} from '../assets/stitch-video-store.js';
import {demoCatalogue} from '../assets/stitch-lab.js';
// Numerical safeguards for the PROJECT VISUAL DESIGN, not proof of craft authenticity.
export function validateSantaoVisual(data) {
 validateStitchDemo(data);
 const check=(ok,message)=>{if(!ok)throw Error('散套数字结构：'+message);};
 check(data.id==='demo-santao-pear-petal'&&data.knowledgeId==='stitch-santao','知识绑定');
 check(data.nature==='digital-craft-visualization'&&data.illustrativeStitchCount===56&&data.stitches.length===56,'56针示意属性');
 const expected=[28,14,14],groups=expected.map((_,i)=>data.stitches.filter(s=>s.group===i+1));
 check(groups.every((g,i)=>g.length===expected[i]),'28/14/14批次');
 check(data.stitches.every((s,i)=>s.group===(i<28?1:i<42?2:3)),'批次先后');
 check(JSON.stringify(data.batches)===JSON.stringify([{group:1,count:28,label:'第一批 · 出边'},{group:2,count:14,label:'第二批 · 套入'},{group:3,count:14,label:'第三批 · 相嵌'}]),'批次标签');
 const bounds={minX:-50,maxX:50,minY:-55,maxY:60};
 check(JSON.stringify(data.canvasBounds)===JSON.stringify(bounds),'允许画布范围');
 check(data.stitches.every(s=>[s.start,s.end].every(p=>p[0]>=bounds.minX&&p[0]<=bounds.maxX&&p[1]>=bounds.minY&&p[1]<=bounds.maxY)),'坐标越界');
 check(typeof data.note==='string'&&data.note.includes('不是传统梨花的标准针数')&&typeof data.authenticityNote==='string'&&data.authenticityNote.includes('未经苏绣专家人工审定')&&data.colorNote?.includes('不代表真实苏绣丝线配色'),'真实性说明');
 const span=values=>Math.max(...values)-Math.min(...values),distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const lengths=groups[0].map(s=>distance(s.start,s.end));
 check(span(lengths)>20&&span(groups[0].map(s=>s.end[1]))>20,'第一批长度或终点过于整齐');
 check(groups[0].every((s,i)=>!i||distance(s.start,groups[0][i-1].start)<12),'外缘不连续');
 // A point must lie beside the INTERIOR of an older strand, not just touch its tip.
 const beside=(p,s)=>{const dx=s.end[0]-s.start[0],dy=s.end[1]-s.start[1],t=((p[0]-s.start[0])*dx+(p[1]-s.start[1])*dy)/(dx*dx+dy*dy);return t>.1&&t<.9&&distance(p,[s.start[0]+t*dx,s.start[1]+t*dy])<5;};
 const overlaps=(group,prior)=>group.filter(s=>[0,.1,.2].every(t=>prior.some(p=>beside([s.start[0]+t*(s.end[0]-s.start[0]),s.start[1]+t*(s.end[1]-s.start[1])],p)))).length;
 const batch2=overlaps(groups[1],groups[0]),batch3=overlaps(groups[2],[...groups[0],...groups[1]]);
 check(batch2>=11&&batch3>=11,'套入必须进入已有针段内部');
 // Sampling connectivity rejects stray islands even when their bounding boxes overlap.
 const samples=data.stitches.map(s=>Array.from({length:9},(_,i)=>[s.start[0]+(s.end[0]-s.start[0])*i/8,s.start[1]+(s.end[1]-s.start[1])*i/8]));
 const reached=new Set([0]);let changed=true;
 while(changed){changed=false;for(let i=0;i<56;i++)if(!reached.has(i)&&[...reached].some(j=>samples[i].some(p=>samples[j].some(q=>distance(p,q)<8)))){reached.add(i);changed=true;}}
 check(reached.size===56,'花瓣存在分离区域');
 const crownWidth=span(groups[0].map(s=>s.start[0])),baseWidth=span(groups[2].map(s=>s.end[0]));
 check(crownWidth>2*baseWidth&&groups[2].every(s=>s.end[1]<-25)&&groups[2].reduce((sum,s)=>sum+s.end[1],0)/14<-35,'单瓣上宽下窄');
 return {type:'project-visual-validation',counts:groups.map(g=>g.length),batch2InteriorOverlap:batch2,batch3InteriorOverlap:batch3,connectedStitches:reached.size,lengthRange:span(lengths),endpointDepthRange:span(groups[0].map(s=>s.end[1])),crownWidth,baseWidth};
}
export function validateStitchFiles() {
 const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'));
 const knowledge=read('content/suxiu-knowledge.json');
 const demos=demoCatalogue.map(d=>validateStitchDemo(read('content/stitch-demos/'+d.id+'.json')));
 if(new Set(demos.map(d=>d.id)).size!==demos.length||demos.some((d,i)=>d.id!==demoCatalogue[i].id))throw Error('针迹目录ID重复或不一致');
 const santao=validateSantaoVisual(demos.find(d=>d.id==='demo-santao-pear-petal'));
 for(const demo of demos)if(demo.knowledgeId&&!knowledge.some(k=>k.id===demo.knowledgeId&&k.verified===true))throw Error('针迹知识关联不存在：'+demo.id);
 const videos=validateVideoSources(read('content/stitch-video-sources.json'));
 return {demos:demos.map(d=>({id:d.id,count:d.stitches.length,knowledgeId:d.knowledgeId})),videos:videos.length,santao};
}
