'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine.js');
const base={type:'exp',base:2,a:1,b:1,h:0,d:0,star:1};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('all 4,800 questions use supported bases, correct transformations and drawable curves',()=>{
 let count=0;
 for(let star=1;star<=5;star++)for(const q of E.questionPool(star,E.defaults.levels[star-1],E.baseOptions)){
  count++;assert.ok(E.baseOptions.includes(q.base));assert.equal([q.a!==1,q.b!==1,q.h!==0,q.d!==0].filter(Boolean).length,star-1);
  const path=E.targetPaths(q,120);assert.ok(path[0]?.length>30);assert.ok(E.length(path)>250);
  for(const p of path[0]){assert.ok(Number.isFinite(p.y));if(q.type==='log')assert.ok(p.x>=q.h);}
 }assert.equal(count,4800);
});
test('known points and fractional-base formulas agree with exponential/logarithmic laws',()=>{
 assert.equal(E.evaluate(base,3),8);assert.equal(E.evaluate({...base,a:3,b:2,h:1,d:-2},2),10);
 for(const b of E.baseOptions){const q={...base,base:b};near(E.evaluate(q,1),b);near(E.evaluate(q,-1),1/b);near(E.evaluate({...q,type:'log'},b),1);near(E.evaluate({...q,type:'log'},1/b),-1);}
 const q={...base,type:'log',a:2,b:.5,h:-1,d:3};assert.equal(E.evaluate(q,3),5);assert.ok(Number.isNaN(E.evaluate(q,-1)));assert.ok(Number.isNaN(E.evaluate(q,-2)));
 assert.equal(E.evaluate(E.baseQuestion(q),4),2);
 assert.match(E.formula({...base,b:.5,h:2}),/<sup>/);assert.match(E.formula({...base,base:1/3}),/\(<span class="frac">.*<span>3<\/span>.*\)<sup>/);assert.ok(!E.formula({...base,base:1/3}).includes('0.333'));
 assert.match(E.formula({...q,base:1/10}),/<sub class="log-base">.*<span>10<\/span>/);
});
test('perfect, blank, inaccurate and assisted work are scored consistently for all eight bases',()=>{
 for(const type of ['exp','log'])for(const baseN of E.baseOptions){
  const q={...base,type,base:baseN,a:2,b:.5,h:1,d:-2},paths=E.targetPaths(q);
  assert.equal(E.score(q,paths).score,100);assert.equal(E.score(q,[]).score,0);assert.equal(E.score(q,[],[],true).score,0);
  const candidates=E.availableHelpIntervals(q);assert.ok(candidates.length>=3);
  for(let n=0;n<=3;n++)for(const baseline of [false,true]){const r=E.score(q,paths,candidates.slice(0,n),baseline);assert.equal(r.score,Math.round(100*.8**(n+Number(baseline))));assert.equal(r.helpCount,n+Number(baseline));}
  const shifted=paths.map(s=>s.map(p=>({...p,y:p.y+4})));assert.ok(E.score(q,shifted).score<55);
  assert.ok(E.score(q,paths.concat([[{x:-5,y:8},{x:9,y:8}]])).score<95);
 }
});
test('every rescue reveals exactly one integer-to-integer x unit and skips invisible intervals',()=>{
 for(let i=0;i<E.HELP_COUNT;i++){const b=E.helpBounds(i);assert.equal(b.max-b.min,1);assert.equal(b.min,Math.round(b.min));}assert.deepEqual(E.helpBounds(8),{min:2,max:3});
 for(const baseN of E.baseOptions)for(const type of ['exp','log'])for(const h of [-2,2]){
  const q={...base,type,base:baseN,h,a:.5,b:2,d:-2},choices=E.availableHelpIntervals(q);assert.ok(choices.length>=3);
  for(const index of choices){const b=E.helpBounds(index),paths=E.helpPaths(q,[index]);assert.ok(paths[0]?.length>1);for(const p of paths.flat())assert.ok(p.x>=b.min-1e-8&&p.x<=b.max+1e-8);if(type==='log')assert.ok(b.min>=h);}
  const used=[];while(used.length<choices.length){const i=E.nextHelpInterval(used,()=>.99,q);assert.ok(choices.includes(i));assert.ok(!used.includes(i));used.push(i);}assert.equal(E.nextHelpInterval(used,Math.random,q),null);
 }
 const q={...base,type:'log',h:2},path=E.targetPaths(q),clipped=E.clipStrokes(path,[8,10],q);for(const p of clipped.flat())assert.ok(!E.isHelpX(p.x,[8,10],q));
 assert.ok(E.score(q,[],[8]).rawScore>0);assert.equal(E.score(q,[],[0]).rawScore,0);
});
test('near-asymptote log branches reach the viewport edge even for base 1/10',()=>{
 const q={...base,type:'log',base:.1,a:.5,b:2,h:2,d:-2},path=E.targetPaths(q);near(Math.max(...path.flat().map(p=>p.y)),12);assert.equal(E.createInkTracker(path,E.graphRange(q),true).tooMany,false);assert.equal(E.score(q,path).score,100);
});
test('new defaults, migration and selection honor teacher choices',()=>{
 assert.deepEqual(E.defaults.bases,[1/3,1/2,2,3]);assert.deepEqual(E.defaults.levels.map(l=>l.count),[2,1,1,0,0]);assert.deepEqual(E.buildPlan(E.defaults),[1,1,2,3]);assert.deepEqual(E.baseOptions.map(E.baseLabel),['1/10','1/5','1/3','1/2','2','3','5','10']);
 const old=E.clone(E.defaults);old.version=1;delete old.bases;old.levels.forEach((l,i)=>l.count=[1,1,1,0,1][i]);const upgraded=E.normalizeSettings(old);assert.deepEqual(upgraded.levels.map(l=>l.count),[2,1,1,0,0]);assert.deepEqual(upgraded.bases,E.defaults.bases);
 old.levels[0].count=3;assert.equal(E.normalizeSettings(old).levels[0].count,3);const v2=E.clone(E.defaults);v2.bases=[.1,10];assert.deepEqual(E.normalizeSettings(v2).bases,[.1,10]);
 for(let star=1;star<=5;star++){const pool=E.questionPool(star,E.defaults.levels[star-1],[.1,5]);assert.ok(pool.every(q=>[.1,5].includes(q.base)));assert.equal(E.selectQuestion(star,E.defaults.levels[star-1],[],()=>0,[.2]).base,.2);}
 assert.deepEqual(E.validate(E.defaults),[]);const bad=E.clone(E.defaults);bad.bases=[];assert.ok(E.validate(bad).length);bad.bases=[1];assert.ok(E.validate(bad).length);
 const s=E.clone(E.defaults);s.levels[4].count=1;s.levels[4].transforms.pop();assert.ok(E.validate(s).length);s.levels[4].count=0;assert.deepEqual(E.validate(s),[]);
});
test('rescue timing and independent usage limits are preserved',()=>{
 assert.equal(E.helpState(E.defaults,14.99).available,0);assert.equal(E.helpState(E.defaults,15).available,1);assert.equal(E.helpState(E.defaults,35,1).available,2);assert.equal(E.helpState(E.defaults,100,3).available,0);
});
test('shared function choices govern all five stars and migrate legacy settings',()=>{
 assert.deepEqual(E.defaults.types,['exp','log']);
 for(const type of ['exp','log'])for(let star=1;star<=5;star++){
  const pool=E.questionPool(star,E.defaults.levels[star-1],E.defaults.bases,[type]);assert.ok(pool.length);assert.ok(pool.every(q=>q.type===type));
  assert.equal(E.selectQuestion(star,E.defaults.levels[star-1],[],()=>.99,E.defaults.bases,[type]).type,type);
 }
 const invalid=E.clone(E.defaults);invalid.types=[];assert.ok(E.validate(invalid).length);invalid.types=['sin'];assert.ok(E.validate(invalid).length);
 const old=E.clone(E.defaults);old.version=2;delete old.types;old.bases=[.1,5];old.levels.forEach(l=>l.types=l.count>0?['log']:['exp']);old.levels[0].seconds=90;
 const migrated=E.normalizeSettings(old);assert.deepEqual(migrated.types,['log']);assert.deepEqual(migrated.bases,[.1,5]);assert.equal(migrated.levels[0].seconds,90);assert.deepEqual(migrated.levels.map(l=>l.count),[2,1,1,0,0]);assert.ok(migrated.levels.every(l=>!('types'in l)));assert.deepEqual(E.validate(migrated),[]);
 old.levels[0].types=['exp'];assert.deepEqual(E.normalizeSettings(old).types,['exp','log']);
 const current=E.clone(E.defaults);current.types=['exp'];assert.deepEqual(E.normalizeSettings(current).types,['exp']);
});
