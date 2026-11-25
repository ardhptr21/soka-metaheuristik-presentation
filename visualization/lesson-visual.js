import * as THREE from 'three';
import {projectPosition} from './model.js';

export const lessonColors={before:'#88dcff',rule:'#d6b5ff',raw:'#ffc279',clip:'#c4a1ff',accepted:'#adf0b5',rejected:'#ff91af'};
const p=(position,axes)=>new THREE.Vector3(...projectPosition(position,axes));

// All markers use recorded coordinates. Long arrows only indicate a direction;
// their truncated endpoints are explicitly labelled and never treated as a proposal.
export function lessonFrame(state,kind){
  if(!state.lesson?.enabled||state.lesson.algorithm!==kind)return null;
  const optimizer=state.simulation.optimizers[kind],detail=optimizer.trace[state.cursor].updates[state.selected[kind]];
  if(!detail)return null;
  const step=state.lesson.step,axes=state.axes,before=p(detail.before,axes),raw=p(detail.rawProposal,axes),clip=p(detail.proposal,axes),after=p(detail.after,axes);
  const color=[lessonColors.before,lessonColors.rule,lessonColors.raw,lessonColors.clip,detail.accepted?lessonColors.accepted:lessonColors.rejected][step];
  const markers=[],arrows=[],focusPoints=[before.clone()];
  const marker=(name,position,tint,type='ring')=>{const existing=markers.find(item=>item.position.distanceTo(position)<.03);if(existing){existing.name+=` / ${name}`;return;}markers.push({name,position,color:tint,type});focusPoints.push(position.clone());};
  const arrow=(start,end,tint,dashed=false)=>{if(start.distanceTo(end)>.015)arrows.push({start,end,color:tint,dashed});};
  const toward=(origin,target)=>origin.clone().add(target.clone().sub(origin).clampLength(0,8));
  const rawOutside=axes.some(d=>detail.rawProposal[d]<0||detail.rawProposal[d]>1);
  const clippedAxes=axes.filter(d=>detail.rawProposal[d]!==detail.proposal[d]);
  const sameProjection=before.distanceTo(step===2?raw:step===4?after:clip)<1e-6;
  if(step===0){
    marker('POSISI AWAL',before,lessonColors.before);
    const floor=before.clone();floor.y=.8;arrow(floor,before,lessonColors.before,true);
  }else if(step===1){
    marker('KANDIDAT',before,lessonColors.before);
    const source=(name,position,tint)=>{const point=p(position,axes);marker(name,point,tint,'source');arrow(point,before,tint,true);};
    if(kind==='AO'){
      source('BEST',detail.bestUsed,'#ffdd8b');
      if(['X1','X3'].includes(detail.branch))source('MEAN',detail.mean,'#99dfda');
      if(detail.branch==='X2')source('ACAK R',detail.randomPosition,'#b5c6ff');
    }else if(detail.branch==='campuran'){
      if(axes.some(d=>detail.dimensions[d].branch==='mendekat')){
        const previous=optimizer.trace[state.cursor-1];
        source('BEST',detail.bestUsed,'#ffdd8b');source(`A${detail.A+1}`,previous.population[detail.A].position,'#99dfda');source(`B${detail.B+1}`,previous.population[detail.B].position,'#b5c6ff');
      }
      if(axes.some(d=>detail.dimensions[d].branch==='kontraksi'))source('ASAL · 0',detail.before.map(()=>0),'#d6b5ff');
    }
  }else if(step===2){
    marker('AWAL',before,lessonColors.before);
    const end=toward(before,raw),truncated=end.distanceTo(raw)>.01;
    arrow(before,end,lessonColors.raw);
    marker(truncated?'ARAH MENTAH ↗':'MENTAH',end,lessonColors.raw,truncated?'direction':'ring');
  }else if(step===3){
    marker('AWAL',before,lessonColors.before);
    marker('HASIL CLIP',clip,lessonColors.clip);
    if(raw.distanceTo(clip)>.015){
      const start=toward(clip,raw),truncated=start.distanceTo(raw)>.01;
      marker(truncated?'DARI LUAR BATAS':'MENTAH',start,lessonColors.raw,truncated?'direction':'ring');
      arrow(start,clip,lessonColors.clip);
    }else arrow(before,clip,lessonColors.clip);
  }else{
    if(detail.accepted){marker('AWAL',before,lessonColors.before);marker('✓ DITERAPKAN',after,lessonColors.accepted,'result');arrow(before,after,lessonColors.accepted);}
    else{marker('✕ DITOLAK',clip,lessonColors.rejected,'cross');arrow(before,clip,lessonColors.rejected,true);arrow(clip,before,lessonColors.before);marker('TETAP DI AWAL',before,lessonColors.before,'result');}
  }
  const title=['Posisi awal','Masukan aturan','Proposal mentah','Clip ke [0, 1]',detail.accepted?'Posisi baru diterapkan':'Proposal ditolak'][step];
  let note=[
    'Penanda biru menunjukkan kandidat sebelum pembaruan.',
    'Garis putus-putus = masukan rumus, bukan lintasan gerak.',
    rawOutside?'Proposal berada di luar kubus. Panah jingga menunjukkan arah sebenarnya.':'Panah jingga menghubungkan posisi awal dengan proposal mentah.',
    clippedAxes.length?`${clippedAxes.length} sumbu yang terlihat dipotong ke batas. Panah ungu menunjukkan hasilnya.`:'Tidak ada clip pada sumbu yang terlihat: posisi mentah dan hasil clip berimpit.',
    detail.accepted?'Panah hijau = perpindahan yang diterapkan. Penanda biru menyimpan posisi awal.':'Tanda silang = proposal ditolak. Panah biru kembali ke posisi awal.'
  ][step];
  if(step===1&&kind==='SMA'&&detail.branch==='acak')note='Restart acak: koordinat baru disampel dari [0, 1], tanpa kandidat sumber.';
  if(sameProjection&&step>=2)note+=step===4&&!detail.accepted?' Kandidat memang tetap di awal.':' Posisi berimpit pada proyeksi ini; lihat nilai koordinat.';
  return {step,detail,before,raw,clip,after,color,markers,arrows,focusPoints,title,note,rawOutside,clippedAxes,sameProjection};
}

