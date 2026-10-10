// Future integration point. Never rename SVG/CSV bytes to a machine embroidery extension.
export class EmbroideryExportProvider{
 constructor(adapter=null){this.adapter=adapter;}
 get formats(){return this.adapter?.formats||[];}
 async export(design,format){if(!this.adapter||!this.formats.includes(format))throw Error('机器刺绣打样导出尚未启用；可下载数字工艺参考 SVG / CSV。');return this.adapter.export(design,format);}
}
