"""Rebuild a reviewed museum batch; Python 3 + Pillow, curl for downloads.

Run from any directory: python scripts/import-museum-patterns.py --cache PATH
The committed selection contains reviewed metadata, never a live search's output.
Existing IDs are checked, and only this batch may be replaced on a repeat run.
"""
import argparse,collections,hashlib,json,re,subprocess
from pathlib import Path
from PIL import Image,ImageOps

ROOT=Path(__file__).resolve().parents[1]
BATCH='museum-2026-10-11'
DOC=ROOT/'docs/library-2026-10-11'
def digest(data):return hashlib.sha256(data).hexdigest()
def canonical(records):return json.dumps(records,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache',type=Path,required=True)
    args=parser.parse_args();args.cache.mkdir(parents=True,exist_ok=True)
    selection=json.loads((DOC/'selection.json').read_text(encoding='utf-8'))
    catalog=ROOT/'content/patterns.json';existing=json.loads(catalog.read_text(encoding='utf-8'))
    old=[p for p in existing if p.get('batch')!=BATCH]
    baseline=selection['preservedIds'];old_by_id={p['id']:p for p in old}
    assert all(id in old_by_id for id in baseline),'Existing entries missing'
    assert digest(canonical([old_by_id[id] for id in baseline]))==selection['preservedRecordsSha256'],'Existing entries changed; review before importing'
    before=set(old_by_id);rows=selection['records'];assert len(rows)>=200
    assert len({r['id'] for r in rows})==len(rows)
    prepared=[];seen_hash={p.get('sha256') for p in old}
    tag_rules=[('花草藤蔓',r'花|叶|草|枝|树|莲|蔓|棕榈'),('鸟兽鱼虫',r'鸟|兽|鱼|蝶|龙|鹤|狮|鹅|鸡|雉|马'),('人物故事',r'人物|群像|三尊|护法|头像|庭园|佛教|唐卡|壁画|生平'),('几何与团花',r'几何|团|圆|菱|格|星|对称|心叶|点|列|环|三角|扇|放射|卷云|结形'),('边饰与织锦',r'边|锦|带|饰|披|巾|衣|裙|织|袍|绣|片|毯|罩|布')]
    for c in rows:
        raw=c['sourceRecord'];assert c['id'] not in before,'Duplicate existing ID'
        assert raw['share_license_status']=='CC0' and raw['images']['web']['url']==c['downloadUrl']
        assert c['downloadUrl'].startswith('https://openaccess-cdn.clevelandart.org/')
        p=args.cache/(c['id']+'.jpg')
        if not p.exists():
            subprocess.run(['curl.exe','-sS','-L','--fail','--retry','2','--connect-timeout','15','--max-time','90',c['downloadUrl'],'-o',str(p)],check=True)
        source_hash=digest(p.read_bytes());assert source_hash==c['sourceImageSha256'],'Image changed upstream; review before replacing'
        assert source_hash not in seen_hash,'Duplicate source image';seen_hash.add(source_hash)
        im=ImageOps.exif_transpose(Image.open(p)).convert('RGB');width,height=im.size
        assert max(width,height)>=700 and min(width,height)>=120
        paths=[];hashes=[]
        for suffix,size,quality in [('',1400,90),('-thumb',480,85)]:
            image_path='assets/patterns/museum-'+c['id']+suffix+'.webp'
            out=ROOT/image_path;out.parent.mkdir(parents=True,exist_ok=True)
            resized=im.copy();resized.thumbnail((size,size));resized.save(out,format='WEBP',quality=quality,method=6)
            paths.append(image_path);hashes.append(digest(out.read_bytes()))
        tags=[name for name,pattern in tag_rules if re.search(pattern,c['title'])]
        if not tags:tags=['边饰与织锦']
        creator='；'.join(x['description'] for x in raw.get('creators',[]) if x.get('description')) or '馆方未列出具名作者'
        basic=c['collection']=='basic'
        note='基础取样建议：先取一组轮廓清楚的花叶或几何单元练习，不把整幅馆藏图当成简易针法图。' if basic else '复杂参考建议：观察主体、重复单元与边饰的组织，先选局部做小样，再调整色数和线距。'
        if '人物故事' in tags:note+='人物和礼仪场景作为图像结构参考，具体宗教含义以馆方说明为准。'
        prepared.append(dict(id=c['id'],title=c['title'],originalTitle=raw['title'],region=c['region'],tags=tags,date=raw.get('creation_date') or '馆方未注明',culture=raw.get('culture') or [],technique=raw.get('technique') or '',description=f"{c['title']}。馆藏原作：{raw['title']}。中文名称依据题材与可见形态整理，原作资料见下方出处。",source='克利夫兰艺术博物馆',sourceUrl=raw['url'],sourceApiUrl=c['sourceApiUrl'],accession=raw['accession_number'],license='CC0',licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/',rightsPolicyUrl='https://www.clevelandart.org/open-access',author=creator,credit=raw.get('creditline') or '',originalImageUrl=raw['images'].get('print',raw['images']['web'])['url'],downloadUrl=c['downloadUrl'],image=paths[0],thumbnail=paths[1],width=width,height=height,sha256=source_hash,imageSha256=hashes[0],thumbnailSha256=hashes[1],collected='2026-10-11',rightsVerifiedAt='2026-10-11',collection=c['collection'],difficulty='基础局部取样参考' if basic else '复杂馆藏参考',curationNote=note,labelNote='中文检索名、题材标签与难度为本库整理，不是馆方定名或历史寓意。未进行实际试绣；中国及其他地区传统图像不自动等于苏绣专用纹样。',changes='保留原图构图，仅等比例缩小并转为 WebP；无裁切、重绘、调色或新增历史解释。',batch=BATCH,review=dict(visualScreened=True,expertReviewed=False,sourceLicense='CC0',method='馆方开放数据许可核对、馆藏编号及图像去重、缩略图逐项筛选')))
    assert len({p['imageSha256'] for p in prepared})==len(prepared)
    # New entries are visible first, but all old records and their relative order stay intact.
    catalog.write_text(json.dumps(prepared+old,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    report=dict(batch=BATCH,added=len(prepared),preserved=len(old),total=len(prepared)+len(old),regions=dict(collections.Counter(p['region'] for p in prepared)),collections=dict(collections.Counter(p['collection'] for p in prepared)),tags=dict(collections.Counter(t for p in prepared for t in p['tags'])),source='克利夫兰艺术博物馆',license='CC0',ids=[p['id'] for p in prepared],originalRecordCount=len(baseline),imageBytes=sum((ROOT/p[k]).stat().st_size for p in prepared for k in ['image','thumbnail']))
    (DOC/'import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='ids'},ensure_ascii=False))

if __name__=='__main__':main()
