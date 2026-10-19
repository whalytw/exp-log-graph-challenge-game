'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine.js');
const base={type:'exp',base:2,a:1,b:1,h:0,d:0,star:1};
test('all 1,200 questions have the intended transformations and a drawable domain',()=>{
 let count=0;
 for(let star=1;star<=5;star++)for(const q of E.questionPool(star,E.defaults.levels[star-1])){
  count++;assert.ok([2,3].includes(q.base));assert.equal([q.a!==1,q.b!==1,q.h!==0,q.d!==0].filter(Boolean).length,star-1);
  const path=E.targetPaths(q,120);assert.ok(path[0]?.length>30);assert.ok(E.length(path)>300);
  for(const p of path[0]){assert.ok(Number.isFinite(p.y));if(q.type==='log')assert.ok(p.x>q.h);}
  const cuts=Array.from({length:8},(_,i)=>E.helpBounds(i,q));
  for(let i=0;i<8;i++){assert.ok(cuts[i].max>cuts[i].min);assert.ok(E.helpPaths(q,[i])[0]?.length>1);if(i)assert.equal(cuts[i-1].max,cuts[i].min);}
 }assert.equal(count,1200);
});
test('transformations agree with known points, domains and base functions',()=>{
 assert.equal(E.evaluate(base,3),8);assert.equal(E.evaluate({...base,a:3,b:2,h:1,d:-2},2),10);
 const q={...base,type:'log',a:2,b:.5,h:-1,d:3};assert.equal(E.evaluate(q,3),5);assert.ok(Number.isNaN(E.evaluate(q,-1)));assert.ok(Number.isNaN(E.evaluate(q,-2)));
 assert.equal(E.evaluate(E.baseQuestion(q),4),2);assert.equal(E.evaluate({...base,base:3},2),9);
 assert.match(E.formula({...base,b:.5,h:2}),/<sup>/);assert.match(E.formula({...q}),/<sub>2<\/sub>/);
});
test('perfect curves, empty work, guidance-only work and independent rescue penalties',()=>{
 for(const type of ['exp','log'])for(const baseN of [2,3]){
  const q={...base,type,base:baseN,a:2,b:.5,h:1,d:-2},paths=E.targetPaths(q);
  assert.equal(E.score(q,paths).score,100);assert.equal(E.score(q,[]).score,0);assert.equal(E.score(q,[],[],true).score,0);
  for(let n=0;n<=3;n++)for(const baseline of [false,true]){
   const intervals=Array.from({length:n},(_,i)=>i*2),r=E.score(q,paths,intervals,baseline);
   assert.equal(r.score,Math.round(100*.8**(n+Number(baseline))));assert.equal(r.helpCount,n+Number(baseline));
  }
  const shifted=paths.map(s=>s.map(p=>({...p,y:p.y+4})));assert.ok(E.score(q,shifted).score<50);
  assert.ok(E.score(q,paths.concat([[{x:-5,y:8},{x:9,y:8}]])).score<95);
 }
});
test('rescue schedule is independent of usage; clipping cannot restore revealed ink',()=>{
 assert.equal(E.helpState(E.defaults,14.99).available,0);assert.equal(E.helpState(E.defaults,15).available,1);assert.equal(E.helpState(E.defaults,35,1).available,2);assert.equal(E.helpState(E.defaults,100,3).available,0);
 const q={...base,type:'log',h:2};const path=E.targetPaths(q),clipped=E.clipStrokes(path,[1,4,6],q);
 for(const s of clipped)for(const p of s)assert.ok(!E.isHelpX(p.x,[1,4,6],q));
 assert.ok(E.score(q,[],[0]).rawScore>0);assert.ok(E.score(q,[],[0]).rawScore<20);
});
test('teacher validation supports five levels and rejects unusable questions',()=>{
 assert.deepEqual(E.validate(E.defaults),[]);assert.equal(E.buildPlan(E.defaults).length,4);
 const s=E.clone(E.defaults);s.levels[4].transforms.pop();assert.ok(E.validate(s).length);s.levels[4].count=0;assert.deepEqual(E.validate(s),[]);
});
