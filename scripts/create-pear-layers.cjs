// Original vector study for Lihuaji, authored with AI assistance. No source image is segmented.
// Build-time only: Sharp rasterizes six aligned SVG canvases; the website needs no new dependency.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const out=path.resolve(__dirname,'../assets/ar-assets/layers/pear-blossom');
const defs=`<defs>
 <linearGradient id="silk" x2="1" y2="1"><stop stop-color="#faf8ec"/><stop offset=".5" stop-color="#ede8d7"/><stop offset="1" stop-color="#f7f3e5"/></linearGradient>
 <linearGradient id="leaf" x2="1" y2="1"><stop stop-color="#799279"/><stop offset=".45" stop-color="#496c57"/><stop offset="1" stop-color="#263f38"/></linearGradient>
 <radialGradient id="petal"><stop stop-color="#ded4b7"/><stop offset=".35" stop-color="#eee9d7"/><stop offset=".8" stop-color="#fffdf4"/><stop offset="1" stop-color="#e8e4d3"/></radialGradient>
 <linearGradient id="wood"><stop stop-color="#514537"/><stop offset=".55" stop-color="#8a7859"/><stop offset="1" stop-color="#564836"/></linearGradient>
 <pattern id="weave" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 1h8M1 0v8" stroke="#afa487" opacity=".13" stroke-width=".5"/></pattern>
 </defs>`;
const wrap=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${body}</svg>`;
const base=`<rect x="48" y="48" width="928" height="928" rx="4" fill="url(#silk)"/><rect x="48" y="48" width="928" height="928" fill="url(#weave)"/>
 <path d="M74 155V74h81M869 74h81v81M950 869v81h-81M155 950H74v-81" fill="none" stroke="#b4a17b" stroke-width="2"/>
 <circle cx="512" cy="512" r="395" fill="none" stroke="#b5aa8d" stroke-width=".7" opacity=".45"/>
 <g fill="#8e947f" opacity=".34">${Array.from({length:38},(_,i)=>`<circle cx="${100+(i*151)%824}" cy="${106+(i*197)%811}" r="${1+i%3}"/>`).join('')}</g>
 <g fill="none" stroke="#9c5446" opacity=".85"><rect x="800" y="818" width="44" height="54" rx="2" stroke-width="2"/><path d="M808 827h27m-22 0v16h21m-10-16v36m-13-12h25m-22 0v12m-6-23h30m-6 0v8" stroke-width="2"/></g>`;
const branchPaths=[['M240 915Q319 763 424 654T531 444Q552 290 682 129',20],['M422 657Q364 539 283 446Q244 392 231 303',11],['M489 551Q628 597 725 717T814 800',12],['M546 334Q634 323 713 254T802 169',9],['M322 771Q255 716 183 694',8],['M544 444Q638 422 713 363',7],['M537 414Q463 378 416 294',9]];
const branch=branchPaths.map(([d,w])=>`<path d="${d}" fill="none" stroke="url(#wood)" stroke-width="${w}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#c0ac7d" opacity=".5" stroke-width="${w*.12}"/>`).join('')+
 Array.from({length:17},(_,i)=>`<path d="M${255+i*15} ${877-i*26}l14 3" stroke="#5d4e3d" stroke-width="2" opacity=".5"/>`).join('');
const leaves=[[300,742,-80,1],[359,718,18,1.1],[414,640,-128,.92],[528,489,57,1.04],[584,577,-20,.8],[709,700,36,.93],[691,295,36,1],[572,325,-57,.85],[643,182,4,.65],[265,401,-98,.94],[712,363,62,.85],[330,512,45,.82],[763,759,-74,.65],[450,593,-10,.7]];
const leaf=leaves.map(([x,y,r,s])=>`<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M0 0Q-68-33-106-136Q-17-120 0 0" fill="url(#leaf)" stroke="#536c50" stroke-width="1.2"/><path d="M0 0Q-60-65-101-130" fill="none" stroke="#c1c7a2" stroke-width="1.4"/>${Array.from({length:9},(_,j)=>{const t=j/10;return `<path d="M${-8-78*t} ${-14-104*t}l${-23+12*t} ${-1-5*t}m${23-12*t} ${1+5*t}l${13-5*t} ${-15+6*t}" stroke="#b9c3a0" stroke-width=".6" opacity=".65"/>`;}).join('')}</g>`).join('');
const flowers=[[431,337,1.22,-12],[659,201,.86,22],[618,477,1.1,7],[350,602,.86,-31],[700,722,.72,17],[252,332,.56,0],[491,703,.53,45]];
function petals(indices){return flowers.map(([x,y,s,r])=>`<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">${indices.map(k=>`<g transform="rotate(${k*72})"><path d="M0 7C-20-12-68-22-66-66C-65-106-26-120-5-94C23-121 64-99 61-60C60-25 23-9 0 7Z" fill="url(#petal)" stroke="#aaa489" stroke-width="1.3"/>${Array.from({length:17},(_,i)=>{const x=(i-8)*4.6;return `<path d="M${x*.2} -7Q${x*1.2} -46 ${x} ${-80-Math.abs(x)*.14}" fill="none" stroke="${i%3===0?'#c8c2a7':'#e5dfc9'}" stroke-width=".85" opacity=".72"/>`;}).join('')}</g>`).join('')}</g>`).join('');}
const stamen=flowers.map(([x,y,s,r])=>`<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><circle r="18" fill="#bbab68"/>${Array.from({length:27},(_,i)=>{const a=i*2.39996,rr=19+(i%4)*5,x=Math.cos(a)*rr,y=Math.sin(a)*rr;return `<path d="M0 0Q${x*.4-4} ${y*.45} ${x} ${y}" fill="none" stroke="#9c813e" stroke-width="1.15"/><ellipse cx="${x}" cy="${y}" rx="3.1" ry="2.3" fill="${i%3?'#99743f':'#b69549'}"/>`;}).join('')}<circle r="5" fill="#71855e"/></g>`).join('');
const layers=[['layer_00_base',base],['layer_01_branch',branch],['layer_02_leaf',leaf],['layer_03_petals_back',petals([0,1,2])],['layer_04_petals_front',petals([3,4])],['layer_05_stamen',stamen]];
(async()=>{fs.mkdirSync(out,{recursive:true});for(const [name,body] of layers){fs.writeFileSync(path.join(out,name+'.svg'),wrap(body));await sharp(Buffer.from(wrap(body))).png().toFile(path.join(out,name+'.png'));}
 const composite=await sharp({create:{width:1024,height:1024,channels:4,background:'#f8f6ef'}}).composite(layers.map(([name])=>({input:path.join(out,name+'.png')}))).png().toBuffer();
 const markers=path.resolve(out,'../../markers');fs.mkdirSync(markers,{recursive:true});fs.writeFileSync(path.join(markers,'pear-blossom.png'),composite);
 console.log(JSON.stringify({layers:layers.length,size:1024,markerBytes:composite.length}));
})();
