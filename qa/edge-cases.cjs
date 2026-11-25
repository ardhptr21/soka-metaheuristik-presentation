const {chromium}=require('playwright');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const p=await b.newPage({viewport:{width:1600,height:900},reducedMotion:'reduce'});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('file:///'+path.resolve(__dirname,'../presentasi-task-scheduling.html').replaceAll('\\','/'));
  await p.waitForFunction(()=>typeof Presentation.go==='function');
  await p.evaluate(()=>Presentation.go(16));
  for(let i=0;i<4;i++){await p.locator(`#ao-strategies [data-strategy="${i}"]`).click();assert.match(await p.locator('#ao-strategy-detail').innerText(),new RegExp(['X₁','X₂','X₃','X₄'][i]));}
  await p.evaluate(()=>Presentation.go(8));
  await p.locator('#encoding-0').fill('1');await p.locator('#encoding-0').dispatchEvent('input');assert.match(await p.locator('#encoding-label-0').innerText(),/VM 3/);
  await p.evaluate(()=>Presentation.go(9));await p.locator('#objective-weight').fill('0');await p.locator('#objective-weight').dispatchEvent('input');assert.match(await p.locator('#objective-message').innerText(),/Semua ke VM 1/);
  await p.evaluate(()=>Presentation.go(20));
  await p.locator('#battle-n').selectOption('24');await p.locator('#battle-m').selectOption('4');await p.locator('#battle-population').selectOption('40');await p.locator('#battle-iterations').selectOption('120');await p.locator('#battle-weight').fill('100');await p.locator('#battle-mode').selectOption('berat');
  await p.locator('#battle-controls [data-action="apply"]').click();await p.locator('#battle-controls [data-action="finish"]').click();
  assert.equal(await p.evaluate(()=>Presentation.battle.sma.evaluations),4840);
  const bounds=await p.evaluate(()=>({table:document.querySelector('#battle-table').getBoundingClientRect().bottom,foot:document.querySelector('.slide.active .footnote').getBoundingClientRect().top,gantt:document.querySelector('#battle-gantt').getBoundingClientRect().bottom}));
  assert.ok(bounds.table<bounds.foot);assert.ok(bounds.gantt<bounds.foot);
  await p.screenshot({path:path.join(__dirname,'battle-max.png')});
  await p.locator('#battle-controls [data-action="reset"]').click();await p.locator('#battle-controls [data-action="play"]').click();await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>Presentation.battle.sma.iteration)>0);await p.keyboard.press('ArrowRight');assert.equal(await p.evaluate(()=>Presentation.battle.timer),null);
  await p.locator('#batch-run').click();await p.evaluate(()=>Presentation.go(20));await p.locator('#battle-weight').fill('20');await p.locator('#battle-controls [data-action="apply"]').click();await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>Presentation.batchRows.length),0);
  await p.locator('#help-button').click();await p.locator('#reading-button').click();assert.equal(await p.locator('body').evaluate(e=>e.classList.contains('reading')),true);
  await p.locator('#help-button').click();await p.locator('#reading-button').click();
  await p.emulateMedia({media:'print'});assert.equal(await p.locator('.slide').evaluateAll(slides=>slides.filter(s=>getComputedStyle(s).display!=='none').length),28);
  assert.deepEqual(errors,[]);await b.close();console.log('PASS: AO strategy tabs, slider endpoints, maximum configuration, equal budgets, play/pause on navigation, batch cancellation, reading and print modes.');
})();
