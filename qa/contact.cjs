const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
  const html='<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(4,400px);gap:8px">'+Array.from({length:28},(_,i)=>`<div style="color:white;font:15px Arial">${i+1}<img style="width:400px;display:block" src="slide-${String(i+1).padStart(2,'0')}.png"></div>`).join('')+'</body>';
  fs.writeFileSync(path.join(__dirname,'contact.html'),html);
  const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const p=await b.newPage({viewport:{width:1640,height:1800}});
  await p.goto('file:///'+path.join(__dirname,'contact.html').replaceAll('\\','/'));
  await p.screenshot({path:path.join(__dirname,'contact.png'),fullPage:true});
  await b.close();
})();
