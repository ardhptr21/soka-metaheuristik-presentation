import './ui.css';
import './lesson.css';
import {E,Simulation,parseConfiguration,configurationQuery} from './model.js';
import {SceneController,strategyColors} from './scene.js';
import {stages,transitionData,frameCursor,describeUpdate,learningDescription,movementSummary,signed} from './education.js';
import {lessonFrame} from './lesson-visual.js';

const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
const fmt=(value,digits=3)=>Number(value).toLocaleString('id-ID',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const vmColors=['#badf82','#85bedb','#efba83','#ba9edb'];
const initial=parseConfiguration(location.search);
let config=initial.config,view=initial.view,simulation=new Simulation(config),axes=[0,1,2],selected={SMA:0,AO:0},active=view==='ao'?'AO':'SMA';
let playing=false,transition=null,speed=1,showTrails=true,showProposals=true,dirty=false,lastStep=0,toastTimer,focusMode=false;
let lesson={enabled:false,step:0},isolateSelected=false,showVMBounds=false,showSelectionCard=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
$('#return-link').href=`../index.html#${initial.returnSlide}`;
$('#return-text-link').href=`../index.html#${initial.returnSlide}`;
const form=$('#settings-form');
const lessonCard=document.createElement('section');lessonCard.id='lesson-scene-card';lessonCard.hidden=true;lessonCard.setAttribute('aria-label','Tahap pembelajaran pada ruang visualisasi');
lessonCard.innerHTML='<div class="lesson-scene-heading"><span id="lesson-scene-number"></span><div><small id="lesson-scene-context"></small><h2 id="lesson-scene-title"></h2></div></div><p id="lesson-scene-note"></p><code id="lesson-scene-formula"></code>';
$('#scene-zone').append(lessonCard);
const lessonReadout=document.createElement('div');lessonReadout.id='lesson-readout';lessonReadout.hidden=true;$('#scene-zone').append(lessonReadout);
const lessonFocus=document.createElement('button');lessonFocus.id='lesson-focus-camera';lessonFocus.textContent='⌖ Fokus langkah';lessonFocus.hidden=true;lessonFocus.title='Bingkai ulang kandidat dan penanda tahap ini';$('.scene-camera-tools').prepend(lessonFocus);
for(const [key,value] of Object.entries(config)){const field=form.elements.namedItem(key);if(field)field.value=key==='weight'?Math.round(value*100):value;}
$('#weight-label').textContent=`${Math.round(config.weight*100)}%`;

function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},3200);}
function closeDrawers(){$('#application').classList.remove('show-settings','show-inspector');}
$('#settings-button').onclick=()=>{$('#application').classList.remove('show-inspector');$('#application').classList.toggle('show-settings');};
$('#inspector-button').onclick=()=>{$('#application').classList.remove('show-settings');$('#application').classList.toggle('show-inspector');};
$$('.close-settings,.close-inspector,#drawer-backdrop').forEach(button=>button.onclick=closeDrawers);

const scene=new SceneController($('#scene-host'),(kind,id,hits,point)=>{if(hits?.length>1)openOverlap(hits,point);else selectCandidate(kind,id);},(message,fallback)=>{
  $('#renderer-status').textContent=message;$('#renderer-toggle').textContent=fallback?'Mode 2D aktif':'Mode 2D';$('#renderer-toggle').disabled=fallback;$('#scene-help').textContent=fallback?'Proyeksi X/Y · Pilih kandidat: klik titik':'Putar: seret · Perbesar: scroll · Pilih: klik objek';
  for(const selector of ['#zoom-in','#zoom-out','#fit-camera'])$(selector).disabled=fallback;
});
$('#reset-camera').onclick=()=>{scene.resetCamera();toast('Kamera kembali ke posisi awal.');};
$('#renderer-toggle').onclick=()=>{pause();scene.toggle2D();};
$('#zoom-in').onclick=()=>scene.zoom(1.2);
$('#zoom-out').onclick=()=>scene.zoom(1/1.2);
$('#fit-camera').onclick=()=>scene.resetCamera();
lessonFocus.onclick=()=>scene.focusLesson();
function setFocusMode(enabled){
  focusMode=enabled;closeDrawers();closeOverlap();document.body.classList.toggle('focus-mode',focusMode);
  if(!focusMode)showSelectionCard=false;
  $('#focus-button').textContent=focusMode?'↙ Tampilkan Panel':'⛶ Mode Fokus';
  $('#focus-button').setAttribute('aria-pressed',String(focusMode));
  $('#focus-button').title=focusMode?'Kembali ke tampilan lengkap (Esc atau F)':'Sembunyikan panel dan perbesar ruang 3D (F)';
  scrollTo({top:0,left:0,behavior:'instant'});
  requestAnimationFrame(()=>{scene.resize();if(lesson.enabled)scene.focusLesson();else scene.resetCamera();});
  renderEducation();
}
$('#focus-button').onclick=()=>setFocusMode(!focusMode);

