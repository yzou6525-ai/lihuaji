import {icon} from './ui.js';
const art=name=>'./assets/ivory/'+name+'.webp';
const section=(title,en,href,label)=>`<div class="section-heading"><div class="section-label"><h2>${title}</h2><span class="english">${en}</span></div><a class="text-link" href="${href}">${label}${icon('arrow')}</a></div>`;
export const stitchArchive=[
 {name:'平绣',caption:'丝理平整细腻，藏功于一针。',image:'embroidery',position:'25% 62%',body:'平绣注重丝理整齐、针脚匀密和布面平服。先用短而平行的直线针练习，保持拉线力度一致，再尝试小片花瓣与叶面。',lesson:0},
 {name:'乱针绣',caption:'以针代笔，层层叠色。',image:'silk',position:'45% 35%',body:'乱针绣用方向交错、长短相间的针脚叠加色彩与明暗。它不是随意把线堆在一起，需要观察对象的体积与色阶。初学时先练习疏密和单层张力。',lesson:0},
 {name:'打籽绣',caption:'一粒一珠，点出花蕊生机。',image:'embroidery',position:'54% 53%',body:'打籽绣以立体小结表现花蕊、果实等点状细节。绕线松紧、入针位置和绣线粗细会影响成籽大小。初学时应先在小样上练习；本页为针法介绍，不提供打籽针路动画。',lesson:0},
 {name:'套针绣',caption:'长短相接，晕染细微的过渡。',image:'embroidery',position:'25% 20%',body:'套针用长短错落、前后穿插的针脚衔接色阶，常用于花瓣和叶片。顺着丝理方向套接，避免针脚尾端形成生硬的直线。可以从两种相近色开始。',lesson:1}
];
export const palette=[
 {name:'绢白',hex:'#F8F6EF',story:'如初展的绢帛，容纳光与留白。'},
 {name:'梨花白',hex:'#EDE9DF',story:'花瓣的柔光，温润而不刺眼。'},
 {name:'青瓷绿',hex:'#C8D6C9',story:'取一抹青瓷，衬托细密针脚。'},
 {name:'远山绿',hex:'#7B9480',story:'山影与新叶之间的安静色阶。'},
 {name:'墨竹绿',hex:'#3F5A4F',story:'深而不重，让文字清晰可读。'},
 {name:'朱砂红',hex:'#C95A4A',story:'只用一枚印，落款东方心意。'}
];
export function homeMarkup(site,esc){
 const heading=esc(site.title).replace('，','，<br>');
 return `<section class="hero ivory-hero"><div class="hero-copy"><h1>${heading}</h1><p>${esc(site.intro)}</p><a class="btn primary hero-cta" href="#create">开始译绣 ${icon('arrow')}</a><span class="english hero-caption">TRADITION MEETS THE FUTURE</span></div><div class="hero-art"><img src="${art('hero')}" alt="梨花苏绣绣框、青绿色丝线与瓷器的馆藏风格概念陈列" width="1536" height="1024" fetchpriority="high"></div></section>
 <section class="today-section">${section('今日绣事','TODAY IN EMBROIDERY','#library','查看更多')}<div class="today-grid">
 <a class="editorial-card" href="#exhibit"><img src="${art('embroidery')}" alt="梨花丝线针脚概念特写" width="1200" height="900"><div><h3>梨花新绣</h3><p>循着花瓣，细看春意如何落针。</p><span>EXPLORE ${icon('arrow')}</span></div></a>
 <a class="editorial-card" href="#create"><img src="${art('garden')}" alt="苏州园林与梨花的东方意境概念图" width="1200" height="675"><div><h3>绣稿上色体验</h3><p>从一张图片开始，感受东方色彩。</p><span>CREATE ${icon('arrow')}</span></div></a>
 <a class="editorial-card" href="#palette"><img src="${art('silk')}" alt="青绿与米白色丝线的材质概念特写" width="1200" height="900"><div><h3>东方色谱</h3><p>从草木与山水中，寻找细腻的色彩。</p><span>DISCOVER ${icon('arrow')}</span></div></a>
 </div></section>
 <section class="stitch-section">${section('针法档案','STITCH ARCHIVE','#ar','进入针法课堂')}<div class="stitch-grid">${stitchArchive.map((s,i)=>`<button class="stitch-card" data-stitch="${i}" aria-label="了解${s.name}"><span class="stitch-photo"><img src="${art(s.image)}" style="transform-origin:${s.position}" alt="" width="120" height="120" loading="lazy"></span><span class="stitch-copy"><strong>${s.name}</strong><span>${s.caption}</span><small class="english">LEARN MORE ${icon('arrow')}</small></span></button>`).join('')}</div></section>
 <a class="museum-banner" href="#gallery"><div><div class="section-label"><h2>梨花绣馆</h2><span class="english">THE EMBROIDERY<br>MUSEUM</span></div><p>在园林之间，遇见苏绣的当代生活方式。</p><span class="text-link">走进绣馆 ${icon('arrow')}</span></div><img src="${art('garden')}" alt="梨花掩映的园林概念场景" width="1200" height="675" loading="lazy"></a>`;
}

