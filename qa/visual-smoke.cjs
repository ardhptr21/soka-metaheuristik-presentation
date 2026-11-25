const {chromium}=require('playwright');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',error=>errors.push(error.stack));page.on('console',message=>{if(message.type()==='error')console.log('CONSOLE:',message.text());});
 await page.goto('http://127.0.0.1:4173/visualization/',{waitUntil:'networkidle'});
 await page.waitForTimeout(500);
 console.log(await page.evaluate(()=>({ready:!!window.AlgorithmLab,renderer:document.querySelector('#renderer-status').textContent,title:document.title,body:document.body.scrollWidth,innerWidth,errors:window.__errors})));
 await page.screenshot({path:path.join(__dirname,'visual-sma.png'),fullPage:true});
 if(await page.evaluate(()=>!!window.AlgorithmLab)){
   await page.evaluate(()=>{for(let i=0;i<18;i++)AlgorithmLab.advance();});
   await page.waitForTimeout(100);await page.screenshot({path:path.join(__dirname,'visual-sma-18.png'),fullPage:true});
   await page.locator('[data-view="ao"]').click();await page.waitForTimeout(200);await page.screenshot({path:path.join(__dirname,'visual-ao.png'),fullPage:true});
   await page.locator('[data-view="compare"]').click();await page.waitForTimeout(200);await page.screenshot({path:path.join(__dirname,'visual-compare.png'),fullPage:true});
 }
 console.log({errors});await browser.close();
})();
