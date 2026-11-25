/* Laboratorium pendidikan. Adaptasi kontinu SMA/AO dengan decoder VM diskret.
   SMA: Li et al. (2020), doi:10.1016/j.future.2020.03.055.
   AO: Abualigah et al. (2021), doi:10.1016/j.cie.2021.107250, persamaan 3–17.
   Tidak bergantung pada implementasi atau hasil eksperimen lain. */
(function (root) {
  'use strict';
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  function random(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let t = Math.imul(state ^ state >>> 15, 1 | state);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const machines = [
    {name: 'VM 1', speed: 1000, rate: 0.010},
    {name: 'VM 2', speed: 1600, rate: 0.022},
    {name: 'VM 3', speed: 2400, rate: 0.048},
    {name: 'VM 4', speed: 3200, rate: 0.080}
  ];
  function workload(n = 12, seed = 42, mode = 'campuran') {
    const rng = random(seed ^ 0xA53A5F71);
    return Array.from({length: n}, (_, i) => ({
      id: i + 1,
      length: mode === 'seragam' ? 6000 : mode === 'berat' ?
        (i % 4 === 0 ? 18000 : 2000 + Math.floor(rng() * 5) * 1000) :
        (2 + Math.floor(rng() * 13)) * 1000
    }));
  }
  function decode(x, m) { return x.map(v => Math.min(m - 1, Math.floor(clamp(v) * m))); }
  function evaluate(assignment, tasks, vms) {
    const loads = vms.map(() => 0);
    let cost = 0;
    const bars = tasks.map((task, i) => {
      const vm = assignment[i], duration = task.length / vms[vm].speed;
      const start = loads[vm], end = start + duration;
      loads[vm] = end;
      cost += duration * vms[vm].rate;
      return {task: task.id, vm, start, end, duration};
    });
    const makespan = Math.max(...loads);
    return {assignment: [...assignment], loads, bars, makespan, cost,
      utilization: loads.reduce((a, b) => a + b, 0) / (vms.length * makespan)};
  }
  function objective(evaluation, baseline, weight) {
    return weight * evaluation.makespan / baseline.makespan +
      (1 - weight) * evaluation.cost / baseline.cost;
  }
  function roundRobin(tasks, vms) { return evaluate(tasks.map((_, i) => i % vms.length), tasks, vms); }
  // Earliest Finish Time, urutan tugas tetap seperti input.
  function eft(tasks, vms) {
    const loads = vms.map(() => 0);
    return evaluate(tasks.map(task => {
      const finish = vms.map((vm, j) => loads[j] + task.length / vm.speed);
      const index = finish.indexOf(Math.min(...finish));
      loads[index] = finish[index];
      return index;
    }), tasks, vms);
  }
  function normal(rng) {
    return Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(2 * Math.PI * rng());
  }
  // Mantegna, beta=1.5, sigma=0.6965745026, skala 0.01.
  function levy(rng) { return 0.01 * 0.6965745026 * normal(rng) / Math.pow(Math.max(1e-12, Math.abs(normal(rng))), 1 / 1.5); }
  class Optimizer {
    constructor(algorithm, options = {}) {
      this.algorithm = algorithm;
      this.options = {n: 12, m: 3, population: 24, iterations: 60, seed: 42, weight: 0.6, mode: 'campuran', captureDetails: false, ...options};
      const o = this.options;
      if (!['SMA', 'AO'].includes(algorithm)) throw new Error('Algoritma tidak dikenal');
      this.tasks = workload(o.n, o.workloadSeed ?? o.seed, o.mode);
      this.vms = machines.slice(0, o.m);
      this.baseline = roundRobin(this.tasks, this.vms);
      this.greedy = eft(this.tasks, this.vms);
      const initRng = random(o.seed ^ 0xBD1423);
      this.rng = random(o.seed ^ (algorithm === 'SMA' ? 0x102030 : 0x405060));
      this.population = Array.from({length: o.population}, () => Array.from({length: o.n}, () => initRng()));
      this.evaluations = 0;
      this.scores = this.population.map(x => this.score(x));
      const i = this.scores.indexOf(Math.min(...this.scores));
      this.best = [...this.population[i]];
      this.bestScore = this.scores[i];
      this.iteration = 0;
      this.trace = [];
      this.record({awal: o.population});
    }
    score(x) {
      this.evaluations++;
      return objective(evaluate(decode(x, this.vms.length), this.tasks, this.vms), this.baseline, this.options.weight);
    }
    step() {
      if (this.iteration >= this.options.iterations) return false;
      const t = this.iteration + 1, T = this.options.iterations, q = t / T;
      const rng = this.rng, N = this.population.length, D = this.tasks.length;
      const old = this.population.map(x => [...x]);
      const beforeScores = [...this.scores], best = [...this.best];
      const ranked = [...Array(N).keys()].sort((a, b) => beforeScores[a] - beforeScores[b]);
      const ranks = Array(N); ranked.forEach((i, rank) => { ranks[i] = rank; });
      const bF = beforeScores[ranked[0]], wF = beforeScores[ranked[N - 1]];
      const mean = Array.from({length: D}, (_, d) => old.reduce((s, x) => s + x[d], 0) / N);
      const branches = this.algorithm === 'SMA' ? {acak: 0, mendekat: 0, kontraksi: 0} : {X1: 0, X2: 0, X3: 0, X4: 0};
      const a = Math.atanh(1 - q), b = 1 - q;
      const g1 = 2 * rng() - 1, g2 = 2 * (1 - q);
      const quality = Math.pow(t, (2 * rng() - 1) / Math.pow(1 - T, 2));
      const r1 = 1 + Math.floor(rng() * 20);
      let accepted = 0, clamped = 0;
      const updates = this.options.captureDetails ? [] : null;
      for (let i = 0; i < N; i++) {
        let proposal, branch;
        const detail = updates ? {id:i, before:[...old[i]], beforeScore:beforeScores[i], bestUsed:[...best], mean:[...mean], dimensions:[]} : null;
        if (this.algorithm === 'SMA') {
          if (rng() < 0.03) {
            proposal = Array.from({length: D}, () => rng());
            branches.acak++;
            if(detail)detail.branch='acak';
          } else {
            const p = Math.tanh(Math.abs(beforeScores[i] - this.bestScore));
            const A = Math.floor(rng() * N), B = Math.floor(rng() * N);
            const ratio = wF === bF ? 0 : (bF - beforeScores[i]) / (bF - wF);
            if(detail)Object.assign(detail,{branch:'campuran',p,A,B,rank:ranks[i],bestScoreUsed:this.bestScore});
            proposal = old[i].map((value, d) => {
              const W = 1 + (ranks[i] < N / 2 ? 1 : -1) * rng() * Math.log10(1 + ratio);
              const vb = (2 * rng() - 1) * a, vc = (2 * rng() - 1) * b;
              const decision = rng();
              if(detail)detail.dimensions.push({d,W,vb,vc,r:decision,branch:decision<p?'mendekat':'kontraksi',xA:old[A][d],xB:old[B][d]});
              if (decision < p) { branches.mendekat++; return best[d] + vb * (W * old[A][d] - old[B][d]); }
              branches.kontraksi++;
              return vc * value;
            });
          }
        } else {
          branch = q <= 2 / 3 ? (rng() < 0.5 ? 'X1' : 'X2') : (rng() < 0.5 ? 'X3' : 'X4');
          branches[branch]++;
          const R = old[Math.floor(rng() * N)];
          if(detail)Object.assign(detail,{branch,randomPosition:[...R],g1,g2,quality,r1});
          proposal = old[i].map((value, d) => {
            if (branch === 'X1') {
              const r=rng();if(detail)detail.dimensions.push({d,r});
              return best[d] * (1 - q) + (mean[d] - best[d] * r);
            }
            if (branch === 'X2') {
              const radius = r1 + 0.00565 * (d + 1), theta = -0.005 * (d + 1) + 3 * Math.PI / 2;
              const y = radius * Math.cos(theta), x = radius * Math.sin(theta);
              const L=levy(rng),r=rng();if(detail)detail.dimensions.push({d,L,r,x,y,radius,theta});
              return best[d] * L + R[d] + (y - x) * r;
            }
            if (branch === 'X3') {
              const r=rng(),r2=rng();if(detail)detail.dimensions.push({d,r,r2});
              return (best[d] - mean[d]) * 0.1 - r + r2 * 0.1;
            }
            const r=rng(),L=levy(rng),r2=rng();if(detail)detail.dimensions.push({d,r,L,r2});
            return quality * best[d] - g1 * value * r - g2 * L + r2 * g1;
          });
        }
        if(detail)detail.rawProposal=[...proposal];
        proposal = proposal.map(v => { if (v < 0 || v > 1) clamped++; return clamp(v); });
        const score = this.score(proposal);
        if(detail)Object.assign(detail,{proposal:[...proposal],proposalScore:score,accepted:this.algorithm==='SMA'||score<beforeScores[i]});
        // SMA mengganti posisi. AO menerima proposal yang membaik (greedy).
        if (this.algorithm === 'SMA' || score < beforeScores[i]) {
          this.population[i] = proposal;
          this.scores[i] = score;
          accepted++;
        }
        if (score < this.bestScore) { this.bestScore = score; this.best = [...proposal]; }
        if(detail){detail.after=[...this.population[i]];detail.afterScore=this.scores[i];updates.push(detail);}
      }
      this.iteration = t;
      this.record(branches, {accepted, clamped, a, b, g1, g2}, updates);
      return true;
    }
    record(branches, parameters = {}, updates = null) {
      const solution = evaluate(decode(this.best, this.vms.length), this.tasks, this.vms);
      const diversity = new Set(this.population.map(x => decode(x, this.vms.length).join(','))).size;
      this.trace.push({iteration: this.iteration, score: this.bestScore, ...solution, branches, parameters,
        evaluations: this.evaluations, diversity,
        population: this.population.map((x, i) => ({x: x[0], y: x[1], score: this.scores[i],
          ...(this.options.captureDetails?{id:i,position:[...x],assignment:decode(x,this.vms.length)}:{})})),
        ...(this.options.captureDetails?{bestPosition:[...this.best],updates:updates||[]}:{})});
    }
    finish() { while (this.step()) { /* bounded by T */ } return this.trace.at(-1); }
  }
  function compare(options) {
    const sma = new Optimizer('SMA', options), ao = new Optimizer('AO', options);
    sma.finish(); ao.finish();
    return {sma, ao};
  }
  function exact(tasks, vms, weight, baseline) {
    if (tasks.length > 8 || vms.length > 3) throw new Error('Enumerasi dibatasi ke 8 tugas dan 3 VM');
    const total = Math.pow(vms.length, tasks.length);
    let bestScore = Infinity, best;
    for (let mask = 0; mask < total; mask++) {
      let k = mask;
      const assignment = tasks.map(() => { const j = k % vms.length; k = Math.floor(k / vms.length); return j; });
      const result = evaluate(assignment, tasks, vms), f = objective(result, baseline, weight);
      if (f < bestScore) { bestScore = f; best = result; }
    }
    return {score: bestScore, ...best, evaluations: total};
  }
  const api = {random, machines, workload, decode, evaluate, objective, roundRobin, eft, Optimizer, compare, exact};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SchedulingLab = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
