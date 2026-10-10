const GROUPS=['background','branch','secondary','primary','detail'];
export async function createARLayersFromSVG(svg){
 if(typeof svg!=='string'||svg.length>2000000)throw Error('构图数据过大');
 const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
 if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw Error('SVG 数据无效');
 const allowed=new Set(['svg','g','path','circle','ellipse','rect','title','desc']);
 for(const el of doc.querySelectorAll('*')){if(!allowed.has(el.localName))throw Error('SVG 包含不支持的外部资源或元素');for(const a of el.attributes)if(/^on/i.test(a.name)||/href|style/i.test(a.name)||/url\s*\(/i.test(a.value))throw Error('SVG 属性不安全');}
 const groups=GROUPS.map(id=>[...doc.documentElement.children].find(g=>g.getAttribute('data-layer')===id));if(groups.some(g=>!g))throw Error('需要五个语义图层');
 async function raster(content){const url=URL.createObjectURL(new Blob([content],{type:'image/svg+xml'}));try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;canvas.getContext('2d').drawImage(img,0,0,1024,1024);return canvas.toDataURL('image/png');}finally{URL.revokeObjectURL(url);}}
 const serializer=new XMLSerializer(),layers=[];
 for(let i=0;i<groups.length;i++){const body=serializer.serializeToString(groups[i]);layers.push({name:groups[i].getAttribute('data-layer-name')||GROUPS[i],src:await raster(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 600 600">${body}</svg>`),depth:i*.035});}
 return {layers,artworkImage:await raster(svg),credit:'用户故事经本地规则或已记录的模型提出候选，再由用户选择；程序化构图的五层视觉示意，不代表真实绣制顺序。'};
}
