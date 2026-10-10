// Editorial data, not an automated claim of expert review. All summaries are paraphrases.
const fs=require('node:fs');
const rows=[
 ['pear-source','陈师曾梨花图轴','https://www.dpm.org.cn/collection/paint/231017.html','馆藏说明'],
 ['peony-source','天下无双品，人间第一花','https://gugongzhanlan.dpm.org.cn/exhibitShare/2','官方展览'],
 ['lotus-source','青花鸳鸯荷花（满池娇）纹花口盘','https://www.dpm.org.cn/collection/ceramic/226855.html','馆藏说明'],
 ['gentlemen-source','五清','https://www.dpm.org.cn/lemmas/241515.html','博物馆词条'],
 ['auspicious-source','香色纱绣八团夔龙单袍：吉祥图案与杂宝词条','https://www.dpm.org.cn/collection/embroider/230670.html','馆藏说明'],
 ['meeting-source','黄色缂丝云蝠寿袷袍：喜相逢与八宝词条','https://www.dpm.org.cn/collection/embroider/230507.html','馆藏说明'],
 ['cloud-source','紫禁城里的五色瑞光——建筑祥云彩画','https://www.dpm.org.cn/gugongforum/detail/247422.html','博物馆讲座'],
 ['three-source','三多纹','https://www.dpm.org.cn/lemmas/241996.html','博物馆词条'],
 ['ruyi-source','如意，如意，如我心意','https://young.dpm.org.cn/article/562','博物馆教育'],
 ['pattern-source','青花釉里红凤穿花纹壮罐：缠枝、回纹、团花词条','https://www.dpm.org.cn/collection/ceramic/227118.html','馆藏说明'],
 ['peace-source','长寿平安','https://www.dpm.org.cn/lemmas/242217.html','博物馆词条'],
 ['ihchina','苏绣（项目编号Ⅶ-18）','https://www.ihchina.cn/project_details/13978/','国家非遗名录'],
 ['gb-suxiu','GB/T 38029-2019 苏绣','https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=EADE307A2B81C3ECF89679A3FD5D25E8','国家标准目录'],
 ['db-suxiu','DB3205/T 1076-2023 苏式传统文化 苏绣技艺与文化传承指南','https://std.samr.gov.cn/db/search/stdDBDetailed?id=FBB7EB7A5351D7F1E05397BE0A0A096C','地方标准目录']
];
const sources=rows.map(([id,title,url,sourceType])=>({id,title,organization:id==='ihchina'?'中国非物质文化遗产网':id.includes('suxiu')?'全国标准信息公共服务平台':'故宫博物院',url,sourceType,publicationDate:id==='gb-suxiu'?'2019-08-30':null,accessedDate:'2026-10-10',licenseOrUsage:'仅作事实出处链接及简短改写说明；不转载原图，不声称素材自由授权。',notes:id.includes('suxiu')?'仅核对标准目录信息，未据此提取全文工艺参数。':'已核对页面正文或官方搜索索引；不代表博物馆或专家为本项目背书。',verified:true}));
const records=[];
function add(id,name,source,fact,meaning='',key=null,tags=[],category='传统文化元素'){
 records.push({id,canonicalName:name,aliases:[name.replace(/纹$/,'')],category,verifiedMeanings:meaning?[{label:meaning,sourceId:source,context:fact}]:[],verifiedFacts:[{summary:fact,sourceId:source}],emotions:tags,occasions:[],compatibleMotifs:[],incompatibleMotifs:[],compositionRules:['circular','diagonal','paired'],paletteHints:[0,2,1,3],designRulesOrigin:'项目自定的当代构图与检索标签，不是历史文化结论；空兼容表表示未制定限制，不保证任意组合在历史上成立。',period:[],region:[],suzhouSpecific:false,craft:{verified:false,stitches:[],threadColors:[],productionOrder:null},sourceIds:[source],evidenceLevel:'A',reviewStatus:'approved',review:{method:'AI辅助公开来源事实核对',date:'2026-10-10',expertReviewed:false,scope:'仅所列事实；不包括工艺、传统配色或专家认证'},generatorKey:key,generationEnabled:!!key});
}
add('pear','梨花','pear-source','馆藏陈师曾作品以一枝梨花为题材；该条不证明梨花必然象征相守。','', 'pear',['自然','回忆','温柔'],'花卉');
add('peony','牡丹','peony-source','官方牡丹展将牡丹联系于幸福、美满和富贵。','吉祥富贵','peony',['祝愿','喜悦','祝贺'],'花卉');
add('lotus','莲花','lotus-source','元代盘饰有莲池鸳鸯与缠枝莲；只能作为历史形态证据。','','lotus',['自然','平静','夏天'],'花卉');
for(const [id,name] of [['plum','梅花'],['orchid','兰草'],['bamboo','竹叶']])add(id,name,'gentlemen-source','属于四君子题材；品格解释针对该类题材，非苏绣专属。','高洁与坚强',id,['坚韧','希望','成长'],'草木');
add('fish','鱼纹','auspicious-source','吉祥图案词条以鱼联系富足有余。','富足有余','fish',['祝愿','喜悦'],'动物');
add('butterfly','蝶纹','meeting-source','相向双蝶是喜相逢图案的一种，含义依赖成对组合。','双蝶喜相逢','butterfly',['重逢','相伴','惜别'],'动物');
add('bat','蝠纹','auspicious-source','吉祥图案词条以蝙蝠谐福。','福','bat',['祝愿','喜悦'],'动物');
add('cloud','祥云','cloud-source','建筑彩画讲座介绍祥云寄托吉祥愿望；不是苏绣专属证据。','吉祥祝愿','cloud',['祝愿','希望','平安'],'吉纹');
add('fruit','石榴纹','three-source','石榴是三多纹组成之一，与多子祝愿有关；不用于推断用户生育意愿。','多子（历史语境）','fruit',['家庭'],'果实');
add('ruyi','如意云头','ruyi-source','博物馆教育页介绍如意云头装饰与祈福祝颂。','祈福祝颂','ruyi',['祝愿','平安'],'吉纹');
for(const [id,name,fact,meaning] of [
 ['chrysanthemum','菊','为四君子组合之一。','高洁（组合语境）'],['pine','松','五清的增补元素之一。',''],['narcissus','水仙','五清的可选增补题材。',''],['scholar-rock','奇石','五清的可选增补题材。',''],['four-gentlemen','四君子','组合包含梅、兰、竹、菊。','高洁与坚强'],['five-pure','五清','在四君子之外增补松、水仙或奇石。','高洁（题材语境）']])add(id,name,'gentlemen-source',fact,meaning);
