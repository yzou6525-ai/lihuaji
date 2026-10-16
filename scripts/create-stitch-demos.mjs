// Project-authored illustrative coordinates, not recordings or reconstructions.
import fs from 'node:fs';
import {generateSantaoPetal} from './santao-petal-data.mjs';
const output=new URL('../content/stitch-demos/',import.meta.url);fs.mkdirSync(output,{recursive:true});
const round=n=>Math.round(n*1000)/1000;
function write(id,title,knowledgeId,segments){
 const data={schemaVersion:1,id,title,knowledgeId,nature:'digital-practice-demo',expertReviewed:false,historicalReconstruction:false,coordinateSystem:'arbitrary-units-y-up',description:'项目自编的表面路径与先后关系示意，不模拟背面过线、针尖运动、张力或真实工艺参数。',stitches:segments.map((s,i)=>({id:'s'+String(i+1).padStart(3,'0'),start:s[0].map(round),end:s[1].map(round),order:i+1,group:s[2],color:s[3]}))};
 fs.writeFileSync(new URL(id+'.json',output),JSON.stringify(data,null,2)+'\n');
}
write('demo-straight-basic','直线针数字练习示意','stitch-plain',Array.from({length:16},(_,i)=>[[-45+i*6,-22],[-45+i*6,22],1,'#718B78']));
write('demo-tao-basic','套针数字练习示意','stitch-tao',Array.from({length:24},(_,i)=>{const row=Math.floor(i/8),column=i%8,x=-42+column*12+row*2,y=32-row*23;return [[x,y],[x+2,y-29-(column%2)*7],row+1,['#A1B29B','#718B78','#486B59'][row]];}));
const curve=t=>[-52+104*t,17*Math.sin(t*Math.PI*1.65)-8];
write('demo-gun-basic','滚针数字练习示意','stitch-gun',Array.from({length:20},(_,i)=>{const a=curve(i/21),b=curve((i+2)/21);return [[a[0],a[1]-1.5],[b[0],b[1]+1.5],1,'#718B78'];}));
const santao=generateSantaoPetal();
fs.writeFileSync(new URL(santao.id+'.json',output),JSON.stringify(santao,null,2)+'\n');
