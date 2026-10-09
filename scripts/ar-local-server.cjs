const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
exports.serve=async(root=path.resolve(__dirname,'..'))=>{
 const types={'.js':'text/javascript','.json':'application/json','.html':'text/html','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.mind':'application/octet-stream','.wasm':'application/wasm'};
 const server=http.createServer((req,res)=>{
  let name;try{name=decodeURIComponent(new URL(req.url,'http://test.local').pathname);}catch{res.writeHead(400);res.end();return;}
  if(name==='/lihuaji/__compile'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Local target compilation</title>');return;}
  if(!name.startsWith('/lihuaji/')){res.writeHead(404);res.end();return;}
  const file=path.resolve(root,name.slice('/lihuaji/'.length)||'index.html');
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));return {server,base:'http://127.0.0.1:'+server.address().port+'/lihuaji/'};
};
