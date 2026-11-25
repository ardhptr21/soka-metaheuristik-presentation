import {E} from './model.js';

export const stages=['Posisi awal','Aturan pembaruan','Proposal mentah','Clip & evaluasi','Keputusan'];
export const fmt=(value,digits=3)=>Number(value).toLocaleString('id-ID',{minimumFractionDigits:digits,maximumFractionDigits:digits});
export const signed=(value,digits=3)=>`${value>1e-10?'+':value< -1e-10?'−':''}${fmt(Math.abs(value),digits)}`;
export function transitionData(optimizer,snapshot,id){
  const candidate=snapshot.population[id],detail=snapshot.updates[id];
  const evaluate=position=>E.evaluate(E.decode(position,optimizer.vms.length),optimizer.tasks,optimizer.vms);
  const before=evaluate(detail?.before||candidate.position),proposal=evaluate(detail?.proposal||candidate.position),after=evaluate(candidate.position);
  const changes=assignment=>before.assignment.flatMap((vm,i)=>vm===assignment[i]?[]:[{task:i+1,from:vm,to:assignment[i]}]);
  return {candidate,detail,before,proposal,after,proposedChanges:changes(proposal.assignment),changes:changes(after.assignment),
    delta:detail?detail.afterScore-detail.beforeScore:0,clipped:detail?detail.rawProposal.filter((v,i)=>v!==detail.proposal[i]).length:0};
}
export function frameCursor(cursor,lesson){return lesson.enabled&&lesson.step<4?Math.max(0,cursor-1):cursor;}
export function describeUpdate(detail,axes){
  if(!detail)return 'Populasi awal acak';
  if(detail.branch==='acak')return 'SMA · eksplorasi acak';
  if(detail.branch==='campuran'){
    const counts=axes.reduce((a,d)=>{const branch=detail.dimensions[d].branch;a[branch]=(a[branch]||0)+1;return a;},{});
    return `SMA · ${counts.mendekat||0} mendekat / ${counts.kontraksi||0} kontraksi pada sumbu terpilih`;
  }
  return `AO · ${detail.branch} · ${['X1','X2'].includes(detail.branch)?'eksplorasi':'eksploitasi'}`;
}
export function learningDescription(step,data,algorithm,axes,m){
  const d=data.detail;
  if(!d)return 'Pilih satu iterasi untuk memeriksa pembaruan kandidat.';
  if(step===0)return `Kandidat dimulai dengan fitness ${fmt(d.beforeScore,5)}. Satu vektor memuat penempatan seluruh tugas. Kandidat lain dibekukan pada snapshot awal iterasi.`;
  if(step===1)return `${describeUpdate(d,axes)}. ${algorithm==='SMA'&&d.branch==='campuran'?`Individu A${d.A+1}, B${d.B+1}, serta arsip terbaik menjadi masukan cabang mendekat.`:'Koefisien yang tercatat digunakan untuk menghitung proposal.'}`;
  if(step===2)return `Proposal mentah pada sumbu X/Y/Z: ${axes.map(i=>fmt(d.rawProposal[i],5)).join(' / ')}. ${data.clipped?`${data.clipped} dari ${d.rawProposal.length} koordinat melewati [0, 1]. Penanda batas membantu menemukan arah proposal yang berada di luar kubus.`:'Seluruh koordinat berada dalam [0, 1].'} Fitness baru dihitung setelah clip.`;
  if(step===3)return `Setelah clip, decoder min(${m-1}, floor(${m} × x)) menghasilkan indeks VM 0–${m-1}. Proposal mengubah ${data.proposedChanges.length} penempatan tugas dengan fitness ${fmt(d.proposalScore,5)}. Jadwal di bawah adalah pratinjau proposal, sebelum keputusan penerimaan.`;
  if(!d.accepted)return `AO menolak proposal karena f ${fmt(d.proposalScore,5)} tidak lebih kecil dari ${fmt(d.beforeScore,5)}. Posisi dan penempatan awal dipertahankan.`;
  if(algorithm==='SMA')return `SMA menerapkan posisi baru. Fitness ${data.delta< -1e-10?'membaik':data.delta>1e-10?'memburuk':'tetap'} (${signed(data.delta,5)}). Arsip terbaik disimpan terpisah, sehingga individu dapat memburuk tanpa memperburuk arsip.`;
  return `AO menerima proposal karena f turun dari ${fmt(d.beforeScore,5)} menjadi ${fmt(d.afterScore,5)}. ${data.changes.length} penempatan tugas berubah.`;
}
export function movementSummary(data,preview=false){
  const changes=preview?data.proposedChanges:data.changes;
  if(!data.detail)return 'Belum ada perubahan penempatan.';
  if(!preview&&!data.detail.accepted)return `✕ Proposal ditolak. ${data.proposedChanges.length} usulan perpindahan dibatalkan, jadwal tetap.`;
  if(!changes.length)return 'Penempatan tetap. Perubahan posisi di dalam interval VM yang sama tidak memindahkan tugas.';
  return changes.slice(0,3).map(change=>`T${change.task}: VM ${change.from+1} → VM ${change.to+1}`).join(' · ')+(changes.length>3?` · +${changes.length-3} tugas`:'');
}
