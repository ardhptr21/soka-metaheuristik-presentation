const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const BASE=process.env.LAB_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const kind of ['SMA','AO']){
  await page.goto(`${BASE}/visualization/?view=${kind.toLowerCase()}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.AlgorithmLab);
  const initial=await page.evaluate(()=>({scale:{...AlgorithmLab.simulation.fitnessScale},color:AlgorithmLab.scene.colorForScore(1),evaluations:AlgorithmLab.simulation.optimizers.SMA.evaluations}));
  await page.locator('#learn-button').click();assert.equal(await page.evaluate(()=>AlgorithmLab.lesson.enabled),true);
  const recorded=await page.evaluate(()=>AlgorithmLab.simulation.optimizers.SMA.evaluations);assert.equal(recorded,initial.evaluations*2);
  for(let stage=0;stage<5;stage++){
   await page.locator(`#learning-stages [data-stage="${stage}"]`).click();await page.waitForTimeout(70);
   assert.equal(await page.evaluate(()=>AlgorithmLab.lesson.step),stage);
   assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.optimizers.SMA.evaluations),recorded);
   assert.deepEqual(await page.evaluate(()=>AlgorithmLab.simulation.fitnessScale),initial.scale);
   assert.equal(await page.evaluate(()=>AlgorithmLab.scene.colorForScore(1)),initial.color);
   const data=await page.evaluate(kind=>{
    const lab=AlgorithmLab,o=lab.simulation.optimizers[kind],snapshot=lab.simulation.snapshot(kind),d=snapshot.updates[0],v=lab.scene.scenes[kind];
    const p=lab.lesson.step<4?d.before:d.after,a=lab.axes,expected=[(p[a[0]]-.5)*8,.8+p[a[1]]*6,(p[a[2]]-.5)*8];
    const before=SchedulingLab.decode(d.before,lab.config.m),proposal=SchedulingLab.decode(d.proposal,lab.config.m),after=SchedulingLab.decode(d.after,lab.config.m);
    return {expected,position:v.candidates[0].position.toArray(),ghost:v.ghost.visible,ghostPosition:v.ghost.position.toArray(),raw:d.rawProposal,proposal:d.proposal,axes:a,vmBounds:v.vmBoundaries.visible,proposed:before.filter((vm,i)=>vm!==proposal[i]).length,changed:before.filter((vm,i)=>vm!==after[i]).length};
   },kind);
   assert.ok(data.expected.every((v,i)=>Math.abs(v-data.position[i])<1e-9));assert.equal(data.vmBounds,true);
   if(stage===2||stage===3){assert.equal(data.ghost,true);const p=stage===2?data.raw:data.proposal,a=data.axes,expected=[(p[a[0]]-.5)*8,.8+p[a[1]]*6,(p[a[2]]-.5)*8];assert.ok(expected.every((v,i)=>Math.abs(v-data.ghostPosition[i])<1e-8));}
   if(stage===3)assert.equal(await page.locator('.gantt-bar.moved').count(),data.proposed);
   if(stage===4)assert.equal(await page.locator('.gantt-bar.moved').count(),data.changed);
  }
  await page.screenshot({path:path.join(__dirname,`learning-${kind.toLowerCase()}.png`),fullPage:true});
  await page.locator('#lesson-next').click();assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.cursor),2);assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.optimizers.SMA.evaluations),recorded+24);
  await page.locator('#close-lesson').click();assert.equal(await page.evaluate(()=>AlgorithmLab.lesson.enabled),false);
 }
 // A rejected AO proposal must not be shown as a committed task migration.
 await page.evaluate(()=>{while(AlgorithmLab.simulation.cursor<18)AlgorithmLab.advance();const row=AlgorithmLab.simulation.snapshot('AO').updates.find(d=>!d.accepted&&SchedulingLab.decode(d.before,3).some((vm,i)=>vm!==SchedulingLab.decode(d.proposal,3)[i]));AlgorithmLab.select('AO',row.id);});
 await page.locator('#learn-button').click();await page.locator('[data-stage="3"]').click();assert.ok(await page.locator('.gantt-bar.moved').count()>0);
 await page.locator('[data-stage="4"]').click();assert.equal(await page.locator('.gantt-bar.moved').count(),0);assert.match(await page.locator('#lesson-description').innerText(),/menolak proposal/);assert.match(await page.locator('#migration-summary').innerText(),/dibatalkan/);
 await page.locator('#close-lesson').click();await page.locator('#focus-button').click();await page.evaluate(()=>AlgorithmLab.select('AO',0));assert.equal(await page.locator('#focus-hud').isVisible(),true);
 const positions=await page.evaluate(()=>AlgorithmLab.scene.debug().positions.AO);
 await page.locator('#hud-isolate').click();await page.waitForTimeout(70);assert.equal(await page.evaluate(()=>AlgorithmLab.scene.state.isolate),true);
 assert.deepEqual(await page.evaluate(()=>AlgorithmLab.scene.debug().positions.AO),positions);
 assert.ok(await page.evaluate(()=>AlgorithmLab.scene.scenes.AO.candidates.some((object,i)=>i!==AlgorithmLab.selected.AO&&object.userData.material.opacity<.2)));
 await page.screenshot({path:path.join(__dirname,'education-focus-hud.png'),fullPage:true});
 await page.locator('#hud-close').click();assert.equal(await page.locator('#focus-hud').isVisible(),false);await page.keyboard.press('Escape');
 // Actual stacked candidates remain at their mathematical positions and can be selected from a list.
 await page.locator('[data-view="sma"]').click();await page.evaluate(()=>{while(AlgorithmLab.simulation.cursor<60)AlgorithmLab.advance();});await page.waitForTimeout(100);
 const pile=await page.evaluate(()=>{const s=AlgorithmLab.scene,v=s.viewports()[0],data=s.scenes.SMA,r=s.canvas.getBoundingClientRect();for(const obj of data.candidates){const p=obj.position.clone().project(data.camera),x=r.left+v.x+(p.x+1)/2*v.w,y=r.top+s.height-v.y-v.h+(1-p.y)/2*v.h;const hits=s.hitTestAll(x,y);if(hits.length>1)return {x,y,hits};}return null;});assert.ok(pile);
 await page.mouse.click(pile.x,pile.y);assert.equal(await page.locator('#overlap-picker').isVisible(),true);assert.ok(await page.locator('#overlap-options button').count()>1);
 const chosen=pile.hits[1].id;await page.locator(`#overlap-options [data-id="${chosen}"]`).click();assert.equal(await page.evaluate(()=>AlgorithmLab.selected.SMA),chosen);
 // Mobile learning and focused HUD remain usable without horizontal overflow.
 await page.setViewportSize({width:390,height:844});await page.goto(`${BASE}/visualization/?view=ao`,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.AlgorithmLab);
 await page.locator('#focus-button').click();await page.locator('#learn-button').click();await page.locator('[data-stage="3"]').click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('#lesson-next').isVisible(),true);
 await page.screenshot({path:path.join(__dirname,'education-mobile.png'),fullPage:true});
 // Learning also works after falling back to 2D.
 await page.locator('#close-lesson').click();await page.locator('#focus-button').click();await page.locator('#renderer-toggle').click();await page.locator('#learn-button').click();await page.locator('[data-stage="3"]').click();assert.equal(await page.evaluate(()=>AlgorithmLab.scene.use2D),true);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: five learning stages, accurate proposals, fixed shared colors, no extra evaluations, accepted/rejected VM changes, isolation without jitter, stacked picking, focused HUD, mobile and 2D learning.');
})();