function updateURL(){history.replaceState(null,'',`${location.pathname}?${configurationQuery(config,view,initial.returnSlide)}`);}
function setView(next){pause();lesson.enabled=false;closeOverlap();view=next;active=next==='ao'?'AO':next==='sma'?'SMA':active;updateURL();draw();scene.resize();}
$$('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view));
function rebuildSelectors(){
  ['x','y','z'].forEach((key,index)=>{const field=$(`#axis-${key}`);field.innerHTML=Array.from({length:config.n},(_,i)=>`<option value="${i}">T${i+1}</option>`).join('');axes[index]=Math.min(axes[index],config.n-1);field.value=axes[index];});
  $('#candidate-select').innerHTML=Array.from({length:config.population},(_,i)=>`<option value="${i}">Kandidat ${String(i+1).padStart(2,'0')}</option>`).join('');
}
['x','y','z'].forEach((key,index)=>{$(`#axis-${key}`).onchange=event=>{
  pause();const next=Number(event.target.value),other=axes.findIndex((axis,i)=>i!==index&&axis===next);if(other!==-1){axes[other]=axes[index];$(`#axis-${'xyz'[other]}`).value=axes[other];}axes[index]=next;draw();
};});
$('#candidate-select').onchange=event=>selectCandidate(active,Number(event.target.value),false);
$('#show-trails').onchange=event=>{showTrails=event.target.checked;draw();};
$('#show-proposals').onchange=event=>{showProposals=event.target.checked;draw();};
$('#isolate-candidate').onchange=event=>{isolateSelected=event.target.checked;draw();};
$('#show-vm-bounds').onchange=event=>{showVMBounds=event.target.checked;draw();};
$('#bounds-button').onclick=()=>{showVMBounds=!showVMBounds;$('#show-vm-bounds').checked=showVMBounds;draw();};
form.addEventListener('input',()=>{pause();lesson.enabled=false;dirty=true;$('#weight-label').textContent=`${form.elements.weight.value}%`;$('#settings-status').textContent='Ada perubahan. Klik Terapkan & Ulangi.';draw();});
form.onsubmit=event=>{
  event.preventDefault();if(!form.reportValidity())return;
  config=Object.fromEntries(Object.keys(config).map(key=>[key,key==='mode'?form.elements[key].value:Number(form.elements[key].value)]));config.weight/=100;
  dirty=false;restart();rebuildSelectors();updateURL();draw();closeDrawers();$('#settings-status').textContent='Parameter aktif. Hasil dapat diulang.';toast('Konfigurasi diterapkan. Pencarian kembali ke awal.');
};
function pause(){playing=false;transition=null;$('#play-button').innerHTML='<span>▶</span> Jalankan';document.body.classList.add('simulation-paused');}
function restart(){pause();lesson.enabled=false;showSelectionCard=false;closeOverlap();simulation=new Simulation(config);selected={SMA:0,AO:0};lastStep=0;draw();}
function advance(animate=true){
  if(dirty){toast('Terapkan perubahan parameter terlebih dahulu.');return false;}
  const from=simulation.cursor;
  closeOverlap();
  if(!simulation.advance()){pause();draw();return false;}
  transition=animate&&!reduced?{from,start:performance.now(),duration:Math.min(700,800/speed)}:null;
  lastStep=performance.now();draw();return true;
}
$('#play-button').onclick=()=>{
  if(playing){pause();draw();return;}
  if(dirty){toast('Klik Terapkan & Ulangi untuk memakai parameter baru.');return;}
  if(simulation.finished)restart();playing=true;document.body.classList.remove('simulation-paused');$('#play-button').innerHTML='<span>Ⅱ</span> Jeda';if(!transition)advance();
};
$('#step-button').onclick=()=>{pause();if(lesson.enabled)nextLesson();else advance();};
$('#restart-button').onclick=()=>{restart();toast('Seed yang sama, populasi awal yang sama.');};
$('#speed').onchange=event=>{speed=Number(event.target.value);};
$('#timeline').oninput=event=>{pause();lesson.enabled=false;closeOverlap();simulation.seek(Number(event.target.value));draw();};

function selectCandidate(kind,id,openInspector=true){
  if(!simulation.optimizers[kind]||!Number.isInteger(id)||id<0||id>=config.population)return;
  pause();closeOverlap();active=kind;selected[kind]=id;if(lesson.enabled)lesson.step=0;showSelectionCard=true;$('#schedule-source').value='candidate';draw();
  if(openInspector&&innerWidth<=1350&&!focusMode&&!lesson.enabled){$('#application').classList.remove('show-settings');$('#application').classList.add('show-inspector');}
}
function closeOverlap(){$('#overlap-picker').hidden=true;}
function openOverlap(hits,point){
  pause();const picker=$('#overlap-picker'),rect=$('#scene-zone').getBoundingClientRect();
  const frame=frameCursor(simulation.cursor,lesson);
  $('#overlap-options').innerHTML=hits.map(hit=>`<button data-kind="${hit.kind}" data-id="${hit.id}">${hit.kind} · Kandidat ${String(hit.id+1).padStart(2,'0')} <small>f ${fmt(simulation.snapshot(hit.kind,frame).population[hit.id].score,4)}</small></button>`).join('');
  $$('#overlap-options button').forEach(button=>button.onclick=()=>selectCandidate(button.dataset.kind,Number(button.dataset.id)));
  picker.hidden=false;picker.style.left=`${Math.max(10,Math.min(rect.width-246,(point?.x||rect.left)-rect.left+10))}px`;picker.style.top=`${Math.max(80,Math.min(rect.height-235,(point?.y||rect.top)-rect.top+10))}px`;
  $('#overlap-options button')?.focus();
}
$('#overlap-close').onclick=closeOverlap;
function startLesson(){
  if(dirty){toast('Terapkan parameter sebelum membuka Mode Belajar.');return;}
  pause();closeOverlap();if(simulation.cursor===0)simulation.advance();lesson={enabled:true,step:0};showSelectionCard=false;$('#schedule-source').value='candidate';closeDrawers();draw();
}
function closeLesson(){lesson.enabled=false;draw();}
function nextLesson(){
  pause();closeOverlap();if(lesson.step<4)lesson.step++;else if(simulation.advance())lesson.step=0;draw();
}
$('#learn-button').onclick=()=>lesson.enabled?closeLesson():startLesson();
$('#close-lesson').onclick=closeLesson;$('#lesson-next').onclick=nextLesson;
$('#lesson-prev').onclick=()=>{lesson.step=Math.max(0,lesson.step-1);draw();};
$('#hud-close').onclick=()=>{showSelectionCard=false;renderEducation();};
$('#hud-learn').onclick=startLesson;
$('#hud-isolate').onclick=()=>{isolateSelected=!isolateSelected;$('#isolate-candidate').checked=isolateSelected;draw();};
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();draw();}});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){if(!$('#overlap-picker').hidden){closeOverlap();return;}closeDrawers();if(focusMode&&!$('dialog[open]'))setFocusMode(false);return;}
  if(/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)||$('dialog[open]')||event.ctrlKey||event.metaKey)return;
  if(event.key.toLowerCase()==='f'){event.preventDefault();setFocusMode(!focusMode);return;}
  if(/BUTTON|A/.test(event.target.tagName))return;
  if(event.key===' '){event.preventDefault();$('#play-button').click();}
  if(event.key==='ArrowRight'){event.preventDefault();$('#step-button').click();}
});
$('#guide-button').onclick=()=>{pause();$('#guide').showModal();};
$('#close-guide').onclick=$('#start-guide').onclick=()=>$('#guide').close();
$('#fullscreen-button').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Gunakan tombol F11 pada browser untuk layar penuh.');}};
$('#share-button').onclick=async()=>{updateURL();try{await navigator.clipboard.writeText(location.href);toast('Tautan konfigurasi berhasil disalin.');}catch{const text=document.createElement('textarea');text.value=location.href;document.body.append(text);text.select();const success=document.execCommand('copy');text.remove();toast(success?'Tautan konfigurasi berhasil disalin.':'Salin tautan dari bilah alamat browser.');}};
$('#schedule-source').onchange=draw;

