import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const catalogPath = 'content/patterns.json';
const assetDir = 'assets/patterns';
const batch = 'met-cloud-curated-v1';
const licenseUrl = 'https://www.metmuseum.org/policies/frequently-asked-questions-image-and-data-resources';
const categories = {
  '如意/灵芝云': [3,4,7,15,16,31,43,45,46],
  '流云/波浪云': [1,5,6,9,10,17,19,21,27,28,33,34,36],
  '团云/朵云': [2,11,18,20,22,23,24,26,29,30,32,35,37,41],
  '连续/结构云': [8,12,13,14,25,38,40,42,44],
  '云气纹': [39,47,48,49,50]
};
const specs = [
  [1,'69815','清代长尾如意流云 A','横向长尾的如意云头方向','流云/波浪云','flowing profile'],
  [2,'69815','清代卷首短尾祥云 B','卷首短、尾部收束的祥云方向','团云/朵云','layered relief'],
  [3,'69803','缂丝紧凑灵芝云 A','适合观察紧凑灵芝云头和线带关系','如意/灵芝云','radial ornament'],
  [4,'69803','双卷如意朵云 B','适合观察双卷式如意朵云的组织','如意/灵芝云','layered relief'],
  [5,'76609','明代细长上扬流云 A','上扬细长的流云构成方向','流云/波浪云','flowing profile'],
  [6,'76609','横向长尾吉祥云 B','横向延展的长尾云带方向','流云/波浪云','continuous border'],
  [7,'76616','灵芝形斜向云头 A','斜向灵芝云头的造型方向','如意/灵芝云','flowing profile'],
  [8,'76616','斜向连续云带 B','可观察斜向重复云带的节奏','连续/结构云','continuous border'],
  [9,'76619','明代波浪长云 A','波浪起伏的长云方向','流云/波浪云','flowing profile'],
  [10,'76619','弧形翻卷云 B','弧线翻卷的云头方向','流云/波浪云','layered relief'],
  [11,'76623','彩色独立朵云 A','多色独立云朵的配色参考方向','团云/朵云','radial ornament'],
  [12,'76623','多色连续云头 B','连续云头与多色组织参考方向','连续/结构云','continuous border'],
  [13,'76625','明代斜向云带 A','斜向带状纹样组织参考','连续/结构云','continuous border'],
  [14,'76625','折转式云纹 B','带有折转节奏的云纹方向','连续/结构云','continuous border'],
  [15,'70458','四合如意云肩瓣 A','可作云肩中心周围放射瓣形构成参考','如意/灵芝云','cloud collar center'],
  [16,'70458','单瓣放射云肩 B','单瓣放射式云肩单元参考方向','如意/灵芝云','radial ornament'],
  [17,'44121','明代低平横向云 A','低平横向云纹构成参考','流云/波浪云','continuous border'],
  [18,'44121','兔纹之间短尾朵云 B','动物主体之间短尾云朵的构成方向','团云/朵云','layered relief'],
  [19,'68577','云鹤纹细尾祥云 A','鹤纹环境中的细尾祥云方向','流云/波浪云','flowing profile'],
  [20,'68577','鹤间团状朵云 B','鹤纹之间团状云朵的构成方向','团云/朵云','radial ornament'],
  [21,'68861','波涛上升卷云 A','波涛上方卷云的动势参考方向','流云/波浪云','flowing profile'],
  [22,'68861','鹤周围独立祥云 B','鹤纹周边独立祥云的构成方向','团云/朵云','layered relief'],
  [23,'68892','白鹭补子团云 A','补子环境中的团云母版方向','团云/朵云','radial ornament'],
  [24,'68892','山石间小型卷云 B','山石间小型卷云的构成参考方向','团云/朵云','layered relief'],
  [25,'65134','圆补边缘环绕流云 A','圆形补子边缘环绕流云方向','连续/结构云','continuous border'],
  [26,'65134','龙周围独立朵云 B','龙纹周围独立云朵构成方向','团云/朵云','layered relief'],
  [27,'62892','龙身上扬长云 A','龙纹环境中上扬长云的构成方向','流云/波浪云','flowing profile'],
  [28,'62892','山水上方横向卷云 B','山水上方横向云带的构成参考','流云/波浪云','continuous border'],
  [29,'68302','花枝间柔软团云 A','花枝间柔和团云的构成方向','团云/朵云','layered relief'],
  [30,'68302','花鸟背景散云 B','花鸟背景中散云的组织参考方向','团云/朵云','layered relief'],
  [31,'70290','蝙蝠间小如意云 A','蝠纹之间小型如意云头方向','如意/灵芝云','radial ornament'],
  [32,'70290','鱼纹外围吉祥云 B','鱼纹周边祥云构成参考方向','团云/朵云','layered relief'],
  [33,'44101','扇面横向长云 A','扇面内横向长云构成方向','流云/波浪云','continuous border'],
  [34,'44101','海浪上升流云 B','海浪上方上升流云的构成方向','流云/波浪云','flowing profile'],
  [35,'39642','龙下厚重团云 A','龙纹下方厚重团云的构成方向','团云/朵云','layered relief'],
  [36,'39642','火珠周围轻型流云 B','火珠周围轻型流云的构成参考','流云/波浪云','flowing profile'],
  [37,'42416','康熙浅浮雕独立朵云 A','浅浮雕独立云朵的造型参考方向','团云/朵云','layered relief'],
  [38,'42416','青釉连续浮雕云 B','青釉表面连续浮雕云纹参考方向','连续/结构云','continuous border'],
  [39,'42247','康熙旋涡云 A','旋涡状云纹造型方向','云气纹','flowing profile'],
  [40,'42247','环绕式旋云带 B','环绕旋云带的连续组织方向','连续/结构云','continuous border'],
  [41,'48051','明代青花独立祥云 A','青花装饰中的独立祥云方向','团云/朵云','radial ornament'],
  [42,'48051','青花对称卷云 B','对称卷云的组织参考方向','连续/结构云','continuous border'],
  [43,'51020','乾隆刻划如意云 A','刻划如意云头的构成参考方向','如意/灵芝云','layered relief'],
  [44,'51020','浅刻连续云边 B','浅刻连续云边的组织参考方向','连续/结构云','continuous border'],
  [45,'46608','金元几何化朵云 A','几何化朵云的造型参考方向','如意/灵芝云','radial ornament'],
  [46,'46608','简化双卷云 B','简化双卷云的构成参考方向','如意/灵芝云','layered relief'],
  [47,'36449','西汉云气长曲线 A','长曲线云气纹的构成方向','云气纹','flowing profile'],
  [48,'36449','西汉旋卷云气 B','旋卷曲线云气纹的构成方向','云气纹','flowing profile'],
  [49,'42367','西汉天界长云气 A','长线条云气纹的构成参考方向','云气纹','flowing profile'],
  [50,'42367','西汉旋绕云雾 B','旋绕式云雾纹构成参考方向','云气纹','layered relief']
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const featuredRank = number => number % 2 ? (number - 1) / 2 : 25 + number / 2;
const catalog = JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const preservedCatalog=catalog.filter(row=>row.batch!==batch);
const metIds = [...new Set(specs.map(x=>x[1]))];
const skipped=[]; const objects=new Map();
for (const id of metIds) {
  let record;
  try {
    record=await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`).then(r=>{if(!r.ok)throw new Error(`API HTTP ${r.status}`);return r.json()});
    if(record.isPublicDomain!==true)throw new Error('API isPublicDomain is not true');
    if(!record.primaryImageSmall&&!record.primaryImage)throw new Error('no official primary image');
    objects.set(id,record);
  } catch(error) { skipped.push({objectId:id,reason:error.message}); }
}
fs.mkdirSync(assetDir,{recursive:true});
const rows=[];
for (const [number,id,title,subtitle,category,shapeType] of specs) {
  const o=objects.get(id); if(!o)continue;
  const imageUrl=o.primaryImageSmall||o.primaryImage;
  const ext=/\.png(?:\?|$)/i.test(imageUrl)?'png':'jpg';
  const image=`${assetDir}/met-${id}.${ext}`;
  try {
    if(!fs.existsSync(image)) {
      const response=await fetch(imageUrl); if(!response.ok)throw new Error(`image HTTP ${response.status}`);
      const bytes=Buffer.from(await response.arrayBuffer());
      if(bytes.length<1000)throw new Error(`image too small (${bytes.length} bytes)`);
      fs.writeFileSync(image,bytes);
    }
    const bytes=fs.readFileSync(image);
    if(bytes.length<1000)throw new Error(`local image too small (${bytes.length} bytes)`);
    const group=Object.entries(categories).find(([,members])=>members.includes(number))?.[0];
    if(!group||group!==category)throw new Error(`category map mismatch for ${number}`);
    const sourceUrl=o.objectURL||`https://www.metmuseum.org/art/collection/search/${id}`;
    const record={
      id:`met-cloud-${String(number).padStart(3,'0')}`, title, subtitle,
      originalTitle:o.title, museumObjectTitle:o.title, museumObjectId:id,
      region:'中国传统', country:o.culture||'中国', culture:[o.culture||'China'],
      date:o.objectDate||'馆方未注明', dynastyOrPeriod:o.objectDate||'馆方未注明',
      technique:o.medium||'', medium:o.medium||'', description:`${title}：${subtitle}。本条为从 The Met 馆藏图像中筛选出的祥云母版方向，当前展示的是整件馆藏原图，未单独裁切或矢量化。馆藏原题与年代以馆方记录为准。`,
      source:'The Metropolitan Museum of Art', sourceName:'The Metropolitan Museum of Art', sourcePlatform:'The Met',
      sourceUrl, sourceApiUrl:`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
      accession:String(o.accessionNumber??id), license:'Public Domain / Open Access', licenseUrl,
      rightsPolicyUrl:'https://www.metmuseum.org/policies/image-resources', publicDomain:true,
      author:o.artistDisplayName||'馆方未列出具名作者', credit:o.creditLine||'The Metropolitan Museum of Art',
      image, thumbnail:image, imageUrl, thumbnailUrl:imageUrl,
      imageSha256:hash(bytes), sha256:hash(bytes),
      tags:['祥云','云纹',category,'The Met','大都会',...(o.objectDate?[]:[])], styleFamily:category, shapeType,
      threeDReady:true, curationLevel:'curated', featured:true, sortWeight:1000-featuredRank(number),
      cloudSeries:batch, qualityScore:4,
      recommendedFor:['2D-to-3D','ornament','cloud-library',shapeType],
      originCategory:o.objectName||o.classification||'馆藏装饰艺术', collection:'archive', batch,
      searchTerms:[title,subtitle,'祥云','云纹','如意云','灵芝云','流云','波浪云','团云','朵云','云气纹','云肩','The Met','大都会',o.objectDate||'',o.title,id,String(o.accessionNumber??id),category].join(' '),
      usageNote:`可作为${shapeType}与二维转三维造型参考；馆藏原图未单独裁云纹，不代表苏绣专属纹样或经过工艺验证。`,
      curationNote:'精选为云纹母版观察方向；名称与形态说明为本库整理，不是馆方定名。',
      labelNote:'使用整件馆藏图作来源展示，未独立抠取云纹；中文命名为检索与造型参考。非苏绣专属判断，实际工艺需由专业人员另行验证。',
      changes:'本地保存馆方公开图像原始文件；未裁切、重绘、调色或矢量化。', rightsVerifiedAt:new Date().toISOString().slice(0,10),
      visible:true, review:{visualScreened:false,expertReviewed:false,sourceLicense:'Public Domain / Open Access',method:'The Met Collection API isPublicDomain=true and official image URL verified; image decoded during browser acceptance.'}
    };
    rows.push(record);
  } catch(error) { skipped.push({objectId:id,entry:number,title,reason:error.message}); }
}
const byId=new Map(catalog.map(row=>[row.id,row]));
for(const row of rows)byId.set(row.id,row);
const merged=[...byId.values()];
fs.writeFileSync(catalogPath,JSON.stringify(merged,null,2)+'\n');
fs.mkdirSync('docs/cloud-library',{recursive:true});
fs.writeFileSync('docs/cloud-library/met-api-snapshot.json',JSON.stringify([...objects.values()],null,2)+'\n');
const report={batch,metObjects:metIds.length,requested:specs.length,added:rows.length,skipped,byCategory:Object.fromEntries(Object.keys(categories).map(k=>[k,rows.filter(r=>r.styleFamily===k).length])),assetCount:new Set(rows.map(r=>r.image)).size,preservedRecords:preservedCatalog.length,preservedCatalogSha256:hash(Buffer.from(JSON.stringify(preservedCatalog)))};
fs.writeFileSync('docs/cloud-library/import-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
