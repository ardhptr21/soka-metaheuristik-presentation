'use strict';
const E = SchedulingLab;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const fmt = (n, digits = 2) => Number(n).toLocaleString('id-ID', {minimumFractionDigits: digits, maximumFractionDigits: digits});
const colors = ['#b9a6ff', '#b6e89d', '#ffb88c', '#8dcad7', '#e8b0cb', '#d6d5a1', '#b2c6ef', '#d8b68a', '#a4d0c1', '#d4abeb', '#e2c6b1', '#a8b5d8'];
const slides = $$('.slide');
let current = 0;
let reading = false;
const controllers = [];

function resize() {
  if (reading) return;
  const scale = Math.min(innerWidth / 1600, innerHeight / 900);
  $('#stage').style.transform = `translate(-50%,-50%) scale(${scale})`;
}
addEventListener('resize', resize);
function go(index, updateHash = true) {
  index = Math.max(0, Math.min(slides.length - 1, Math.trunc(Number(index) || 0)));
  controllers.forEach(c => c.pause());
  slides[current].classList.remove('active');
  slides[current].setAttribute('aria-hidden', 'true');
  current = index;
  slides[current].classList.add('active');
  slides[current].removeAttribute('aria-hidden');
  $('#chapter').textContent = slides[current].dataset.chapter;
  $('#slide-counter').textContent = `${String(current + 1).padStart(2, '0')} / ${slides.length}`;
  $('#progress-fill').style.width = `${(current + 1) / slides.length * 100}%`;
  $('#prev').disabled = current === 0;
  $('#next').disabled = current === slides.length - 1;
  $$('#progress-dots button').forEach((b, i) => { b.classList.toggle('current', i === current); b.classList.toggle('visited', i < current); if(i === current) b.setAttribute('aria-current','step'); else b.removeAttribute('aria-current'); });
  $$('#overview-grid button').forEach((b, i) => b.classList.toggle('selected', i === current));
  $('#announcer').textContent = `Slide ${current + 1}: ${slides[current].dataset.title}`;
  if (updateHash) history.replaceState(null, '', `#${current + 1}`);
  renderNote();
  if (reading) slides[current].scrollIntoView({behavior: 'smooth'});
}
slides.forEach((s, i) => {
  const button = document.createElement('button');
  button.title = `${i + 1}. ${s.dataset.title}`;
  button.setAttribute('aria-label', button.title);
  button.addEventListener('click', () => go(i));
  $('#progress-dots').append(button);
  const overviewButton = document.createElement('button');
  overviewButton.innerHTML = `<span>${String(i + 1).padStart(2, '0')} / ${s.dataset.chapter}</span>${s.dataset.title}`;
  overviewButton.addEventListener('click', () => { $('#overview').close(); go(i); });
  $('#overview-grid').append(overviewButton);
});
$$('[data-go]').forEach(b => b.addEventListener('click', () => go(Number(b.dataset.go) - 1)));
$('#next').onclick = () => go(current + 1);
$('#prev').onclick = () => go(current - 1);
function toggleDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog.open) dialog.close(); else { controllers.forEach(c => c.pause()); dialog.showModal(); }
}
$('#overview-button').onclick = () => toggleDialog('overview');
$('#notes-button').onclick = () => toggleDialog('notes');
$('#help-button').onclick = () => toggleDialog('help');
$$('[data-close]').forEach(b => b.onclick = () => document.getElementById(b.dataset.close).close());
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } }));
async function fullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { $('#fullscreen-button').title = 'Layar penuh tidak tersedia. Gunakan F11 pada browser.'; }
}
$('#fullscreen-button').onclick = fullscreen;
$('#reading-button').onclick = () => { reading = !reading; document.body.classList.toggle('reading', reading); slides.forEach(s => s.removeAttribute('aria-hidden')); $('#help').close(); if(!reading) {go(current); resize();} };
$('#print-button').onclick = () => { $('#help').close(); controllers.forEach(c=>c.pause()); window.print(); };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#blackout').hidden = true; return; }
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || (e.target.closest('button,a') && e.key===' ') || e.ctrlKey || e.metaKey || e.altKey) return;
  if ($('dialog[open]')) return;
  const key = e.key.toLowerCase();
  if (['arrowright', 'pagedown', ' '].includes(key)) { e.preventDefault(); go(current + 1); }
  if (['arrowleft', 'pageup'].includes(key)) { e.preventDefault(); go(current - 1); }
  if (key === 'home') { e.preventDefault(); go(0); }
  if (key === 'end') { e.preventDefault(); go(slides.length - 1); }
  if (key === 'o') toggleDialog('overview');
  if (key === 'n') toggleDialog('notes');
  if (key === 'f') fullscreen();
  if (key === 'b') { controllers.forEach(c => c.pause()); $('#blackout').hidden = !$('#blackout').hidden; }
  if (key === '?') toggleDialog('help');
});
let touch = null;
$('#slides').addEventListener('touchstart', e => { if (!e.target.closest('input,select,button,a,.lab')) touch = {x:e.touches[0].clientX, y:e.touches[0].clientY}; },{passive:true});
$('#slides').addEventListener('touchend', e => { if(!touch) return; const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y; if(Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*1.5) go(current + (dx<0?1:-1)); touch=null; },{passive:true});

