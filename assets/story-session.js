let session=null;
export const getStorySession=()=>session;
export const setStorySession=value=>(session=value);
export function recordAction(type,details){if(session)session.actions.push({time:new Date().toISOString(),type,details:structuredClone(details)});}
export async function hashSVG(svg){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(svg));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function exportSession(){if(!session)throw Error('请先生成一个方案');return {...structuredClone(session),sourceURLs:[...new Set([...session.sourceURLs,...(session.finalEvidence||[]).map(e=>e.url)])],motifSVGHash:session.selected?await hashSVG(session.selected.svg):null,finalSVGHash:session.finalOutput?await hashSVG(session.finalOutput.svg):session.selected?await hashSVG(session.selected.svg):null,hashAlgorithm:'SHA-256',usedRemoteAI:session.provider.usedRemoteAI,humanModified:session.actions.some(a=>a.type==='edit'),disclosure:'本地规则模式不是大模型推理；资料为AI辅助来源核对，未获专家工艺审核。哈希仅校验输出一致性，不是版权确权。'};}
