import test from 'node:test';
import assert from 'node:assert/strict';
import {pixelRatioFor,ResolutionGovernor} from '../src/render-budget.js';
test('resolution stays bounded across desktop/mobile density and adapts without changing the viewport',()=>{
 for(const [w,h] of [[390,844],[1100,760],[1920,1080],[3840,2160]])for(const mobile of [true,false])for(const dpr of [1,2,3]){
  const ratio=pixelRatioFor(w,h,dpr,mobile);
  assert.ok(ratio<=dpr&&ratio<=1.75);assert.ok(w*h*ratio**2<=1200000+1);
  assert.ok(pixelRatioFor(w,h,dpr,mobile,.5)<ratio);
 }
});
test('sustained expensive frames lower resolution, isolated outliers do not; recovery is bounded and gradual',()=>{
 const g=new ResolutionGovernor();for(let i=0;i<12;i++)g.observe(i===0?800:12);assert.equal(g.scale,1);
 for(let i=0;i<120;i++)g.observe(80);assert.equal(g.scale,.5);
 for(let i=0;i<95;i++)g.observe(10);assert.equal(g.scale,.5);
 g.observe(10);assert.ok(g.scale>.5&&g.scale<1);
 for(let i=0;i<1200;i++)g.observe(10);assert.equal(g.scale,1);
 const old=g.scale;for(const x of [NaN,Infinity,-1])assert.equal(g.observe(x),false);assert.equal(g.scale,old);
});