function gantt(target, result, vms, maxTime) {
  const axisMax = maxTime || result.makespan;
  target.innerHTML = `<div class="gantt" role="img" aria-label="Gantt chart. Makespan ${fmt(result.makespan)} detik. ${result.bars.map(b=>`T${b.task} pada VM ${b.vm+1}, mulai ${fmt(b.start)}, selesai ${fmt(b.end)}`).join('. ')}">${vms.map((vm,j)=>{
    const bars = result.bars.filter(b=>b.vm===j);
    return `<div class="gantt-row"><span class="gantt-name">${vm.name}</span><div class="gantt-track">${bars.map(b=>`<span class="gantt-bar" style="left:${b.start/axisMax*100}%;width:${b.duration/axisMax*100}%;background:${colors[(b.task-1)%colors.length]}" title="T${b.task}: ${fmt(b.start)}–${fmt(b.end)} detik, durasi ${fmt(b.duration)} detik">${b.duration/axisMax>0.035?'T'+b.task:''}</span>`).join('')}${bars.length?'':'<span class="gantt-empty">menganggur</span>'}</div></div>`;
  }).join('')}<div class="gantt-axis">${[0,.25,.5,.75,1].map(f=>`<span>${fmt(axisMax*f,1)}${f===1?' d':''}</span>`).join('')}</div></div>`;
}
function metrics(target, result, score) {
  target.innerHTML = `<div class="metric"><span>MAKESPAN</span><strong>${fmt(result.makespan)}</strong><small>d</small></div><div class="metric"><span>BIAYA</span><strong>${fmt(result.cost,3)}</strong><small>UB</small></div><div class="metric"><span>${score===undefined?'UTILISASI RERATA':'FITNESS ↓'}</span><strong>${score===undefined?fmt(result.utilization*100,1)+'%':fmt(score,4)}</strong></div>`;
}
function lineChart(target, series, maxT, height=220) {
  const width=650, left=56, right=18, top=17, bottom=40, pw=width-left-right,ph=height-top-bottom;
  const vals=series.flatMap(s=>s.values.map(v=>v.score));
  const min=Math.min(...vals),max=Math.max(1,...vals),pad=Math.max(.025,(max-min)*.12);
  const lo=Math.max(0,min-pad), hi=max+pad;
  const y=v=>top+ph-(v-lo)/(hi-lo)*ph;
  let content='';
  for(let i=0;i<4;i++){const value=lo+(hi-lo)*i/3,yp=y(value);content+=`<line x1="${left}" x2="${width-right}" y1="${yp}" y2="${yp}" stroke="#343645"/><text x="${left-9}" y="${yp+5}" text-anchor="end">${fmt(value,2)}</text>`;}
  [0,.25,.5,.75,1].forEach(f=>{content+=`<text x="${left+pw*f}" y="${height-15}" text-anchor="middle">${Math.round(maxT*f)}</text>`;});
  content+=`<text x="${width-right}" y="${height-1}" text-anchor="end" class="chart-label">iterasi</text>`;
  const one=y(1); if(one>=top && one<=top+ph)content+=`<line x1="${left}" x2="${width-right}" y1="${one}" y2="${one}" stroke="#8f91a0" stroke-dasharray="3 6"/><text x="${width-right}" y="${one-7}" text-anchor="end" class="chart-label">RR = 1</text>`;
  series.forEach(s=>{const points=s.values.map((v,i)=>`${left+pw*i/maxT},${y(v.score)}`).join(' ');const last=s.values.at(-1);content+=`<polyline points="${points}" fill="none" stroke="${s.color}" stroke-width="3" ${s.dashed?'stroke-dasharray="8 5"':''}/><circle cx="${left+pw*(s.values.length-1)/maxT}" cy="${y(last.score)}" r="4" fill="${s.color}"/>`;});
  target.innerHTML=`<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Kurva fitness terbaik per iterasi. ${series.map(s=>`${s.name}: awal ${fmt(s.values[0].score,4)}, akhir ${fmt(s.values.at(-1).score,4)}`).join('. ')}">${content}</svg>`;
}
const introTasks=E.workload(12,42),introVms=E.machines.slice(0,3),introRR=E.roundRobin(introTasks,introVms),introEFT=E.eft(introTasks,introVms);
gantt($('#hero-gantt'),introEFT,introVms);$('#hero-makespan').textContent=fmt(introEFT.makespan,1);
function introPreset(type){const r=type==='one'?E.evaluate(introTasks.map(()=>0),introTasks,introVms):type==='rr'?introRR:introEFT;gantt($('#intro-gantt'),r,introVms);metrics($('#intro-metrics'),r);$$('#intro-presets button').forEach(b=>b.classList.toggle('selected',b.dataset.preset===type));}
$$('#intro-presets button').forEach(b=>b.onclick=()=>introPreset(b.dataset.preset));introPreset('one');
const workedTasks=[4000,6000,8000,3000,9000,5000].map((length,i)=>({id:i+1,length}));
const worked=E.roundRobin(workedTasks,introVms);
$('#worked-table').innerHTML=workedTasks.map((t,i)=>`<tr><td>T${t.id}</td><td>${fmt(t.length,0)}</td><td>VM ${i%3+1}</td><td>${fmt(worked.bars[i].duration)}</td></tr>`).join('');
gantt($('#worked-gantt'),worked,introVms);metrics($('#worked-metrics'),worked);
function searchSize(){const n=Number($('#space-n').value);$('#space-n-out').textContent=n;$('#search-size').textContent=n<=18?fmt(3**n,0):`${fmt(3**n/10**Math.floor(Math.log10(3**n)),2)} × 10${String(Math.floor(Math.log10(3**n))).split('').map(v=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[v]).join('')}`;}
$('#space-n').oninput=searchSize;searchSize();
const processText=[
  'Populasi berisi N alternatif penempatan. Semua kandidat menggunakan model dan fungsi objektif yang sama.',
  'Decoder menghasilkan penempatan VM. Evaluator menghitung durasi, beban VM, makespan, biaya, dan fitness.',
  'Setiap algoritma mengubah vektor kontinu dengan aturan berbeda. Posisi di luar batas dipotong sebelum evaluasi.',
  'Simpan solusi terbaik yang pernah ditemukan. Hentikan setelah T iterasi, lalu kembalikan jadwal dari arsip tersebut.'
];
function processStep(i){$$('#meta-process button').forEach((b,j)=>b.classList.toggle('selected',i===j));$('#process-explanation').textContent=processText[i];}
$$('#meta-process button').forEach(b=>b.onclick=()=>processStep(Number(b.dataset.step)));processStep(0);
let encoding=[.12,.45,.82,.23,.54,.91];
$('#encoding-sliders').innerHTML=encoding.map((x,i)=>`<div class="encoding-row"><label for="encoding-${i}">T${i+1}</label><input id="encoding-${i}" aria-label="Posisi kontinu tugas ${i+1}" type="range" min="0" max="1" step="0.01" value="${x}"><span id="encoding-label-${i}"></span></div>`).join('');
function updateEncoding(){const assignment=E.decode(encoding,3);encoding.forEach((x,i)=>{$(`#encoding-label-${i}`).textContent=`${fmt(x)} / VM ${assignment[i]+1}`;});const r=E.evaluate(assignment,workedTasks,introVms);gantt($('#encoding-gantt'),r,introVms);metrics($('#encoding-metrics'),r);}
encoding.forEach((_,i)=>{$(`#encoding-${i}`).oninput=e=>{encoding[i]=Number(e.target.value);updateEncoding();};});updateEncoding();
function updateObjective(){const w=Number($('#objective-weight').value)/100;$('#objective-weight-out').textContent=`${fmt(w*100,0)}%`;const candidates=[['Round Robin',introRR],['EFT',introEFT],['Semua ke VM 1',E.evaluate(introTasks.map(()=>0),introTasks,introVms)],['Semua ke VM 3',E.evaluate(introTasks.map(()=>2),introTasks,introVms)]];const scores=candidates.map(([,r])=>E.objective(r,introRR,w)),best=scores.indexOf(Math.min(...scores));$('#objective-table').innerHTML=candidates.map(([name,r],i)=>`<tr class="${i===best?'highlight':''}"><td>${name}</td><td>${fmt(r.makespan)}</td><td>${fmt(r.cost,3)}</td><td>${fmt(scores[i],3)}</td></tr>`).join('');$('#objective-message').textContent=`Terbaik di antara empat kandidat: ${candidates[best][0]}. Bobot biaya ${fmt((1-w)*100,0)}%. Ini belum tentu optimum global.`;}
$('#objective-weight').oninput=updateObjective;updateObjective();
const strategies=[
  {title:'X₁ / Eksplorasi diperluas',formula:'X₁ = X<sub>b</sub>(1 − t/T) + (X̄ − X<sub>b</sub> · r)',text:'Memakai posisi terbaik dan rata-rata populasi. Faktor (1 − t/T) berubah mengikuti kemajuan iterasi.',detail:'Pada t ≤ ⅔ T, algoritma memilih X₁ atau X₂ dengan peluang 50:50.'},
  {title:'X₂ / Eksplorasi dipersempit',formula:'X₂ = X<sub>b</sub> · L + X<sub>R</sub> + (y − x) · r',text:'Memadukan individu acak, langkah Lévy, dan pola spiral. Lompatan dapat keluar dari wilayah yang sedang dijelajahi.',detail:'x = ρ sin θ, y = ρ cos θ. ρ = r₁ + 0,00565 d dan θ = −0,005 d + 3π/2. Demo memakai r₁ integer 1…20.'},
  {title:'X₃ / Eksploitasi diperluas',formula:'X₃ = α(X<sub>b</sub> − X̄) − r<br>+ δ[LB + r · (UB − LB)]',text:'Memakai selisih solusi terbaik terhadap rata-rata populasi serta koefisien α dan δ.',detail:'α = δ = 0,1. Pada t > ⅔ T, algoritma memilih X₃ atau X₄ dengan peluang 50:50.'},
  {title:'X₄ / Eksploitasi dipersempit',formula:'X₄ = QF · X<sub>b</sub> − G₁ · Xᵢ · r<br>− G₂ · L + r · G₁',text:'Menggabungkan kualitas pencarian, posisi individu, dan langkah Lévy untuk membentuk proposal baru.',detail:'G₁ = 2r − 1, G₂ = 2(1 − t/T), QF = t^[(2r − 1)/(1 − T)²]. Setiap r melambangkan sampel acak U(0, 1).'}
];
function showStrategy(i){const s=strategies[i];$$('#ao-strategies button').forEach((b,j)=>b.classList.toggle('selected',i===j));$('#ao-strategy-detail').innerHTML=`<h3>${s.title}</h3><div class="formula">${s.formula}</div><p>${s.text}</p><p class="caption">${s.detail}</p>`;}
$$('#ao-strategies button').forEach(b=>b.onclick=()=>showStrategy(Number(b.dataset.strategy)));showStrategy(0);
function aoTime(){const t=Number($('#ao-time').value);$('#ao-time-out').textContent=`${t} / 60`;$('#phase-marker').style.left=`${t/60*100}%`;$('#g2-value').textContent=fmt(2*(1-t/60));$('#phase-explanation').textContent=t<=40?`Iterasi ${t}: fase eksplorasi. Setiap individu memilih X₁ atau X₂.`:`Iterasi ${t}: fase eksploitasi. Setiap individu memilih X₃ atau X₄.`;}
$('#ao-time').oninput=aoTime;aoTime();

