const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 for(const kind of ['ao','sma']){
  await page.goto(`http://127.0.0.1:4173/visualization/?view=${kind}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.AlgorithmLab);
  await page.locator('#focus-button').click();await page.locator('#learn-button').click();
  const evaluations=await page.evaluate(()=>AlgorithmLab.simulation.optimizers.AO.evaluations);
  for(let stage=0;stage<5;stage++){
   await page.locator(`[data-stage="${stage}"]`).click();await page.waitForTimeout(120);
   assert.equal(await page.locator('#lesson-scene-card').isVisible(),true);
   assert.equal(await page.locator('#lesson-scene-number').innerText(),String(stage+1).padStart(2,'0'));
   assert.equal(await page.locator('#lesson-readout>div').count(),3);
   const semantic=await page.evaluate(kind=>{
    const lab=AlgorithmLab,frame=lab.scene.scenes[kind].lessonVisual.userData.frame;
    return {stage:frame.step,markers:frame.markers.map(m=>m.name),arrows:frame.arrows.length,color:frame.color,evaluations:lab.simulation.optimizers.AO.evaluations,geometry:lab.scene.scenes[kind].lessonVisual.children.length};
   },kind.toUpperCase());
   assert.equal(semantic.stage,stage);assert.ok(semantic.geometry>0);assert.equal(semantic.evaluations,evaluations);
   if(stage===1){assert.ok(semantic.arrows>0);assert.equal(await page.locator('#lesson-scene-formula').isVisible(),true);}
   if(stage>=2)assert.ok(semantic.arrows>0);
   await page.screenshot({path:path.join(__dirname,`visible-${kind}-${stage+1}.png`)});
  }
  // Fit changes only the camera, and the default displacement is readable in pixels.
  const inspect=()=>page.evaluate(kind=>{
   const s=AlgorithmLab.scene,v=s.viewports()[0],f=s.scenes[kind].lessonVisual.userData.frame;
   const a=f.before.clone().project(s.scenes[kind].camera),b=f.clip.clone().project(s.scenes[kind].camera);
   return {separation:Math.hypot((a.x-b.x)*v.w/2,(a.y-b.y)*v.h/2),positions:s.debug().positions,camera:s.camera.position.toArray()};
  },kind.toUpperCase());
  const fitted=await inspect();assert.ok(fitted.separation>60,JSON.stringify(fitted));
  await page.locator('#fit-camera').click();await page.locator('#lesson-focus-camera').click();await page.waitForTimeout(100);assert.deepEqual((await inspect()).positions,fitted.positions);
  await page.locator('#close-lesson').click();assert.equal(await page.locator('#lesson-scene-card').isVisible(),false);
 }
 // Long, out-of-bounds proposals retain exact coordinates, with a labelled truncated direction arrow.
 await page.locator('#focus-button').click();await page.locator('[data-view="ao"]').click();
 await page.evaluate(()=>{for(let i=0;i<12;i++){const d=AlgorithmLab.simulation.snapshot('AO').updates.find(d=>d.rawProposal.slice(0,3).some(x=>Math.abs(x)>3));if(d){AlgorithmLab.select('AO',d.id);return;}AlgorithmLab.advance();}throw Error('Missing long AO proposal');});
 await page.locator('#learn-button').click();await page.locator('[data-stage="2"]').click();await page.waitForTimeout(80);
 assert.ok(await page.evaluate(()=>AlgorithmLab.scene.scenes.AO.lessonVisual.userData.frame.markers.some(m=>m.name==='ARAH MENTAH ↗')));
 await page.screenshot({path:path.join(__dirname,'visible-ao-outside.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.locator('#focus-button').click();await page.locator('[data-stage="4"]').click();await page.locator('#lesson-focus-camera').click();await page.waitForTimeout(100);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal(await page.locator('#lesson-scene-card').isVisible(),true);assert.equal(await page.locator('#lesson-next').isVisible(),true);
 await page.screenshot({path:path.join(__dirname,'visible-mobile.png')});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: distinct visual markers and arrows for five stages, side-view camera, exact coordinates preserved, labelled long proposals, mobile layout.');
})();
