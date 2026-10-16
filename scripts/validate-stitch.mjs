import fs from 'node:fs';
import {validateStitchDemo} from '../assets/stitch/StitchPlayer.js';
import {validateVideoSources} from '../assets/stitch-video-store.js';
import {demoCatalogue} from '../assets/stitch-lab.js';
export function validateStitchFiles() {
 const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'));
 const knowledge=read('content/suxiu-knowledge.json');
 const demos=demoCatalogue.map(d=>validateStitchDemo(read('content/stitch-demos/'+d.id+'.json')));
 for(const demo of demos)if(demo.knowledgeId&&!knowledge.some(k=>k.id===demo.knowledgeId&&k.verified===true))throw Error('针迹知识关联不存在：'+demo.id);
 const videos=validateVideoSources(read('content/stitch-video-sources.json'));
 return {demos:demos.map(d=>({id:d.id,count:d.stitches.length,knowledgeId:d.knowledgeId})),videos:videos.length};
}
