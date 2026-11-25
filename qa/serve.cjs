const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../deploy');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
http.createServer((request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');let target;
  try{target=path.resolve(root,'.'+decodeURIComponent(url.pathname));}catch{response.writeHead(400).end();return;}
  if(target!==root&&!target.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
  if(!fs.existsSync(target)){response.writeHead(404).end('Not found');return;}
  response.setHeader('Content-Type',types[path.extname(target)]||'text/plain');response.setHeader('Cache-Control','no-store');fs.createReadStream(target).pipe(response);
}).listen(4173,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173/visualization/'));
