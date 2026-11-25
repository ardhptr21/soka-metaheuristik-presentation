const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../engine.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const prior=JSON.parse(fs.readFileSync(path.join(__dirname,'golden-engine.json'),'utf8'));
for(const golden of prior){
  const plain=new E.Optimizer(golden.algorithm,golden.options),captured=new E.Optimizer(golden.algorithm,{...golden.options,captureDetails:true});plain.finish();captured.finish();
  assert.deepEqual(plain.trace.map(s=>({score:s.score,assignment:s.assignment,evaluations:s.evaluations,branches:s.branches})),golden.trace,'Existing optimizer results must remain unchanged');
  assert.deepEqual(plain.population,captured.population);assert.equal(plain.evaluations,captured.evaluations);
  for(let t=0;t<plain.trace.length;t++){
    const a=plain.trace[t],b=captured.trace[t];near(a.score,b.score);assert.deepEqual(a.assignment,b.assignment);assert.equal(b.bestPosition.length,golden.options.n);assert.deepEqual(E.decode(b.bestPosition,golden.options.m),b.assignment);
    for(const candidate of b.population){assert.equal(candidate.position.length,golden.options.n);assert.deepEqual(candidate.assignment,E.decode(candidate.position,golden.options.m));const result=E.evaluate(candidate.assignment,captured.tasks,captured.vms);near(E.objective(result,captured.baseline,captured.options.weight),candidate.score);}
    if(!t)continue;
    for(const update of b.updates){
      assert.deepEqual(update.before,captured.trace[t-1].population[update.id].position);
      assert.deepEqual(update.after,b.population[update.id].position);
      assert.deepEqual(update.proposal,update.rawProposal.map(v=>Math.max(0,Math.min(1,v))));
      const result=E.evaluate(E.decode(update.proposal,captured.vms.length),captured.tasks,captured.vms);near(update.proposalScore,E.objective(result,captured.baseline,captured.options.weight));
      assert.equal(update.accepted,golden.algorithm==='SMA'||update.proposalScore<update.beforeScore);
      if(!update.accepted)assert.deepEqual(update.after,update.before);
      for(const coeff of update.dimensions){
        const d=coeff.d,x=update.before[d],best=update.bestUsed[d],mean=update.mean[d];let expected;
        if(update.branch==='campuran')expected=coeff.branch==='mendekat'?best+coeff.vb*(coeff.W*coeff.xA-coeff.xB):coeff.vc*x;
        if(update.branch==='X1')expected=best*(1-t/captured.options.iterations)+(mean-best*coeff.r);
        if(update.branch==='X2')expected=best*coeff.L+update.randomPosition[d]+(coeff.y-coeff.x)*coeff.r;
        if(update.branch==='X3')expected=(best-mean)*.1-coeff.r+coeff.r2*.1;
        if(update.branch==='X4')expected=update.quality*best-update.g1*x*coeff.r-update.g2*coeff.L+coeff.r2*update.g1;
        near(expected,update.rawProposal[d]);
      }
    }
  }
}
console.log('PASS: 18 golden runs unchanged; captured coordinates, proposal formulas, fitness, clipping, acceptance, and budgets verified.');
