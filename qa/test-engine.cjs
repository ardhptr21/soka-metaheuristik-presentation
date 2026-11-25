const assert=require('node:assert/strict');
const E=require('../engine.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
// Worked example independently checked from the slide's six lengths.
const tasks=[4000,6000,8000,3000,9000,5000].map((length,i)=>({id:i+1,length}));
const rr=E.roundRobin(tasks,E.machines.slice(0,3));
near(rr.makespan,9.375);near(rr.cost,.53625);
assert.deepEqual(E.decode([0,1/3,2/3,1,-1,2],3),[0,1,2,2,0,2]);
near(E.objective(rr,rr,.6),1);
for(const m of [2,3,4])for(const weight of [0,.6,1]){
  const options={n:12,m,population:12,iterations:30,seed:42,weight};
  const a=new E.Optimizer('SMA',options),b=new E.Optimizer('AO',options);
  assert.deepEqual(a.population,b.population);
  const firstA=a.bestScore;
  a.finish();b.finish();
  for(const optimizer of [a,b]){
    assert.equal(optimizer.evaluations,12*31);
    for(let i=1;i<optimizer.trace.length;i++)assert.ok(optimizer.trace[i].score<=optimizer.trace[i-1].score+1e-12);
    for(const row of optimizer.trace){
      assert.ok(Number.isFinite(row.score));
      assert.ok(row.assignment.every(j=>j>=0&&j<m&&Number.isInteger(j)));
      near(row.makespan,Math.max(...row.loads));
      const evaluated=E.evaluate(row.assignment,optimizer.tasks,optimizer.vms);
      near(row.cost,evaluated.cost);near(row.score,E.objective(evaluated,optimizer.baseline,weight));
      assert.equal(row.bars.length,12);
      for(let vm=0;vm<m;vm++){
        const bars=row.bars.filter(r=>r.vm===vm);
        for(let k=1;k<bars.length;k++)near(bars[k].start,bars[k-1].end);
      }
    }
    assert.equal(optimizer.step(),false);
  }
  for(const row of b.trace.slice(1)){
    const branch=row.branches;
    assert.equal(branch.X1+branch.X2+branch.X3+branch.X4,12);
    if(row.iteration<=20)assert.equal(branch.X3+branch.X4,0);
    else assert.equal(branch.X1+branch.X2,0);
  }
  const again=new E.Optimizer('SMA',options);again.finish();assert.deepEqual(again.trace,a.trace);
  near(a.trace[0].score,firstA);
}
const base={n:6,m:3,seed:42,weight:.6,population:24,iterations:60};
const s=new E.Optimizer('SMA',base),a=new E.Optimizer('AO',base),exact=E.exact(s.tasks,s.vms,.6,s.baseline);
assert.equal(exact.evaluations,729);
assert.ok(s.finish().score>=exact.score-1e-12);assert.ok(a.finish().score>=exact.score-1e-12);
const fixed1=new E.Optimizer('SMA',{...base,seed:1,workloadSeed:42});
const fixed2=new E.Optimizer('SMA',{...base,seed:2,workloadSeed:42});
assert.deepEqual(fixed1.tasks,fixed2.tasks);assert.notDeepEqual(fixed1.population,fixed2.population);
console.log('PASS: evaluator, decoder, deterministic seeds, fixed workload, budget, monotonic archive, AO phases, feasibility, non-overlap, exact lower bound.');
console.log(JSON.stringify({default6:{exact:exact.score,SMA:s.bestScore,AO:a.bestScore}},null,2));