export function buildLessonGeometry(group,frame,makeLabel){
  group.userData.frame=frame;
  if(!frame)return;
  const material=color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.95,depthTest:false,depthWrite:false});
  for(const item of frame.markers){
    const marker=new THREE.Group();marker.name=item.name;marker.position.copy(item.position);marker.renderOrder=10;
    if(item.type==='cross'){
      for(const sign of [-1,1]){const bar=new THREE.Mesh(new THREE.BoxGeometry(.75,.065,.065),material(item.color));bar.rotation.z=sign*Math.PI/4;marker.add(bar);}
    }else if(item.type==='source'||item.type==='direction'){
      marker.add(new THREE.Mesh(new THREE.OctahedronGeometry(.19,0),material(item.color)));
    }else{
      for(const angle of [0,Math.PI/2]){const ring=new THREE.Mesh(new THREE.TorusGeometry(item.type==='result'?.51:.43,.025,6,48),material(item.color));ring.rotation.x=angle;marker.add(ring);}
    }
    const text=makeLabel(item.name,item.color,2.15);text.position.y=item.type==='result'?.95:.68;marker.add(text);group.add(marker);
  }
  for(const item of frame.arrows){
    const delta=item.end.clone().sub(item.start),length=delta.length(),direction=delta.clone().normalize();
    const gap=Math.min(.48,length*.2),tip=item.end.clone().addScaledVector(direction,-gap),shaftLength=Math.max(.01,length-gap-.27);
    if(item.dashed){
      const path=new THREE.Line(new THREE.BufferGeometry().setFromPoints([item.start,item.end]),new THREE.LineDashedMaterial({color:item.color,dashSize:.15,gapSize:.1,depthTest:false,transparent:true,opacity:.85}));path.computeLineDistances();group.add(path);
    }else{
      const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,shaftLength,8),material(item.color));shaft.position.copy(item.start).addScaledVector(direction,shaftLength/2);shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);group.add(shaft);
    }
    const head=new THREE.Mesh(new THREE.ConeGeometry(Math.min(.17,length*.16),Math.min(.38,length*.4),10),material(item.color));head.position.copy(tip).addScaledVector(direction,-Math.min(.19,length*.2));head.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);group.add(head);
  }
}