function infoRow(label,value,color=''){return `<div class="info-row"><span>${label}</span><b${color?` style="color:${color}"`:''}>${value}</b></div>`;}
function metric(label,value,unit='',extra='',accent=false){return `<div class="metric ${accent?'accent':''}"><span>${label}</span><strong>${value}</strong>${unit?`<small>${unit}</small>`:''}${extra?`<div class="secondary-value">${extra}</div>`:''}</div>`;}
function drawMetrics(){
  const frame=frameCursor(simulation.cursor,lesson),a=simulation.snapshot('SMA',frame),b=simulation.snapshot('AO',frame),row=active==='SMA'?a:b,compare=view==='compare';
  $('#metrics-strip').innerHTML=metric(compare?'Fitness / SMA':'Fitness terbaik ↓',fmt(compare?a.score:row.score,4),'',compare?`AO ${fmt(b.score,4)}`:'',true)+metric(compare?'Makespan / SMA':'Makespan',fmt(compare?a.makespan:row.makespan,2),'detik',compare?`AO ${fmt(b.makespan,2)} d`:'')+metric(compare?'Biaya / SMA':'Biaya eksekusi',fmt(compare?a.cost:row.cost),'UB',compare?`AO ${fmt(b.cost)} UB`:'')+metric('Evaluasi / algoritma',String(row.evaluations),'',`${row.diversity}/${config.population} jadwal unik`);
}
function renderChart(){
  const W=430,H=135,L=39,R=12,T=10,B=26,pw=W-L-R,ph=H-T-B;
  const algorithms=view==='compare'?['SMA','AO']:[view==='ao'?'AO':'SMA'];
  const frame=frameCursor(simulation.cursor,lesson);
  const series=algorithms.map(kind=>({kind,trace:simulation.optimizers[kind].trace.slice(0,frame+1)}));
  const values=series.flatMap(s=>s.trace.map(row=>row.score)),lo=Math.max(0,Math.min(...values)-.03),hi=Math.max(1,...values)+.025;
  const x=i=>L+pw*i/config.iterations,y=v=>T+ph-(v-lo)/(hi-lo)*ph;
  let content='';
  for(let i=0;i<3;i++){const v=lo+(hi-lo)*i/2;content+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#343645"/><text x="${L-7}" y="${y(v)+4}" text-anchor="end">${fmt(v,2)}</text>`;}
  content+=`<line x1="${L}" x2="${W-R}" y1="${y(1)}" y2="${y(1)}" stroke="#81758f" stroke-dasharray="2 5"/><text x="${W-R}" y="${y(1)-4}" text-anchor="end">RR = 1</text>`;
  for(const q of [0,.5,1])content+=`<text x="${x(config.iterations*q)}" y="${H-8}" text-anchor="middle">${Math.round(config.iterations*q)}</text>`;
  for(const s of series){const color=s.kind==='SMA'?'#b6e89d':'#ffb88c',last=s.trace.at(-1);content+=`<polyline fill="none" stroke="${color}" stroke-width="2" ${s.kind==='AO'?'stroke-dasharray="5 3"':''} points="${s.trace.map((row,i)=>`${x(i)},${y(row.score)}`).join(' ')}"/><circle cx="${x(frame)}" cy="${y(last.score)}" r="3" fill="${color}"/>`;}
  $('#convergence').innerHTML=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kurva fitness terbaik hingga iterasi ${simulation.cursor}. ${series.map(s=>`${s.kind}: ${fmt(s.trace.at(-1).score,4)}`).join('. ')}">${content}</svg>`;
}
function renderSchedule(){
  const snap=simulation.snapshot(active),optimizer=simulation.optimizers[active],candidate=snap.population[selected[active]],isCandidate=$('#schedule-source').value==='candidate';
  const data=transitionData(optimizer,snap,selected[active]),preview=lesson.enabled&&lesson.step===3,early=lesson.enabled&&lesson.step<3;
  const result=isCandidate?(early?data.before:preview?data.proposal:data.after):simulation.snapshot(active,frameCursor(simulation.cursor,lesson));
  const changes=isCandidate&&!early?(preview?data.proposedChanges:data.changes):[],moved=new Set(changes.map(change=>change.task));
  const axisMax=moved.size?Math.max(result.makespan,data.before.makespan):result.makespan;
  $('#schedule').innerHTML=optimizer.vms.map((vm,j)=>`<div class="gantt-row"><span class="gantt-name">V${j+1}</span><div class="gantt-track ${moved.size?'has-changes':''}">${result.bars.filter(bar=>bar.vm===j).map(bar=>`<span class="gantt-bar ${moved.has(bar.task)?'moved':''}" title="T${bar.task}: VM ${j+1}, ${fmt(bar.start,2)}–${fmt(bar.end,2)} detik${moved.has(bar.task)?', penempatan berubah':''}" style="left:${bar.start/axisMax*100}%;width:${bar.duration/axisMax*100}%;background:${vmColors[j]}">${bar.duration/axisMax>.055?'T'+bar.task:''}</span>`).join('')}${data.before.bars.filter(bar=>bar.vm===j&&moved.has(bar.task)).map(bar=>`<span class="gantt-previous" title="Sebelum: T${bar.task} pada VM ${j+1}" style="left:${bar.start/axisMax*100}%;width:${bar.duration/axisMax*100}%"></span>`).join('')}</div></div>`).join('')+`<div class="gantt-axis"><span>0</span><span>${fmt(axisMax/2,1)}</span><span>${fmt(axisMax,2)} detik</span></div>`;
  $('#schedule-caption').textContent=`${active} · ${isCandidate?`kandidat ${selected[active]+1}${early?' (awal)':preview?' (proposal)':''}`:'arsip terbaik'} · makespan ${fmt(result.makespan,2)} d · biaya ${fmt(result.cost)} UB`;
  const summary=$('#migration-summary');summary.hidden=!isCandidate;
  summary.innerHTML=isCandidate?`<p>${early?'Ikuti tahap berikutnya untuk melihat perubahan penempatan.':movementSummary(data,preview)}</p>${!early&&data.detail?`<small>${preview?'◌ Pratinjau · ':''}Δ makespan ${signed(result.makespan-data.before.makespan,2)} d · Δ biaya ${signed(result.cost-data.before.cost)} UB${moved.size?' · garis putus-putus = posisi awal':''}</small>`:''}`:'';
}
const formulas={acak:'X′ = LB + r · (UB − LB)',campuran:'X′ = Xb + vb · (W · XA − XB)\natau X′ = vc · X',X1:'X′ = Xb (1 − t/T) + (X̄ − Xb · r)',X2:'X′ = Xb · L + XR + (y − x) · r',X3:'X′ = 0,1 (Xb − X̄) − r + 0,1 r₂',X4:'X′ = QF · Xb − G₁ · X · r − G₂ · L + r₂ · G₁'};
function numericCalculation(detail,d){
  const c=detail.dimensions[d];if(!c)return 'Sampel acak seragam pada [0, 1].';const f=v=>fmt(v,4);
  if(detail.branch==='campuran')return c.branch==='mendekat'?`${f(detail.bestUsed[d])} + ${f(c.vb)} × (${f(c.W)} × ${f(c.xA)} − ${f(c.xB)})`:`${f(c.vc)} × ${f(detail.before[d])}`;
  if(detail.branch==='X1')return `${f(detail.bestUsed[d])} × ${f(1-simulation.cursor/config.iterations)} + (${f(detail.mean[d])} − ${f(detail.bestUsed[d])} × ${f(c.r)})`;
  if(detail.branch==='X2')return `${f(detail.bestUsed[d])} × ${f(c.L)} + ${f(detail.randomPosition[d])} + (${f(c.y)} − ${f(c.x)}) × ${f(c.r)}`;
  if(detail.branch==='X3')return `0,1 × (${f(detail.bestUsed[d])} − ${f(detail.mean[d])}) − ${f(c.r)} + 0,1 × ${f(c.r2)}`;
  return `${f(detail.quality)} × ${f(detail.bestUsed[d])} − ${f(detail.g1)} × ${f(detail.before[d])} × ${f(c.r)} − ${f(detail.g2)} × ${f(c.L)} + ${f(c.r2)} × ${f(detail.g1)}`;
}
function renderInspector(){
  const optimizer=simulation.optimizers[active],snap=simulation.snapshot(active),id=selected[active],detail=snap.updates[id];
  const early=lesson.enabled&&lesson.step<4&&detail;
  const candidate=early?{...snap.population[id],position:detail.before,assignment:E.decode(detail.before,config.m),score:detail.beforeScore}:snap.population[id],result=E.evaluate(candidate.assignment,optimizer.tasks,optimizer.vms);
  $('#inspector-algorithm').textContent=active;$('#inspector-algorithm').style.color=active==='SMA'?'var(--sma)':'var(--orange)';$('#candidate-title').textContent=`Kandidat ${String(id+1).padStart(2,'0')}`;$('#candidate-select').value=id;
  $('#candidate-metrics').innerHTML=infoRow('Fitness kandidat',fmt(candidate.score,5),'var(--accent)')+infoRow('Makespan',`${fmt(result.makespan,2)} d`)+infoRow('Biaya',`${fmt(result.cost)} UB`);
  const status=$('#update-status');status.textContent=!detail?'Inisialisasi':early?['Awal','Aturan','Mentah','Pratinjau'][lesson.step]:detail.accepted?'Diterima':'Ditolak';status.classList.toggle('rejected',!early&&!!detail&&!detail.accepted);
  if(!detail){$('#update-description').textContent='Posisi awal disampel secara acak. SMA dan AO memulai dari populasi yang identik.';$('#update-formula').textContent='X ∼ U(0, 1)';$('#coefficient-values').innerHTML='';}
  else{
    const counts=detail.dimensions.reduce((acc,c)=>{if(c.branch)acc[c.branch]=(acc[c.branch]||0)+1;return acc;},{});
    const description=active==='SMA'?detail.branch==='acak'?'Eksplorasi acak: seluruh koordinat individu diinisialisasi ulang.':`${counts.mendekat||0} koordinat mendekat, ${counts.kontraksi||0} kontraksi. SMA mengganti posisi individu; arsip terbaik tetap disimpan.`:`Strategi ${detail.branch}: ${detail.accepted?'proposal memperbaiki fitness kandidat.':'proposal tidak memperbaiki fitness. Posisi sebelumnya dipertahankan.'}`;
    $('#update-description').textContent=description;$('#update-formula').textContent=formulas[detail.branch];$('#update-formula').style.whiteSpace='pre-line';
    const coeff=[];
    if(active==='SMA'&&detail.branch==='campuran'){coeff.push(['p',fmt(detail.p,4)],['A / B',`${detail.A+1} / ${detail.B+1}`]);for(const d of axes){const c=detail.dimensions[d];coeff.push([`T${d+1} · W`,fmt(c.W,4)],[`vb / vc`,`${fmt(c.vb,3)} / ${fmt(c.vc,3)}`]);}}
    if(active==='AO'){if(detail.branch==='X4')coeff.push(['G₁',fmt(detail.g1,4)],['G₂',fmt(detail.g2,4)],['QF',fmt(detail.quality,5)]);for(const d of axes){const c=detail.dimensions[d];coeff.push([`T${d+1} · r`,fmt(c.r,4)]);if(c.L!==undefined)coeff.push([`T${d+1} · Lévy`,fmt(c.L,5)]);}}
    $('#coefficient-values').innerHTML=coeff.map(([k,v])=>`<span>${k}: <b>${v}</b></span>`).join('');
  }
  $('#position-table').innerHTML=`<table><thead><tr><th>Tugas</th><th>Awal</th><th>Mentah</th><th>Clip</th><th>Akhir</th></tr></thead><tbody>${axes.map(d=>`<tr><td>T${d+1}</td><td>${fmt(detail?detail.before[d]:candidate.position[d])}</td><td>${detail?fmt(detail.rawProposal[d]):'—'}</td><td>${detail?fmt(detail.proposal[d]):'—'}</td><td>${fmt(detail?detail.after[d]:candidate.position[d])}</td></tr>`).join('')}</tbody></table>${detail?`<details class="calculation-detail"><summary>Lihat substitusi angka</summary>${axes.map(d=>`<p><b>T${d+1}${detail.dimensions[d]?.branch?' · '+detail.dimensions[d].branch:''}</b><br>${numericCalculation(detail,d)}<br>= ${fmt(detail.rawProposal[d],5)}</p>`).join('')}<p>f awal ${fmt(detail.beforeScore,5)}<br>f proposal ${fmt(detail.proposalScore,5)}<br>f akhir ${fmt(detail.afterScore,5)}</p></details>`:''}`;
  const changed=new Set(!early?transitionData(optimizer,snap,id).changes.map(change=>change.task):[]);
  $('#assignment-grid').innerHTML=candidate.assignment.map((vm,i)=>`<span class="assignment-token ${changed.has(i+1)?'moved':''}" style="color:${vmColors[vm]};border-color:${vmColors[vm]}55" title="T${i+1}: ${optimizer.tasks[i].length} MI → VM ${vm+1}${changed.has(i+1)?', penempatan berubah':''}">T${i+1}${changed.has(i+1)?' ⇄':''}</span>`).join('');
  $('#baseline-values').innerHTML=infoRow('Round Robin / f','1,00000')+infoRow('EFT / f',fmt(E.objective(optimizer.greedy,optimizer.baseline,config.weight),5))+infoRow('Arsip terbaik / f',fmt(snap.score,5));
}
function renderEducation(){
  const data=transitionData(simulation.optimizers[active],simulation.snapshot(active),selected[active]);
  $('#learning-panel').hidden=!lesson.enabled;$('#learn-button').setAttribute('aria-pressed',String(lesson.enabled));
  $('#learn-button').classList.toggle('active',lesson.enabled);$('#learn-button').textContent=lesson.enabled?'◉ Tutup Belajar':'◉ Mode Belajar';$('#learn-button').disabled=dirty;
  document.body.classList.toggle('learning-mode',lesson.enabled);
  const frame=lessonFrame({simulation,lesson:{...lesson,algorithm:active},cursor:simulation.cursor,selected,axes},active);
  lessonCard.hidden=lessonReadout.hidden=lessonFocus.hidden=!frame;
  if(frame){
    lessonCard.style.setProperty('--stage-color',frame.color);lessonReadout.style.setProperty('--stage-color',frame.color);
    $('#lesson-scene-number').textContent=String(lesson.step+1).padStart(2,'0');$('#lesson-scene-context').textContent=`${active} · Kandidat ${String(selected[active]+1).padStart(2,'0')}`;
    $('#lesson-scene-title').textContent=frame.title;$('#lesson-scene-note').textContent=frame.note;
    $('#lesson-scene-formula').hidden=lesson.step!==1;$('#lesson-scene-formula').textContent=formulas[data.detail.branch];
    const d=data.detail,values=lesson.step<=1?d.before:lesson.step===2?d.rawProposal:lesson.step===3?d.proposal:d.after;
    const name=lesson.step<=1?'awal':lesson.step===2?'mentah':lesson.step===3?'clip':'akhir';
    lessonReadout.innerHTML=axes.map((axis,i)=>`<div><small>${'XYZ'[i]} · T${axis+1} / ${name}</small><strong>${lesson.step>=2?`<span>${fmt(d.before[axis],3)}</span> → `:''}${fmt(values[axis],3)}</strong>${lesson.step===3?`<em>mentah ${fmt(d.rawProposal[axis],3)} → VM ${E.decode(d.proposal,config.m)[axis]+1}</em>`:''}</div>`).join('');
  }
  $('#play-button').disabled=lesson.enabled||dirty;$('#speed').disabled=lesson.enabled;$('#timeline').disabled=lesson.enabled;$('#schedule-source').disabled=lesson.enabled;
  $('#bounds-button').setAttribute('aria-pressed',String(showVMBounds||lesson.enabled));$('#bounds-button').classList.toggle('active',showVMBounds||lesson.enabled);
  if(lesson.enabled){
    $('#lesson-context').textContent=`${active} · Kandidat ${String(selected[active]+1).padStart(2,'0')} · Iterasi ${simulation.cursor} · Tahap ${lesson.step+1}/5`;
    $('#learning-stages').innerHTML=stages.map((name,i)=>`<button data-stage="${i}" class="${i===lesson.step?'active':''}" aria-current="${i===lesson.step?'step':'false'}">${i+1}. ${name}</button>`).join('');
    $$('#learning-stages button').forEach(button=>button.onclick=()=>{lesson.step=Number(button.dataset.stage);draw();});
    $('#lesson-description').textContent=learningDescription(lesson.step,data,active,axes,config.m);
    $('#lesson-prev').disabled=lesson.step===0;$('#lesson-next').textContent=lesson.step===4?'Iterasi berikutnya →':'Berikutnya →';$('#lesson-next').disabled=lesson.step===4&&simulation.finished;
    $('#lesson-status').textContent=`Isolasi & batas VM otomatis · ${simulation.optimizers[active].evaluations} evaluasi tercatat, tanpa evaluasi ulang per tahap`;
  }
  const hud=$('#focus-hud');hud.hidden=!(focusMode&&showSelectionCard&&!lesson.enabled);
  $('#hud-title').textContent=`${active} · Kandidat ${String(selected[active]+1).padStart(2,'0')}`;
  $('#hud-strategy').textContent=describeUpdate(data.detail,axes);
  $('#hud-values').innerHTML=data.detail?`<strong>f ${fmt(data.detail.beforeScore,4)} → ${fmt(data.detail.afterScore,4)}</strong><span>${data.detail.accepted?'✓ Diterapkan':'✕ Ditolak'} · Δf ${signed(data.delta,4)}</span><small>${movementSummary(data)}</small>`:`<strong>f ${fmt(data.candidate.score,4)}</strong><span>○ Inisialisasi</span>`;
  $('#hud-isolate').setAttribute('aria-pressed',String(isolateSelected));$('#hud-isolate').textContent=isolateSelected?'Semua kandidat':'Isolasi';
  $('#fitness-high').textContent=`f ≥ ${fmt(simulation.fitnessScale.max,2)}`;$('#fitness-low').textContent=`f ≤ ${fmt(simulation.fitnessScale.min,2)}`;
}
function draw(){
  const cursor=simulation.cursor;
  $$('[data-view]').forEach(button=>{const chosen=button.dataset.view===view;button.classList.toggle('active',chosen);button.setAttribute('aria-pressed',String(chosen));});
  $('#workspace-title').textContent=view==='sma'?'Slime Mould Algorithm':view==='ao'?'Aquila Optimizer':'SMA & AO · Perbandingan';
  $('#scene-zone').classList.toggle('compare',view==='compare');$('#dimension-label').textContent=config.n;
  const algorithms=view==='compare'?['SMA','AO']:[view==='ao'?'AO':'SMA'];
  $('#scene-labels').innerHTML=algorithms.map(kind=>`<div class="scene-label ${kind==='AO'?'ao':''}"><i></i><div>${kind==='SMA'?'Physarum · Slime Mould':'Aquila · Pencarian mangsa'}<small>${config.population} KANDIDAT / ${config.n} DIMENSI</small></div><span class="phase-pill">${cursor===0?'INISIALISASI':kind==='SMA'?'BOBOT ADAPTIF':cursor/config.iterations<=2/3?'EKSPLORASI':'EKSPLOITASI'}</span></div>`).join('');
  $('#iteration-number').textContent=String(cursor).padStart(2,'0');$('#iteration-total').textContent=`/ ${config.iterations} iterasi`;
  $('#timeline').max=simulation.latest;$('#timeline').value=cursor;$('#timeline-end').textContent=`${simulation.latest} terekam`;
  $('#step-button').disabled=dirty||(lesson.enabled?lesson.step===4&&simulation.finished:simulation.finished);
  $('#step-button').textContent=lesson.enabled?'Tahap berikutnya':'＋ Satu Iterasi';
  $('#playback-status').textContent=dirty?'Parameter berubah. Terapkan untuk memulai pencarian baru.':cursor<simulation.latest?`Memutar riwayat ${cursor}/${simulation.latest}. Tidak ada evaluasi baru hingga mencapai snapshot terbaru.`:simulation.finished?'Pencarian selesai. Geser timeline untuk memeriksa perjalanan kandidat.':cursor===0?'Siap. Populasi awal kedua algoritma identik.':`Iterasi ${cursor} · ${simulation.snapshot(active).parameters.clamped} koordinat di-clip pada ${active}.`;
  if(lesson.enabled)$('#playback-status').textContent=`Mode Belajar membaca iterasi ${cursor} yang sudah tercatat. Visual dan grafik menunjukkan ${lesson.step<4?'snapshot awal':'hasil akhir'} iterasi.`;
  drawMetrics();renderChart();renderSchedule();renderInspector();renderEducation();
  scene.setState({simulation,cursor,view,axes:[...axes],selected:{...selected},showTrails,showProposals,isolate:isolateSelected||lesson.enabled,showVMBounds:showVMBounds||lesson.enabled,lesson:{...lesson,algorithm:active},fitnessScale:simulation.fitnessScale});
}
function tick(now){
  if(!document.hidden){
    let progress=1,from=null;
    if(transition){progress=Math.min(1,(now-transition.start)/transition.duration);from=transition.from;if(progress>=1)transition=null;}
    if(playing&&!transition&&now-lastStep>=1000/speed){if(!advance())pause();else if(transition){progress=0;from=transition.from;}}
    scene.render(now,progress,from);
  }
  requestAnimationFrame(tick);
}
rebuildSelectors();updateURL();draw();pause();requestAnimationFrame(tick);
window.AlgorithmLab={get simulation(){return simulation;},get config(){return {...config};},get view(){return view;},get axes(){return [...axes];},get selected(){return {...selected};},get playing(){return playing;},get focusMode(){return focusMode;},get lesson(){return {...lesson};},scene,advance:()=>{pause();lesson.enabled=false;advance(false);},seek:index=>{pause();lesson.enabled=false;simulation.seek(index);draw();},setView,select:(kind,id)=>selectCandidate(kind,id,false),pause};
