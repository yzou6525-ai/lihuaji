// Project digital design, not measured traditional stitches. Pure and reproducible.
const round=n=>Math.round(n*1000)/1000;
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function generateSantaoPetal() {
  let seed=5602814;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const stitches=[],lanes=[];
  const colors=['#E1D8C9','#D7CDBD','#E4DCCC'];
  // A modest lean belongs to the authored petal, not the website's layout.
  const lean=([x,y])=>[x*Math.cos(.23)+y*Math.sin(.23),-x*Math.sin(.23)+y*Math.cos(.23)].map(round);
  const add=(start,end,group)=>{const length=Math.hypot(end[0]-start[0],end[1]-start[1]);stitches.push({id:'sp'+String(stitches.length+1).padStart(3,'0'),order:stitches.length+1,group,start:lean(start),end:lean(end),color:colors[group-1],lengthClass:length>48?'long':length>36?'medium':'short'});};
  // A broad, slightly leaning crown; the open arc includes both shoulders.
  // Perturbed lanes are ordered around the edge, never mirrored or alternating.
  for(let i=0;i<28;i++) {
    const t=-1+2*(i+(i===0||i===27?0:(random()-.5)*.6))/27;
    const start=[43*Math.sin(t*1.35)+4*(1-t*t),46-42*Math.pow(Math.abs(t),3)-4*t+.7*Math.sin(i*1.71)];
    const inset=1-Math.abs(t),length=18+20*inset+random()*(12+12*inset);
    const end=[start[0]*(.68+.08*Math.abs(t))+2*Math.sin(i*.77)+(random()-.5)*2,start[1]-length];
    lanes.push({t,start,end});add(start,end,1);
  }
  // New strands begin BETWEEN neighboring outer strands, well inside their span.
  // These overlap fractions are visual parameters, not official craft standards.
  const middle=[];
  for(let i=0;i<14;i++) {
    const a=lanes[i*2],b=lanes[i*2+1],t=(a.t+b.t)/2;
    const outer=mix(a.start,b.start,.48),inner=mix(a.end,b.end,.48);
    const start=mix(outer,inner,.38+random()*.19);
    const end=[17*t-1+(random()-.5)*3,Math.max(-42+12*Math.abs(t),start[1]-(30+random()*15+8*(1-Math.abs(t))))];
    middle.push({start,end,t});add(start,end,2);
  }
  // Offset from the middle strands, with staggered entries and tapered base ends.
  for(let i=0;i<14;i++) {
    const m=middle[i],start=mix(m.start,m.end,.25+random()*.28);
    start[0]+=(i<7?1:-1)*(.65+random()*.7);
    const end=[18*m.t-2+(random()-.5)*2.6,-49+16*Math.abs(m.t)+(random()-.5)*5];
    add(start,end,3);
  }
  return {
    schemaVersion:1,id:'demo-santao-pear-petal',title:'散套针 · 梨花瓣数字示意',knowledgeId:'stitch-santao',
    nature:'digital-craft-visualization',expertReviewed:false,historicalReconstruction:false,illustrativeStitchCount:56,
    coordinateSystem:'arbitrary-units-y-up',canvasBounds:{minX:-50,maxX:50,minY:-55,maxY:60},
    renderStyle:{strandWidthRatio:.028},
    batches:[{group:1,count:28,label:'第一批 · 出边'},{group:2,count:14,label:'第二批 · 套入'},{group:3,count:14,label:'第三批 · 相嵌'}],
    note:'56条针迹为《梨花季》为解释散套针结构而设计的数字示意，并非某件历史苏绣作品的逐针复原，也不是传统梨花的标准针数。',
    authenticityNote:'本示意依据《梨花季》已核验的散套针公开资料进行数字结构演示。梨花瓣造型、56条示意针迹及其具体坐标为项目数字设计，并非某件历史苏绣作品的逐针复原，未经苏绣专家人工审定。',
    colorNote:'批次颜色与高亮仅用于数字结构区分，不代表真实苏绣丝线配色。',
    digitalDesign:{seed:5602814,generator:'scripts/santao-petal-data.mjs',ruleType:'project-digital-illustration',description:'单瓣外缘、错落终点、相邻针间套入、收窄基部；针数、坐标、批次、重叠比例、宽度及颜色均为项目数字示意规则。'},
    stitches
  };
}
