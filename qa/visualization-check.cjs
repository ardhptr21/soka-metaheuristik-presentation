const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const BASE=process.env.LAB_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[],failures=[],external=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('favicon.ico'))failures.push(response.url());});
 page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(BASE))external.push(request.url());});
 await page.goto(`${BASE}/visualization/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.AlgorithmLab);await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>AlgorithmLab.scene.debug().mode),'3d');
 assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.cursor),0);
 assert.equal(await page.evaluate(()=>JSON.stringify(AlgorithmLab.simulation.optimizers.SMA.population)===JSON.stringify(AlgorithmLab.simulation.optimizers.AO.population)),true);
 // Verify actual rendered positions against the full recorded coordinates.
 async function checkProjection(){await page.waitForTimeout(100);const mismatch=await page.evaluate(()=>{
   const lab=AlgorithmLab,debug=lab.scene.debug();if(debug.mode!=='3d')return 'not 3d';
   for(const kind of lab.view==='compare'?['SMA','AO']:[lab.view==='ao'?'AO':'SMA']){
     const snapshot=lab.simulation.snapshot(kind);for(const candidate of snapshot.population){const p=candidate.position,a=lab.axes,expected=[(p[a[0]]-.5)*8,.8+p[a[1]]*6,(p[a[2]]-.5)*8];if(expected.some((v,i)=>Math.abs(v-debug.positions[kind][candidate.id][i])>1e-8))return `${kind}:${candidate.id}`;}
   }return null;
 });assert.equal(mismatch,null);}
 await checkProjection();
 const cameraInitial=await page.evaluate(()=>AlgorithmLab.scene.camera.position.toArray());
 const canvasBounds=await page.locator('.scene-host canvas').boundingBox();
 await page.mouse.move(canvasBounds.x+canvasBounds.width*.5,canvasBounds.y+canvasBounds.height*.4);await page.mouse.down();await page.mouse.move(canvasBounds.x+canvasBounds.width*.6,canvasBounds.y+canvasBounds.height*.5,{steps:8});await page.mouse.up();await page.waitForTimeout(200);
 assert.notDeepEqual(await page.evaluate(()=>AlgorithmLab.scene.camera.position.toArray()),cameraInitial);
 await page.locator('#reset-camera').click();await page.waitForTimeout(80);
 const cameraReset=await page.evaluate(()=>AlgorithmLab.scene.camera.position.toArray());assert.ok(cameraReset.every((v,i)=>Math.abs(v-cameraInitial[i])<1e-6));
 // Select a visible object via the renderer's projected screen position and real pointer events.
 const pick=await page.evaluate(()=>{
   const scene=AlgorithmLab.scene,v=scene.viewports()[0],view=scene.scenes[v.kind],rect=scene.canvas.getBoundingClientRect();
   for(const obj of view.candidates){const p=obj.position.clone().project(view.camera),x=rect.left+v.x+(p.x+1)/2*v.w,y=rect.top+scene.height-v.y-v.h+(1-p.y)/2*v.h,hit=scene.hitTest(x,y);if(hit&&hit.id!==0)return {x,y,...hit};}return null;
 });assert.ok(pick);await page.mouse.click(pick.x,pick.y);if(await page.locator('#overlap-picker').isVisible())await page.locator(`#overlap-options [data-id="${pick.id}"]`).click();assert.equal(await page.evaluate(kind=>AlgorithmLab.selected[kind],pick.kind),pick.id);
 await page.locator('#axis-x').selectOption('3');await checkProjection();assert.deepEqual(await page.evaluate(()=>AlgorithmLab.axes),[3,1,2]);
 await page.evaluate(()=>{for(let i=0;i<45;i++)AlgorithmLab.advance();});await checkProjection();
 await page.locator('[data-view="compare"]').click();await checkProjection();
 assert.equal(await page.locator('.phase-pill').last().innerText(),'EKSPLOITASI');
 assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.optimizers.SMA.evaluations===AlgorithmLab.simulation.optimizers.AO.evaluations),true);
 assert.equal(await page.evaluate(()=>AlgorithmLab.scene.scenes.SMA.camera.position.equals(AlgorithmLab.scene.scenes.AO.camera.position)),true);
 const evaluations=await page.evaluate(()=>AlgorithmLab.simulation.optimizers.SMA.evaluations);
 await page.locator('#timeline').fill('10');await page.locator('#timeline').dispatchEvent('input');
 assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.cursor),10);assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.optimizers.SMA.evaluations),evaluations);
 await page.locator('#step-button').click();assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.cursor),11);assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.optimizers.SMA.evaluations),evaluations);
 await page.evaluate(()=>{AlgorithmLab.seek(18);const rejected=AlgorithmLab.simulation.snapshot('AO').updates.find(row=>!row.accepted);AlgorithmLab.select('AO',rejected.id);});
 assert.equal(await page.locator('#update-status').innerText(),'Ditolak');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>AlgorithmLab.scene.scenes.AO.ghost.visible),true);
 await page.locator('#show-proposals').uncheck();await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>AlgorithmLab.scene.scenes.AO.ghost.visible),false);await page.locator('#show-proposals').check();
 await page.screenshot({path:path.join(__dirname,'visualization-compare-checked.png'),fullPage:true});
 // Maximum supported workload, separate seeds, URL persistence, and full restart.
 await page.locator('[name="n"]').selectOption('24');await page.locator('[name="m"]').selectOption('4');await page.locator('[name="population"]').selectOption('40');await page.locator('[name="iterations"]').selectOption('120');await page.locator('[name="seed"]').fill('1034');await page.locator('[name="workloadSeed"]').fill('58');await page.locator('[name="weight"]').fill('80');await page.locator('[name="mode"]').selectOption('berat');
 assert.equal(await page.locator('#step-button').isDisabled(),true);
 await page.locator('.apply-button').click();assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.cursor),0);assert.equal(await page.evaluate(()=>AlgorithmLab.config.weight),.8);assert.match(page.url(),/workloadSeed=58/);
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>AlgorithmLab.config.seed),1034);assert.equal(await page.locator('[name="n"]').inputValue(),'24');
 await page.locator('#speed').selectOption('4');await page.locator('#play-button').click();await page.waitForTimeout(650);await page.locator('#play-button').click();const cursor=await page.evaluate(()=>AlgorithmLab.simulation.cursor);assert.ok(cursor>=2);assert.equal(await page.evaluate(()=>AlgorithmLab.playing),false);
 await page.evaluate(()=>{while(AlgorithmLab.simulation.cursor<AlgorithmLab.config.iterations)AlgorithmLab.advance();});assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.optimizers.SMA.evaluations),4840);await checkProjection();
 await page.locator('#restart-button').click();assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.cursor),0);
 // Return to the right slide; presentation passes active parameters into the laboratory.
 await page.goto(`${BASE}/#14`,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof Presentation?.go==='function');await page.locator('#sma-n').selectOption('18');await page.locator('.lab[data-algorithm="SMA"] [data-action="apply"]').click();await page.locator('.slide.active [data-visualization]').click();await page.waitForFunction(()=>!!window.AlgorithmLab);
 assert.equal(await page.evaluate(()=>AlgorithmLab.config.n),18);assert.equal(await page.evaluate(()=>AlgorithmLab.view),'sma');assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.cursor),0);assert.match(await page.locator('#return-link').getAttribute('href'),/#14/);
 await page.locator('#return-link').click();await page.waitForFunction(()=>typeof Presentation?.go==='function');assert.equal(await page.evaluate(()=>Presentation.current),13);assert.equal(await page.locator('.slide').count(),28);
 // Mobile drawers, no horizontal overflow, stacked comparison.
 await page.setViewportSize({width:390,height:844});await page.goto(`${BASE}/visualization/?view=compare`,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.AlgorithmLab);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#settings-button').click();await page.locator('[name="n"]').selectOption('6');await page.locator('.apply-button').click();assert.equal(await page.evaluate(()=>AlgorithmLab.config.n),6);
 await page.locator('#inspector-button').click();await page.locator('#candidate-select').selectOption('3');await page.locator('.close-inspector').click();
 const vp=await page.evaluate(()=>AlgorithmLab.scene.viewports());assert.equal(vp[0].x,vp[1].x);assert.notEqual(vp[0].y,vp[1].y);
 await page.screenshot({path:path.join(__dirname,'visualization-mobile.png'),fullPage:true});
 // Lost graphics context switches the existing simulation to a working 2D projection.
 await page.evaluate(()=>{const event=new Event('webglcontextlost',{cancelable:true});AlgorithmLab.scene.canvas.dispatchEvent(event);});await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>AlgorithmLab.scene.use2D),true);
 await page.locator('#step-button').click();assert.equal(await page.evaluate(()=>AlgorithmLab.simulation.cursor),1);
 // Browsers without WebGL2 also initialize successfully.
 const fallbackPage=await context.newPage();await fallbackPage.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};});
 await fallbackPage.goto(`${BASE}/visualization/?view=ao`,{waitUntil:'networkidle'});await fallbackPage.waitForFunction(()=>!!window.AlgorithmLab);assert.equal(await fallbackPage.evaluate(()=>AlgorithmLab.scene.use2D),true);await fallbackPage.locator('#step-button').click();assert.equal(await fallbackPage.evaluate(()=>AlgorithmLab.simulation.cursor),1);
 await fallbackPage.screenshot({path:path.join(__dirname,'visualization-fallback.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);assert.deepEqual(external,[]);
 fs.writeFileSync(path.join(__dirname,'visualization-report.json'),JSON.stringify({base:BASE,errors,failures,external,passed:['actual 3D positions','raycast selection','SMA/AO/compare','axes','rejected proposals','history without reevaluation','paired budgets','maximum configuration','URL roundtrip','playback','presentation navigation','mobile drawers','context loss','2D fallback']},null,2));
 await browser.close();console.log('PASS: 3D data, selection, controls, histories, fair comparison, URLs, navigation, maximum parameters, mobile and 2D fallback.');
})();
