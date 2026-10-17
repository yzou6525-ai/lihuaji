import {getSuxiuKnowledgeById} from '../suxiu-knowledge-store.js';
export class CraftOverlay {
  constructor(root){this.root=root;}
  show(entry){
    const data=entry.definition;this.root.replaceChildren();
    const heading=document.createElement('h3');heading.textContent=data.name||'图层';this.root.append(heading);
    const list=document.createElement('dl');
    for(const [label,value] of [['针法',data.stitch],['丝线色号',data.threadColor],['绣制顺序',data.productionOrder]]){
      const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value===undefined||value===null||value===''?'资料待补充':String(value);list.append(dt,dd);
    }
    const note=document.createElement('p');note.textContent='这是构图分层示意。图层先后不代表实际绣制顺序。';this.root.append(list,note);this.root.hidden=false;
  }
  showSantao(onStart){
    this.hide();const token=this.token;this.root.hidden=false;
    const heading=document.createElement('h3');heading.textContent='散套针';
    const summary=document.createElement('p');summary.textContent='正在读取工艺知识…';
    const nature=document.createElement('p');nature.textContent='数字工艺示意 · 构图层不代表真实绣制顺序。';
    const button=document.createElement('button');button.id='santao-start';button.textContent='显影散套针';button.onclick=onStart;
    const link=document.createElement('a');link.href='../#guide/stitch-santao';link.target='_top';link.textContent='查看完整知识档案';link.className='santao-knowledge';
    this.root.append(heading,summary,nature,button,link);
    getSuxiuKnowledgeById('stitch-santao').then(record=>{if(this.token!==token)return;summary.textContent=record?record.summary+' 批批相迭 · 针针相嵌。':'工艺知识暂未载入，可查看完整档案。';}).catch(()=>{if(this.token===token)summary.textContent='工艺知识暂未载入，可查看完整档案。';});
  }
  hide(){this.token=(this.token||0)+1;this.root.hidden=true;this.root.replaceChildren();}
}