function controlMarkup(prefix){return `<div class="control-bar">
  <div class="control-field"><label for="${prefix}-n">Tugas (D)</label><select id="${prefix}-n" name="n"><option>6</option><option selected>12</option><option>18</option><option>24</option></select></div>
  <div class="control-field"><label for="${prefix}-m">Jumlah VM</label><select id="${prefix}-m" name="m"><option>2</option><option selected>3</option><option>4</option></select></div>
  <div class="control-field"><label for="${prefix}-population">Populasi (N)</label><select id="${prefix}-population" name="population"><option>12</option><option selected>24</option><option>40</option></select></div>
  <div class="control-field"><label for="${prefix}-iterations">Iterasi (T)</label><select id="${prefix}-iterations" name="iterations"><option>30</option><option selected>60</option><option>120</option></select></div>
  <div class="control-field"><label for="${prefix}-seed">Seed</label><input id="${prefix}-seed" name="seed" type="number" min="0" max="2147483647" step="1" value="42" required></div>
  <div class="control-field"><label for="${prefix}-weight">Bobot waktu (%)</label><input id="${prefix}-weight" name="weight" type="number" min="0" max="100" step="1" value="60" required></div>
  <div class="control-field"><label for="${prefix}-mode">Workload</label><select id="${prefix}-mode" name="mode"><option value="campuran">Campuran</option><option value="seragam">Seragam</option><option value="berat">Ada tugas berat</option></select></div><button data-action="apply">Terapkan</button></div>`;}
