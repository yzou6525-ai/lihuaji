const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const {serve}=require('./ar-local-server.cjs');
(async()=>{const {server,base}=await serve();let browser;
 try{browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();page.setDefaultTimeout(240000);
 page.on('console',m=>{if(m.text().startsWith('Compiled'))console.log(m.text());});
 await page.goto(base+'__compile');
 const bytes=await page.evaluate(async()=>{
  const {Compiler}=await import('./assets/vendor/mindar/mindar-image.prod.js');
  const targets=await(await fetch('./assets/ar-assets/targets.json')).json();
  const images=await Promise.all(targets.map(async t=>{const image=new Image();image.src='./assets/'+t.image;await image.decode();return image;}));
  const compiler=new Compiler();let last=-1;await compiler.compileImageTargets(images,p=>{const step=Math.floor(p/25)*25;if(step!==last){last=step;console.log('Compiled '+step+'%');}});
  return Array.from(compiler.exportData());
 });fs.writeFileSync(path.resolve(__dirname,'../assets/ar-assets/targets.mind'),Buffer.from(bytes));console.log(JSON.stringify({ok:true,targets:3,bytes:bytes.length}));
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