for(const [id,name,fact,meaning] of [['peach','寿桃','与佛手、石榴组合为三多。','祝寿'],['finger-citron','佛手','三多纹的组成。','多福（组合语境）'],['three-abundances','三多纹','由佛手、寿桃、石榴组成。','多福多寿多子']])add(id,name,'three-source',fact,meaning);
for(const [id,name,fact] of [['mandarin-duck','鸳鸯','馆藏元代盘上描绘鸳鸯莲池。'],['heron','鹭鸶','满池娇说明提及莲池小景中的鹭鸶。'],['lotus-pond','满池娇','历史上用于池塘花鸟景色的图案名称。'],['lotus-scroll','缠枝莲','该盘壁部以莲花和缠绕枝茎装饰。'],['diamond-brocade','菱形锦纹','该盘折沿的几何装饰。']])add(id,name,'lotus-source',fact);
for(const [id,name,fact,meaning] of [['magpie','喜鹊','词条用喜鹊表达喜庆。','喜庆'],['whitehead','白头翁','与牡丹组成富贵白头。',''],['deer','鹿','与鹤组成鹤鹿同春。',''],['crane','鹤','与鹿组成鹤鹿同春。',''],['lingzhi','灵芝','杂宝元素，亦见灵仙祝寿组合。',''],['coin','古钱','杂宝纹中的器物元素。',''],['fangsheng','方胜','杂宝纹中的元素。',''],['qing','磬','该袍双鱼衔磬表达吉庆有余。',''],['ingot','元宝','杂宝纹中的器物元素。',''],['scroll-book','书','杂宝纹中的元素。',''],['scroll-paint','画','杂宝纹中的元素。',''],['mugwort','艾叶','杂宝纹中的植物元素。',''],['banana-leaf','蕉叶','杂宝纹中的植物元素。',''],['treasure','杂宝纹','以多种吉祥物组合为装饰。',''],['ku dragon','夔龙','该袍主纹为团夔龙。','']])add(id.replace(' ','-'),name,'auspicious-source',fact,meaning);
for(const [id,name,fact] of [['floral-roundel','团花','圆形组织的装饰图案。'],['scrolling-branch','缠枝纹','以枝蔓相互缠绕构成连续图案。'],['meander','回纹','几何边饰的一种。'],['lotus-petal','莲瓣纹','词条介绍莲花瓣在瓷器上的历史应用。'],['peony-scroll','缠枝牡丹','缠枝花纹的题材之一。']])add(id,name,'pattern-source',fact);
for(const [id,name,fact] of [['meeting','喜相逢','相向双蝶、双喜鹊等组合形式。'],['long-life-character','寿字纹','云蝠寿袷袍中的文字纹样。'],['waves','立水纹','服饰下摆的水脚与波浪装饰。'],['eight-auspicious','八吉祥','具有佛教语境的八件吉祥供器组合，不在本版自动生成。']])add(id,name,'meeting-source',fact);
if(records.length!==50)throw Error('Expected 50: '+records.length);
for(const [key,value] of [['cultural-knowledge',records],['sources',sources]])fs.writeFileSync('content/'+key+'.json',JSON.stringify(value,null,2)+'\n');
console.log('50 source-linked records; 12 enabled visual primitives; no expert/craft approval asserted.');
