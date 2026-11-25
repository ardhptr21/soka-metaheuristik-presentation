import '../engine.js';
export const E=globalThis.SchedulingLab;
export const defaults={n:12,m:3,population:24,iterations:60,seed:42,workloadSeed:42,weight:.6,mode:'campuran'};
export function parseConfiguration(search=''){
  const params=new URLSearchParams(search),config={...defaults};
  for(const [key,allowed] of Object.entries({n:[6,12,18,24],m:[2,3,4],population:[12,24,40],iterations:[30,60,120]})){
    const value=Number(params.get(key));if(allowed.includes(value))config[key]=value;
  }
  for(const key of ['seed','workloadSeed']){const value=Number(params.get(key));if(params.has(key)&&Number.isInteger(value)&&value>=0&&value<=2147483647)config[key]=value;}
  const weight=Number(params.get('weight'));if(params.has('weight')&&Number.isFinite(weight)&&weight>=0&&weight<=1)config.weight=weight;
  const mode=params.get('mode');if(['campuran','seragam','berat'].includes(mode))config.mode=mode;
  const view=['sma','ao','compare'].includes(params.get('view'))?params.get('view'):'sma';
  const requested=Number(params.get('returnSlide'));
  const returnSlide=Number.isInteger(requested)&&requested>=1&&requested<=28?requested:21;
  return {config,view,returnSlide};
}
export function configurationQuery(config,view,returnSlide){const params=new URLSearchParams({view,returnSlide:String(returnSlide)});for(const key of Object.keys(defaults))params.set(key,String(config[key]));return params.toString();}
export function projectPosition(position,axes=[0,1,2]){return [(position[axes[0]]-.5)*8,.8+position[axes[1]]*6,(position[axes[2]]-.5)*8];}
export class Simulation {
  constructor(config){
    this.config={...config};this.optimizers={SMA:new E.Optimizer('SMA',{...config,captureDetails:true}),AO:new E.Optimizer('AO',{...config,captureDetails:true})};this.cursor=0;
    const scores=Object.values(this.optimizers).flatMap(optimizer=>optimizer.scores);
    const min=Math.max(0,Math.floor(Math.min(...scores)*.8*10)/10);
    this.fitnessScale=Object.freeze({min,max:Math.max(1,min+.3,Math.ceil(Math.max(...scores)*1.1*10)/10)});
  }
  get latest(){return this.optimizers.SMA.iteration;}
  get finished(){return this.cursor>=this.config.iterations;}
  advance(){if(this.cursor<this.latest){this.cursor++;return true;}if(this.finished)return false;this.optimizers.SMA.step();this.optimizers.AO.step();this.cursor++;return true;}
  seek(cursor){this.cursor=Math.max(0,Math.min(this.latest,Math.trunc(cursor)));}
  snapshot(algorithm,cursor=this.cursor){return this.optimizers[algorithm].trace[cursor];}
}