function readOptions(root){const fields=$$('input,select',root);if(!fields.every(f=>f.reportValidity()))return null;const options={};fields.forEach(f=>{options[f.name]=f.name==='mode'?f.value:Number(f.value);});options.weight/=100;return options;}
function actionMarkup(){return `<div class="lab-actions"><button data-action="step">+1 iterasi</button><button data-action="play" class="primary">Putar</button><button data-action="finish">Selesaikan</button><button data-action="reset">Ulangi seed</button><span class="lab-status" role="status"></span></div>`;}
class LabController {
  constructor(root, algorithm){
    this.root=root;this.algorithm=algorithm;this.timer=null;
    root.innerHTML=controlMarkup(algorithm.toLowerCase())+actionMarkup()+`<div class="lab-body"><div><div class="figure-label">JADWAL TERBAIK SAAT INI</div><div class="lab-gantt"></div><div class="lab-metrics metrics"></div></div><div><div class="figure-label">KURVA FITNESS TERBAIK ↓</div><div class="lab-chart"></div><div class="branch-summary"></div></div></div><p class="lab-explanation"></p><p class="lab-hint">Grafik menyimpan best-so-far. Gantt menggambar solusi arsip, bukan seluruh populasi. Arah lebih baik: f lebih kecil.</p>`;
    $$('[data-action]',root).forEach(b=>b.onclick=()=>this.action(b.dataset.action));
    $$('input,select',root).forEach(f=>f.addEventListener('input',()=>{this.pause();$('.lab-status',root).textContent='Parameter berubah. Klik Terapkan.';}));
    this.apply();controllers.push(this);
  }
  apply(){const options=readOptions($('.control-bar',this.root));if(!options)return;this.pause();this.optimizer=new E.Optimizer(this.algorithm,options);this.draw();}
  pause(){if(this.timer){clearInterval(this.timer);this.timer=null;}const b=$('[data-action="play"]',this.root);if(b)b.textContent='Putar';}
  action(action){
    if(action==='apply'){this.apply();return;}
    if(action==='reset'){this.pause();this.optimizer=new E.Optimizer(this.algorithm,this.optimizer.options);this.draw();return;}
    if(action==='play'){if(this.timer){this.pause();return;}if(this.optimizer.iteration===this.optimizer.options.iterations)this.optimizer=new E.Optimizer(this.algorithm,this.optimizer.options);$('[data-action="play"]',this.root).textContent='Jeda';this.timer=setInterval(()=>{this.optimizer.step();this.draw();if(this.optimizer.iteration===this.optimizer.options.iterations)this.pause();},140);return;}
    this.pause();if(action==='step')this.optimizer.step();if(action==='finish')this.optimizer.finish();this.draw();
  }
  draw(){
    const o=this.optimizer,r=o.trace.at(-1),finished=o.iteration===o.options.iterations;
    gantt($('.lab-gantt',this.root),r,o.vms);metrics($('.lab-metrics',this.root),r,r.score);
    lineChart($('.lab-chart',this.root),[{name:this.algorithm,color:this.algorithm==='SMA'?'#b6e89d':'#ffb88c',values:o.trace}],o.options.iterations,205);
    $('[data-action="step"]',this.root).disabled=finished;$('[data-action="finish"]',this.root).disabled=finished;
    $('.lab-status',this.root).textContent=`Iterasi ${o.iteration}/${o.options.iterations} · ${o.evaluations} evaluasi · ${r.diversity}/${o.options.population} jadwal unik`;
    $('.branch-summary',this.root).innerHTML=Object.entries(r.branches).map(([k,v])=>`<span>${k}: <b>${v}</b></span>`).join('');
    const delta=(1-r.score)*100;
    $('.lab-explanation',this.root).textContent=o.iteration===0?`Populasi awal acak, seed ${o.options.seed}. Nilai f Round Robin = 1. Klik +1 iterasi untuk mulai. ${this.algorithm==='SMA'?'Penghitung acak memakai jumlah individu, mendekat/kontraksi memakai jumlah dimensi.':'Penghitung X₁–X₄ memakai jumlah individu.'}`:`${this.algorithm==='SMA'?`Iterasi ini: ${r.parameters.clamped} koordinat di-clip. Amplitudo a = ${fmt(r.parameters.a,3)}, b = ${fmt(r.parameters.b,3)}. `:`Fase ${o.iteration/o.options.iterations<=2/3?'eksplorasi':'eksploitasi'}. ${r.parameters.accepted}/${o.options.population} proposal diterima, ${r.parameters.clamped} koordinat di-clip. `}Fitness arsip ${delta>=0?`${fmt(delta,1)}% lebih rendah`:`${fmt(-delta,1)}% lebih tinggi`} dari RR menurut objektif berbobot.`;
  }
}
$$('.lab').forEach(root=>new LabController(root,root.dataset.algorithm));
class BattleController {
  constructor(){this.root=$('#battle-controls');this.timer=null;this.view='SMA';this.root.innerHTML=controlMarkup('battle')+actionMarkup();$$('[data-action]',this.root).forEach(b=>b.onclick=()=>this.action(b.dataset.action));$$('input,select',this.root).forEach(f=>f.addEventListener('input',()=>{this.pause();$('.lab-status',this.root).textContent='Parameter berubah. Klik Terapkan.';}));$$('#battle-view button').forEach(b=>b.onclick=()=>{this.view=b.dataset.view;$$('#battle-view button').forEach(el=>el.classList.toggle('selected',el===b));this.draw();});this.apply();controllers.push(this);}
  pause(){if(this.timer){clearInterval(this.timer);this.timer=null;}if(this.root)$('[data-action="play"]',this.root).textContent='Putar';}
  apply(){const options=readOptions($('.control-bar',this.root));if(!options)return;this.options=options;this.reset();resetBatch();}
  reset(){this.pause();this.sma=new E.Optimizer('SMA',this.options);this.ao=new E.Optimizer('AO',this.options);this.draw();}
  action(a){if(a==='apply'){this.apply();return;}if(a==='reset'){this.reset();return;}if(a==='play'){if(this.timer){this.pause();return;}if(this.sma.iteration===this.options.iterations)this.reset();$('[data-action="play"]',this.root).textContent='Jeda';this.timer=setInterval(()=>{this.sma.step();this.ao.step();this.draw();if(this.sma.iteration===this.options.iterations)this.pause();},120);return;}this.pause();if(a==='step'){this.sma.step();this.ao.step();}if(a==='finish'){this.sma.finish();this.ao.finish();}this.draw();}
  draw(){const a=this.sma.trace.at(-1),b=this.ao.trace.at(-1),o=this.sma;lineChart($('#battle-chart'),[{name:'SMA',color:'#b6e89d',values:this.sma.trace},{name:'AO',color:'#ffb88c',dashed:true,values:this.ao.trace}],this.options.iterations,155);const methods=[['Round Robin',o.baseline,1],['EFT',o.greedy,E.objective(o.greedy,o.baseline,this.options.weight)],['SMA',a,a.score],['AO',b,b.score]];$('#battle-table').innerHTML=methods.map(([name,r,f])=>`<tr><td class="${name==='SMA'?'sma-text':name==='AO'?'ao-text':''}">${name}</td><td>${fmt(f,4)}</td><td>${fmt(r.makespan)}</td><td>${fmt(r.cost,3)}</td></tr>`).join('');gantt($('#battle-gantt'),this.view==='SMA'?a:b,o.vms);const d=a.score-b.score;$('#battle-insight').textContent=o.iteration===0?'SMA dan AO memulai dari solusi terbaik yang identik. Kurva dapat saling menutupi pada awal pencarian.':Math.abs(d)<1e-10?'Fitness SMA dan AO sama pada titik ini. Jadwalnya tetap dapat berbeda.':`${d<0?'SMA':'AO'} memiliki fitness lebih rendah pada iterasi ini. Selisih absolut f = ${fmt(Math.abs(d),4)}. Ulangi beberapa seed sebelum menarik kesimpulan.`;$('.lab-status',this.root).textContent=`Iterasi ${o.iteration}/${this.options.iterations} · ${o.evaluations} evaluasi per algoritma`;$('#battle-status').textContent=`Aktif: ${this.options.n} tugas / ${this.options.m} VM / N=${this.options.population} / T=${this.options.iterations} / seed=${this.options.seed} / w=${fmt(this.options.weight)} / ${this.options.mode}`;const finished=o.iteration===this.options.iterations;$('[data-action="step"]',this.root).disabled=finished;$('[data-action="finish"]',this.root).disabled=finished;}
}
let batchRows=[];
let batchBusy=false;
let batchGeneration=0;
function resetBatch(){batchGeneration++;batchBusy=false;batchRows=[];$('#batch-run').disabled=false;$('#batch-export').disabled=true;$('#batch-chart').className='empty-chart';$('#batch-chart').textContent='Hasil muncul setelah eksperimen dijalankan.';$('#batch-table').innerHTML='<tr><td>Rata-rata ± SD</td><td>—</td><td>—</td></tr><tr><td>Median</td><td>—</td><td>—</td></tr><tr><td>Terbaik / terburuk</td><td>—</td><td>—</td></tr>';$('#batch-status').textContent='Menggunakan konfigurasi laboratorium perbandingan.';$('#batch-conclusion').textContent='Populasi awal dipasangkan untuk setiap seed. SD memakai simpangan baku sampel, pembagi n − 1.';}
const battle=new BattleController();
function summary(values){const sorted=[...values].sort((a,b)=>a-b),n=values.length,mean=values.reduce((a,b)=>a+b,0)/n;return {mean,sd:Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/(n-1)),median:(sorted[n/2-1]+sorted[n/2])/2,min:sorted[0],max:sorted.at(-1)};}
function batchChart(rows){const W=650,H=320,L=55,R=20,T=20,B=46,pw=W-L-R,ph=H-T-B;const values=rows.flatMap(r=>[r.sma.score,r.ao.score]),lo=Math.max(0,Math.min(...values)-.025),hi=Math.max(...values)+.025,y=v=>T+ph-(v-lo)/(hi-lo)*ph;let svg='';for(let i=0;i<4;i++){const v=lo+(hi-lo)*i/3;svg+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#343645"/><text x="${L-9}" y="${y(v)+5}" text-anchor="end">${fmt(v)}</text>`;}rows.forEach((r,i)=>{const x=L+pw*i/(rows.length-1);svg+=`<line x1="${x}" x2="${x}" y1="${y(r.sma.score)}" y2="${y(r.ao.score)}" stroke="#555666"/><circle cx="${x}" cy="${y(r.sma.score)}" r="4" fill="#b6e89d"/><rect x="${x-3.5}" y="${y(r.ao.score)-3.5}" width="7" height="7" fill="#ffb88c"/>`;if(i%4===0||i===rows.length-1)svg+=`<text x="${x}" y="${H-20}" text-anchor="middle">${r.seed}</text>`;});svg+=`<text x="${L}" y="${H-2}" class="chart-label">Seed pencarian</text><text x="${W-R}" y="${H-2}" text-anchor="end">● SMA / ■ AO</text>`;$('#batch-chart').className='';$('#batch-chart').innerHTML=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Fitness akhir SMA dan AO pada 20 seed pencarian. Statistik lengkap tersedia di tabel di sebelah.">${svg}</svg>`;}
$('#batch-run').onclick=async()=>{
  if(batchBusy)return;batchBusy=true;$('#batch-run').disabled=true;$('#batch-export').disabled=true;batchRows=[];
  const generation=batchGeneration;
  const config={...battle.options,workloadSeed:battle.options.seed};
  for(let i=0;i<20;i++){
    if(generation!==batchGeneration)return;
    const seed=(config.seed+i)>>>0;
    const sma=new E.Optimizer('SMA',{...config,seed}),ao=new E.Optimizer('AO',{...config,seed});
    batchRows.push({seed,config,sma:sma.finish(),ao:ao.finish()});
    $('#batch-status').textContent=`Menghitung seed ${i+1}/20…`;await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(generation!==batchGeneration)return;
  const a=summary(batchRows.map(r=>r.sma.score)),b=summary(batchRows.map(r=>r.ao.score));
  $('#batch-table').innerHTML=`<tr><td>Rata-rata ± SD</td><td>${fmt(a.mean,4)} ± ${fmt(a.sd,4)}</td><td>${fmt(b.mean,4)} ± ${fmt(b.sd,4)}</td></tr><tr><td>Median</td><td>${fmt(a.median,4)}</td><td>${fmt(b.median,4)}</td></tr><tr><td>Terbaik / terburuk</td><td>${fmt(a.min,4)} / ${fmt(a.max,4)}</td><td>${fmt(b.min,4)} / ${fmt(b.max,4)}</td></tr>`;
  let smaWins=0,aoWins=0,ties=0;batchRows.forEach(r=>{const d=r.sma.score-r.ao.score;if(Math.abs(d)<1e-10)ties++;else if(d<0)smaWins++;else aoWins++;});
  $('#batch-conclusion').textContent=`Fitness lebih rendah: SMA ${smaWins} seed, AO ${aoWins} seed, sama ${ties} seed. Hasil hanya berlaku untuk workload dan konfigurasi ini. Tidak ada uji signifikansi pada demo.`;
  $('#batch-status').textContent=`Selesai. Workload seed ${config.workloadSeed}, D=${config.n}, m=${config.m}, N=${config.population}, T=${config.iterations}, w=${fmt(config.weight)}.`;
  batchChart(batchRows);$('#batch-export').disabled=false;$('#batch-run').disabled=false;batchBusy=false;
};
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#batch-export').onclick=()=>{const header='seed,workload_seed,workload_mode,tasks,vms,population,iterations,weight_time,algorithm,fitness,makespan_seconds,cost_UB,evaluations,assignment_vm_1_based';const rows=batchRows.flatMap(r=>['sma','ao'].map(k=>[r.seed,r.config.workloadSeed,r.config.mode,r.config.n,r.config.m,r.config.population,r.config.iterations,r.config.weight,k.toUpperCase(),r[k].score,r[k].makespan,r[k].cost,r[k].evaluations,'"'+r[k].assignment.map(j=>j+1).join(';')+'"'].join(',')));download('hasil-SMA-AO-20-seed.csv','\uFEFF'+[header,...rows].join('\r\n'),'text/csv;charset=utf-8');};
$('#exact-run').onclick=()=>{const o={n:6,m:3,weight:.6,population:24,iterations:60,seed:42},sma=new E.Optimizer('SMA',o),ao=new E.Optimizer('AO',o),exact=E.exact(sma.tasks,sma.vms,o.weight,sma.baseline),a=sma.finish(),b=ao.finish();$('#exact-table').innerHTML=[['Enumerasi eksak',exact],['SMA',a],['AO',b]].map(([name,r])=>`<tr><td>${name}</td><td>${fmt(r.score,5)}</td><td>${fmt(Math.max(0,(r.score/exact.score-1)*100),2)}%</td></tr>`).join('');gantt($('#exact-gantt'),exact,sma.vms);$('#exact-status').textContent=`Jadwal optimum dari ${exact.evaluations} penempatan. SMA/AO masing-masing ${a.evaluations} evaluasi. Pengulangan kandidat dapat terjadi.`;};
const questions=[
  {q:'Kurva fitness terbaik datar selama 10 iterasi. Apa artinya?',answers:['Optimum global pasti tercapai','Arsip terbaik belum membaik','Seluruh VM menganggur'],correct:1,why:'Kurva best-so-far hanya mencatat perbaikan arsip. Kandidat lain mungkin masih bergerak.'},
  {q:'Pada iterasi 45 dari 60, strategi AO yang aktif adalah…',answers:['X₁ atau X₂','Semua strategi sama sering','X₃ atau X₄'],correct:2,why:'45/60 > ⅔, sehingga AO memasuki fase eksploitasi.'},
  {q:'Mengapa waktu dan biaya dinormalisasi sebelum dijumlahkan?',answers:['Agar satuan dan skala tidak mendominasi','Agar fitness selalu nol','Agar semua jadwal sama baik'],correct:0,why:'Normalisasi membandingkan rasio terhadap baseline yang sama. Bobot kemudian mengatur komprominya.'}
];
let quizAnswers={};
function renderQuiz(){quizAnswers={};$('#quiz').innerHTML=questions.map((q,i)=>`<div class="quiz-question"><h3>${i+1}. ${q.q}</h3><div class="quiz-options">${q.answers.map((a,j)=>`<button data-question="${i}" data-answer="${j}">${a}</button>`).join('')}</div><div class="quiz-feedback" id="feedback-${i}" role="status"></div></div>`).join('');$$('#quiz button').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.question),j=Number(b.dataset.answer);if(quizAnswers[i]!==undefined)return;quizAnswers[i]=j;const correct=j===questions[i].correct;$$(`button[data-question="${i}"]`).forEach(el=>{el.disabled=true;if(Number(el.dataset.answer)===questions[i].correct)el.classList.add('correct');});if(!correct)b.classList.add('incorrect');$(`#feedback-${i}`).textContent=`${correct?'Benar.':'Jawaban yang tepat ditandai hijau.'} ${questions[i].why}`;const answered=Object.keys(quizAnswers).length,score=Object.entries(quizAnswers).filter(([k,v])=>questions[k].correct===v).length;$('#quiz-score').textContent=`${score} benar dari ${answered} jawaban. ${answered<3?'Masih ada '+(3-answered)+' pertanyaan.':'Seluruh pertanyaan selesai.'}`;});$('#quiz-score').textContent='Pilih satu jawaban pada setiap pertanyaan.';}
$('#quiz-reset').onclick=renderQuiz;renderQuiz();

