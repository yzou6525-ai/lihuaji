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
  hide(){this.root.hidden=true;this.root.replaceChildren();}
}
