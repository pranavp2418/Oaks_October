// Resolution changes affect only rendering; project positions and scene geometry stay stable.
export function pixelRatioFor(width,height,dpr=1,mobile=false,scale=1) {
  const area=Math.max(1,width)*Math.max(1,height);
  const ratio=Math.min(Math.max(.5,dpr),mobile?1.5:1.75,Math.sqrt(1200000/area));
  return Math.max(.35,ratio*Math.max(.5,Math.min(1,scale)));
}
export class ResolutionGovernor {
  scale=1; samples=[]; stable=0;
  observe(milliseconds) {
    if(!Number.isFinite(milliseconds)||milliseconds<0)return false;
    this.samples.push(milliseconds);if(this.samples.length<12)return false;
    const samples=this.samples.sort((a,b)=>a-b),p75=samples[Math.floor(samples.length*.75)];this.samples=[];
    const old=this.scale;
    if(p75>30){this.scale=Math.max(.5,this.scale*.8);this.stable=0;}
    else if(p75<14){if(++this.stable>=8){this.scale=Math.min(1,this.scale/.9);this.stable=0;}}
    else this.stable=0;
    return old!==this.scale;
  }
}