const notes=[
  ['Pembukaan','Presentasi ini menjelaskan penjadwalan tugas pada VM heterogen menggunakan dua metaheuristik berbasis populasi. Tujuannya memahami hubungan antara model, representasi, dan mekanisme pencarian. Cover menampilkan jadwal EFT dari workload sintetis yang juga dipakai pada pengantar.','Demo berjalan lokal tanpa jaringan. Gunakan panah untuk navigasi, O untuk daftar slide, N untuk catatan, dan F untuk layar penuh. Klik laboratorium jika ingin mendemonstrasikan tujuan akhir sebelum masuk ke teori.'],
  ['Tim penyusun','Perkenalkan seluruh anggota kelompok dan nomor mahasiswa sesuai daftar pada slide. Tidak ada pembagian peran yang diasumsikan.'],
  ['Alur pembahasan','Mulai dari model sederhana, kemudian fungsi objektif dan encoding. Penjelasan SMA dan AO memakai model yang sama agar perbedaan yang terlihat berasal dari aturan pencariannya. Akhiri dengan eksperimen berulang dan pemeriksaan optimum untuk kasus kecil.','Perkiraan durasi 35–45 menit termasuk demo dan diskusi. Bagian laboratorium bisa diperpanjang sesuai pertanyaan audiens.'],
  ['Makna penjadwalan','Tunjukkan penempatan semua tugas pada VM 1. Makespan sama dengan total durasi VM tersebut dan VM lain menganggur. Pindah ke Round Robin, lalu EFT. Penjadwalan yang berbeda bisa mengubah biaya karena masing-masing VM mempunyai tarif dan kecepatan berbeda.','Makespan adalah waktu selesai tugas terakhir dikurangi titik awal sistem. Semua tugas datang pada nol sehingga pada model ini cukup mengambil maksimum beban VM. Utilisasi adalah rata-rata waktu sibuk per VM dibagi makespan, bukan utilisasi CPU terukur.'],
  ['Asumsi','Contoh ini merupakan offline static scheduling: workload sudah tersedia sebelum pencarian. Setiap tugas memakai satu VM dan tidak dipecah. Tidak ada kegagalan, migrasi, atau ketidakpastian durasi. Model ini membantu mengisolasi keputusan penempatan.','Tarif hanya dihitung ketika VM mengeksekusi tugas. Tidak ada biaya idle atau pembulatan tagihan. Pada sistem riil, model biaya seperti sewa VM per jam dapat mengubah solusi terbaik. Semua angka VM adalah asumsi sintetis.'],
  ['Contoh hitung','Panjang tugas dibagi kecepatan VM menghasilkan waktu eksekusi. Round Robin menempatkan T1 dan T4 pada VM 1, T2 dan T5 pada VM 2, T3 dan T6 pada VM 3. VM 2 memiliki beban 3,75 + 5,625 = 9,375 detik, yaitu makespan jadwal.','Biaya VM 1 adalah 7 × 0,010 = 0,070 UB. Biaya VM 2 adalah 9,375 × 0,022 = 0,20625 UB. Biaya VM 3 adalah (13.000/2.400) × 0,048 = 0,260 UB. Totalnya 0,53625 UB.'],
  ['Ruang pencarian','Dengan m VM yang selalu feasible, masing-masing dari n tugas memiliki m pilihan independen, jadi ada m pangkat n penempatan. Jumlah ini tidak memasukkan permutasi urutan. Model di sini menetapkan urutan berdasarkan ID.','Eksponensialnya ruang pencarian menjelaskan motivasi heuristik, tetapi tidak otomatis membuktikan setiap model scheduling NP-hard. Metaheuristik tidak memberi sertifikat optimum. Untuk kasus kecil, enumerasi eksak justru berguna sebagai pemeriksaan.'],
  ['Kerangka metaheuristik','Klik empat tahap untuk menjelaskan loop pencarian. Populasi awal adalah kumpulan vektor posisi. Setiap vektor menghasilkan satu jadwal melalui decoder. Fitness yang lebih kecil dianggap lebih baik.','Eksplorasi dan eksploitasi adalah kecenderungan operasi pencarian, bukan jaminan biologis atau jaminan kualitas solusi. Terlalu cepat kehilangan keberagaman dapat menghentikan perbaikan sebelum mencapai optimum.'],
  ['Decoder','Setiap dimensi mewakili satu tugas. Untuk tiga VM, rentang real dibagi tiga interval sama lebar. Posisi tepat satu dipetakan ke indeks dua dengan fungsi min, sehingga tidak menghasilkan VM di luar batas.','Geser T1 dari 0,12 ke 0,32. Jadwal tidak berubah. Geser melewati 1/3 sehingga VM berubah. Ini memperlihatkan plateau fitness akibat diskretisasi. Nomor VM di layar dimulai dari satu, sedangkan engine memakai indeks nol. Tidak ada repair sumber daya karena seluruh tugas feasible pada seluruh VM.'],
  ['Objektif','Fitness adalah weighted sum dari makespan dan biaya yang dinormalisasi terhadap Round Robin workload yang sama. Normalisasi membuat kedua komponen tanpa satuan. Pembaginya tetap selama satu eksperimen.','Pindahkan bobot dari 60% ke 0% dan 100%. Sorotan tabel hanya menunjukkan kandidat terbaik di antara empat kandidat yang ditampilkan. Weighted sum ini bukan pencarian Pareto dan tidak menjamin seluruh trade-off ditemukan. Skala fitness juga memengaruhi probabilitas p pada SMA.'],
  ['Inspirasi SMA','Rujuk Li dkk. 2020 dan halaman penulis. SMA yang dibahas adalah algoritma stochastic optimization tahun 2020, bukan seluruh keluarga model Physarum untuk pencarian jalur.','Hubungan biologis dipakai sebagai inspirasi. Dalam kode tidak ada organisme, tabung, atau makanan. Ada posisi, bobot, bilangan acak, dan evaluasi fitness. Foto hanya membantu menghubungkan inspirasi dengan konsep.'],
  ['Persamaan SMA','Pada setiap individu, peluang z memberi reinisialisasi acak. Jika tidak, setiap dimensi memilih pembaruan mendekat atau kontraksi berdasarkan probabilitas p individu tersebut. W, vb, dan vc merupakan faktor per dimensi pada demo.','A dan B dipilih acak dari populasi lama. Pembaruan berlangsung sinkron dengan snapshot populasi, agar hasil tidak bergantung pada urutan perubahan individu di dalam iterasi. Setelah posisi berubah, engine melakukan clip ke batas dan evaluasi. [1, 2]'],
  ['Parameter SMA','Fitness diurutkan menaik untuk minimisasi. W memakai tanda positif pada separuh terbaik dan negatif pada sisanya. Jika fitness seluruh populasi sama, rasio ditetapkan nol untuk stabilitas numerik. Parameter t mulai dari satu sehingga arctanh tidak menerima tepat satu.','vb disampel seragam pada −a hingga a. vc disampel pada −b hingga b. Parameter b turun linier. Pada t=T, amplitudo nol. Demo menyimpan arsip global, sehingga kurva best-so-far tidak memburuk walaupun populasi baru tidak diterima secara greedy. [1, 2]'],
  ['Demo SMA','Terapkan konfigurasi, klik satu iterasi beberapa kali, lalu Putar. Penghitung acak adalah jumlah individu yang direinisialisasi. Penghitung mendekat dan kontraksi adalah jumlah koordinat yang memakai masing-masing cabang, sehingga satuannya berbeda.','Keberagaman menghitung jumlah assignment VM unik dalam populasi saat ini. Kurva dan Gantt memakai arsip terbaik. Ukuran populasi tidak berarti jumlah tugas. Tombol ulangi seed memulai lagi secara deterministik dengan parameter aktif yang sama.'],
  ['Interpretasi SMA','Kurva datar berarti arsip belum membaik. Tidak ada bukti bahwa semua jadwal sudah diperiksa. Jumlah jadwal unik lebih relevan daripada banyaknya posisi real yang berbeda untuk memahami keragaman keputusan.','Pada encoding [0,1], kontraksi menuju nol cenderung menempatkan banyak tugas pada VM 1. Ini menunjukkan interaksi pembaruan kontinu dengan decoder diskret. Mengganti encoding adalah pilihan desain yang harus diuji dan dilaporkan, bukan dianggap tidak berpengaruh.'],
  ['Inspirasi AO','Rujuk paper Abualigah dkk. 2021. Empat perilaku berburu memotivasi empat formula pembaruan. Presentasi ini membahas Aquila Optimizer. Singkatan AO juga dapat dipakai algoritma lain, jadi nama lengkap penting.','Foto adalah Aquila chrysaetos. Strategi algoritma merupakan abstraksi matematis, bukan simulasi biomekanika elang.'],
  ['Empat strategi AO','Klik X1 sampai X4. X1 menggunakan mean populasi per dimensi. X2 menambahkan individu acak, Lévy, dan komponen spiral. X3 menggabungkan selisih best dan mean dengan koefisien kecil. X4 memakai quality function, G1, G2, dan Lévy.','Dalam demo, setiap individu memilih satu strategi per iterasi, lalu seluruh dimensinya mengikuti strategi tersebut. r pada formula adalah sampel acak, dan kemunculan berbeda dapat menggunakan sampel independen. Rumus mengikuti persamaan paper [3]. Parameter implementasi diperinci pada README.'],
  ['Parameter AO','Geser iterasi ke 40 dan 41. T=60, sehingga pada t≤40 strategi X1 dan X2 aktif. Pada t>40, X3 dan X4 aktif. Setiap strategi dalam fase tersebut memiliki peluang setengah.','Demo memakai langkah Lévy Mantegna dengan Gaussian normal, beta 1,5, sigma sekitar 0,6965745, dan skala 0,01. Ini pilihan implementasi yang dinyatakan secara eksplisit karena uraian random dalam paper dan berbagai kode pendamping dapat berbeda. Posisi di luar batas dipotong sebelum decoding.'],
  ['Demo AO','Jalankan sampai melintasi iterasi 40. Setelah itu, X1 dan X2 bernilai nol pada penghitung iterasi terakhir. X3 dan X4 mulai aktif. Penghitung menunjukkan proposal, bukan jumlah proposal diterima.','AO memakai penerimaan greedy. Fitness individu boleh sama jika proposal ditolak. Arsip global tetap disimpan. Amati jumlah koordinat yang terkena clip: spiral yang besar pada domain [0,1] dapat mendorong banyak proposal ke batas dan mengurangi keragaman.'],
  ['Perbandingan mekanisme','Kedua algoritma berbagi evaluator, encoding, batas posisi, workload, dan populasi awal. Perbedaan terdapat pada pembaruan serta penerimaan individu. Arsip terbaik digunakan pada keduanya.','Hindari klaim bahwa AO pasti lebih cepat atau SMA pasti lebih stabil. Kompleksitas operasi dan performa empiris adalah dua hal berbeda. Hasil bergantung pada workload, bobot, anggaran, dan interaksi dengan decoder.'],
  ['Laboratorium perbandingan','SMA dan AO memakai populasi awal identik untuk seed yang sama. Aliran pembaruan memakai seed turunan terpisah agar masing-masing deterministik. Anggaran evaluasi sama, N(T+1). Round Robin serta EFT dihitung untuk workload yang sama.','Gunakan Putar untuk mengamati kurva dan pilih jadwal SMA atau AO. Catat bahwa urutan fitness, makespan, dan biaya dapat berbeda karena fitness adalah kompromi berbobot. Tombol Terapkan mereset kedua algoritma dan hasil batch agar parameter tidak tercampur.'],
  ['Banyak seed','Penting: eksperimen ini membekukan workload menggunakan seed workload dari konfigurasi aktif slide 21. Sebanyak 20 seed pencarian mengubah populasi awal dan langkah pencarian, sehingga variasi yang terlihat adalah variasi algoritma pada satu instance.','Untuk setiap seed, populasi awal SMA dan AO identik. Tabel melaporkan rata-rata, simpangan baku sampel, median, terbaik, dan terburuk. Jumlah kemenangan memakai toleransi 1e-10. CSV berisi 40 baris dan parameter lengkap. Banyak seed pencarian pada satu instance belum menggantikan evaluasi pada banyak workload.'],
  ['Enumerasi eksak','Klik Hitung dan bandingkan. Engine mencoba semua 3^6=729 assignment dan memakai fungsi objektif yang identik dengan optimizer. Optimum ini sah untuk model yang ditetapkan, termasuk urutan ID dan biaya aktif.','Gap dihitung relatif pada optimum eksak. Gap nol hanya membuktikan optimum pada instance kecil itu. Ukuran contoh sengaja kecil karena pertumbuhan eksponensial. Algoritma dapat menggunakan lebih banyak evaluasi daripada 729 dan tetap mengulang kandidat yang sama.'],
  ['Kompleksitas dan keadilan','Biaya evaluasi satu jadwal O(D+m) untuk membangun beban mesin dan hasil. Dengan m dibatasi kecil pada demo, O(D) mendominasi. SMA menambahkan sorting O(N log N) per iterasi. AO menghitung mean O(ND), jadi biaya utama O(TND).','Memori inti O(ND). Penyimpanan seluruh riwayat dan data Gantt untuk visualisasi menambah memori; itu tidak termasuk analisis inti. Wall-clock browser dipengaruhi perangkat dan rendering, sehingga tidak dipakai sebagai perbandingan kinerja penelitian.'],
  ['Pengembangan model','Model riil bisa memasukkan release time, kebutuhan RAM/core, SLA, dependency DAG, transfer data, dan gangguan sistem. Penambahan kendala membutuhkan evaluator serta decoder yang menjamin feasibility atau repair yang eksplisit.','Tuning sebaiknya menggunakan instance pelatihan terpisah dari evaluasi. Local search atau hybridisasi mengubah metode, sehingga harus dilabeli dan dibandingkan dengan anggaran yang adil. Jangan menggeneralisasi dari hasil demo ini ke cloud produksi.'],
  ['Kuis','Berikan waktu audiens menjawab sebelum memilih. Jawaban disimpan sampai Ulangi kuis ditekan. Jawaban benar ditandai hijau dan penjelasan muncul langsung.','Kunci: pertanyaan 1 opsi kedua, pertanyaan 2 opsi ketiga, pertanyaan 3 opsi pertama. Fokuskan diskusi pada interpretasi kurva, ambang dua pertiga, dan arti normalisasi.'],
  ['Kesimpulan','SMA dan AO memberi mekanisme berbeda untuk mengubah populasi solusi. Penerapan ke scheduling membutuhkan representasi, evaluator, dan kendala yang jelas. Inspirasi biologis saja tidak menjamin kinerja.','Pertanyaan diskusi mengajak audiens kembali ke fungsi objektif. Buka slide 21, ubah bobot waktu, dan jalankan ulang. Karena semua data sintetis dan deterministik, eksperimen dapat dipresentasikan lagi dengan hasil yang sama.'],
  ['Referensi','Sumber utama adalah paper SMA 2020 dan AO 2021, didukung halaman penulis serta kode pendamping. Persamaan inti diparafrasekan dan diimplementasikan ulang untuk model pendidikan ini.','Semua angka hasil demo dihitung lokal. Tidak ada nilai benchmark dari paper yang diklaim sebagai hasil scheduling. Atribusi foto lengkap dan pilihan implementasi tersedia dalam README. Internet hanya diperlukan untuk membuka tautan sumber, bukan untuk menjalankan presentasi.']
];
function renderNote(){const n=notes[current];$('#note-title').textContent=`${current+1}. ${n[0]}`;$('#note-body').innerHTML=n.slice(1).map(p=>`<p>${p}</p>`).join('');$('#note-counter').textContent=`${current+1} / ${slides.length}`;$('#notes-prev').disabled=current===0;$('#notes-next').disabled=current===slides.length-1;}
$('#notes-prev').onclick=()=>go(current-1);$('#notes-next').onclick=()=>go(current+1);
slides.forEach(s=>s.setAttribute('aria-hidden','true'));
go((Number(location.hash.slice(1))||1)-1,false);resize();
addEventListener('hashchange',()=>go((Number(location.hash.slice(1))||1)-1,false));
// Public read-only-ish hooks make the educational state inspectable in devtools.
window.Presentation={go,controllers,battle,get current(){return current;},get batchRows(){return batchRows;}};
$$('[data-visualization]').forEach(link=>{
  const destination=()=>{
    const view=link.dataset.visualization;
    const options=view==='sma'?controllers[0].optimizer.options:view==='ao'?controllers[1].optimizer.options:battle.options;
    const url=location.protocol==='file:'?new URL('https://sma-ao.surge.sh/visualization/'):new URL('./visualization/',location.href);
    url.searchParams.set('view',view);url.searchParams.set('returnSlide',String(slides.indexOf(link.closest('.slide'))+1));
    for(const key of ['n','m','population','iterations','seed','weight','mode'])url.searchParams.set(key,String(options[key]));
    url.searchParams.set('workloadSeed',String(options.workloadSeed??options.seed));return url.href;
  };
  link.addEventListener('pointerdown',()=>{link.href=destination();});
  link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey)return;event.preventDefault();controllers.forEach(c=>c.pause());location.assign(destination());});
});
