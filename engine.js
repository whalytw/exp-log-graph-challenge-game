(function(root){
'use strict';
const XMIN=-6,XMAX=10,YMAX=12,HELP_COUNT=XMAX-XMIN;
const baseOptions=[1/10,1/5,1/3,1/2,2,3,5,10],defaultBases=[1/3,1/2,2,3];
const defaultTypes=['exp','log'];
const transforms=['horizontalShift','horizontalScale','verticalScale','verticalShift'];
const timeDefaults=[40,60,80,100,120],countDefaults=[2,1,1,0,0];
const defaults={version:3,types:[...defaultTypes],bases:[...defaultBases],theme:'dark',gridColor:'#2a3b54',gridWidth:1.5,axisFontSize:16,axisLabelColor:'#a8b9cf',helpCards:3,helpFirstDelay:15,helpInterval:10,seatMin:1,seatMax:30,levels:Array.from({length:5},(_,i)=>({count:countDefaults[i],seconds:timeDefaults[i],transforms:[...transforms]}))};
const clone=x=>JSON.parse(JSON.stringify(x));
function normalizeSettings(saved){
 const s={...clone(defaults),...saved,levels:defaults.levels.map((l,i)=>({...clone(l),...saved?.levels?.[i]}))};
 if((saved?.version??1)<2){if(saved?.levels?.every((l,i)=>l.count===[1,1,1,0,1][i]))s.levels.forEach((l,i)=>l.count=countDefaults[i]);s.bases=[...defaultBases];}
 if(!Array.isArray(saved?.types)){
  const active=saved?.levels?.filter(l=>l.count>0)||[],legacy=(active.length?active:saved?.levels||[]).flatMap(l=>l.types||[]),types=defaultTypes.filter(t=>legacy.includes(t));
  s.types=types.length?types:[...defaultTypes];
 }
 s.levels.forEach(l=>delete l.types);
 s.version=3;return s;
}
function graphRange(){return {min:-6,max:12,step:1};}
function frac(a,b){return '<span class="frac"><span>'+a+'</span><span>'+b+'</span></span>';}
function number(v){return v===.5?frac('1','2'):String(v);}
function baseLabel(v){return v<1?'1/'+Math.round(1/v):String(v);}
function baseMarkup(v){return v<1?frac('1',Math.round(1/v)):String(v);}
function formula(q){
 let inner=q.h?'(x'+(q.h>0?' − ':' + ')+Math.abs(q.h)+')':'x';
 if(q.b===.5)inner=frac(inner,'2');else if(q.b!==1)inner=q.b+inner;
 const base=baseMarkup(q.base),core=q.type==='exp'?(q.base<1?'('+base+')':base)+'<sup>'+inner+'</sup>':'log<sub class="log-base">'+base+'</sub>('+inner+')';
 return 'f(x) = '+(q.a===1?'':number(q.a)+' · ')+core+(q.d?(q.d>0?' + ':' − ')+Math.abs(q.d):'');
}
function evaluate(q,x){const u=q.b*(x-q.h);return q.type==='exp'?q.a*Math.pow(q.base,u)+q.d:u>0?q.a*Math.log(u)/Math.log(q.base)+q.d:NaN;}
function baseQuestion(q){return {...q,a:1,b:1,h:0,d:0,star:1};}
function hasTransform(q){return !!q&&(q.a!==1||q.b!==1||q.h!==0||q.d!==0);}
function combinations(a,n){if(n===0)return [[]];return a.flatMap((v,i)=>combinations(a.slice(i+1),n-1).map(c=>[v,...c]));}
function questionPool(star,level,bases=defaultBases,types=defaultTypes){return types.flatMap(type=>bases.flatMap(base=>combinations(level.transforms,star-1).flatMap(chosen=>{
 let list=[{type,base,a:1,b:1,h:0,d:0,star}];
 for(const key of chosen){const vals=key==='horizontalShift'?[-2,-1,1,2]:key==='horizontalScale'?[.5,2]:key==='verticalScale'?[.5,2,3]:[-2,-1,1,2],field={horizontalShift:'h',horizontalScale:'b',verticalScale:'a',verticalShift:'d'}[key];list=list.flatMap(q=>vals.map(v=>({...q,[field]:v})));}return list;
})));}
function signature(q){return [q.type,q.base,q.a,q.b,q.h,q.d].join('|');}
function selectQuestion(star,level,avoid=[],rng=Math.random,bases=defaultBases,types=defaultTypes){const pool=questionPool(star,level,bases,types),filtered=pool.filter(q=>!avoid.includes(signature(q))),choices=filtered.length?filtered:pool;if(!choices.length)throw Error('沒有可用題目');return {...choices[Math.min(choices.length-1,Math.floor(rng()*choices.length))]};}
function validate(s){
 const errors=[];
 if(!Array.isArray(s.types)||!s.types.length||s.types.some(t=>!defaultTypes.includes(t))||new Set(s.types).size!==s.types.length)errors.push('出題函數請至少勾選指數函數或對數函數其中一種。');
 if(!Array.isArray(s.bases)||!s.bases.length||s.bases.some(b=>!baseOptions.includes(b))||new Set(s.bases).size!==s.bases.length)errors.push('出題底數請至少勾選一種，並使用提供的底數選項。');
 for(const [key,lo,hi,label] of [['helpCards',0,3,'每題求救卡'],['helpFirstDelay',0,300,'首張求救卡等待'],['helpInterval',1,300,'後續求救卡間隔'],['axisFontSize',10,28,'座標文字大小']])if(!Number.isInteger(s[key])||s[key]<lo||s[key]>hi)errors.push(label+'需為 '+lo+'～'+hi+' 的整數。');
 if(!/^#[0-9a-f]{6}$/i.test(s.axisLabelColor)||!/^#[0-9a-f]{6}$/i.test(s.gridColor))errors.push('請選擇有效顏色。');
 if(!Number.isInteger(s.seatMin)||!Number.isInteger(s.seatMax)||s.seatMin<1||s.seatMax>99||s.seatMax<s.seatMin)errors.push('座號範圍需介於 1～99，終點不可小於起點。');
 if(!Array.isArray(s.levels)||s.levels.length!==5)return errors.concat('需要五個星等設定。');
 let total=0;
 s.levels.forEach((l,i)=>{if(!Number.isInteger(l.count)||l.count<0||l.count>20)errors.push((i+1)+' 星題數需為 0～20。');if(!Number.isInteger(l.seconds)||l.seconds<10||l.seconds>300||l.seconds%10!==0)errors.push((i+1)+' 星限時需為 10～300 秒，且是 10 的倍數。');total+=l.count;if(l.count>0){if(l.transforms.some(t=>!transforms.includes(t))||new Set(l.transforms).size<i)errors.push((i+1)+' 星需要至少勾選 '+i+' 種變化，或將題數設為 0。');}});
 if(total===0)errors.push('至少需設定一題。');return errors;
}
function buildPlan(s){return s.levels.flatMap((l,i)=>Array.from({length:l.count},()=>i+1));}
// Sampling in both x and y preserves the near-vertical logarithmic branch.
function targetPaths(q,n=1000,from=XMIN,to=XMAX){
 if(!q)return [];
 const range=graphRange(q),points=[];
 function add(x,exactY){const y=exactY??evaluate(q,x);if(Number.isFinite(x)&&Number.isFinite(y)&&x>=from-1e-9&&x<=to+1e-9&&y>=range.min-1e-9&&y<=range.max+1e-9)points.push({x,y});}
 for(let i=0;i<=n;i++){
  add(from+(to-from)*i/n);
  const y=range.min+(range.max-range.min)*i/n;
  const x=q.type==='log'?q.h+Math.pow(q.base,(y-q.d)/q.a)/q.b:(y-q.d)/q.a>0?q.h+Math.log((y-q.d)/q.a)/Math.log(q.base)/q.b:NaN;
  if(q.type==='log')add(x,y);else add(x);
 }
 points.sort((a,b)=>a.x-b.x||(q.base>1?1:-1)*(a.y-b.y));return points.length>1?[points.filter((p,i)=>!i||p.x!==points[i-1].x||Math.abs(p.y-points[i-1].y)>1e-9)]:[];
}
function length(strokes,range=graphRange()){let result=0;for(const s of strokes)for(let i=1;i<s.length;i++)result+=Math.hypot((s[i].x-s[i-1].x)/(XMAX-XMIN)*600,(s[i].y-s[i-1].y)/(range.max-range.min)*500);return result;}
function resample(strokes,count=96){
 const r=graphRange(),segments=[];let total=0;
 for(const s of strokes)for(let i=1;i<s.length;i++){const a=s[i-1],b=s[i],len=length([[a,b]],r);if(len>0){segments.push({a,b,start:total,len});total+=len;}}
 if(!segments.length)return strokes.flat().slice(0,count);
 let k=0;return Array.from({length:count},(_,i)=>{const d=(i+.5)*total/count;while(k<segments.length-1&&segments[k].start+segments[k].len<d)k++;const s=segments[k],t=(d-s.start)/s.len;return {x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t};});
}
function helpBounds(index){return {min:XMIN+index,max:XMIN+index+1};}
function isHelpX(x,intervals=[],q){return intervals.some(i=>{const b=helpBounds(i,q);return x>=b.min&&x<=b.max;});}
function availableHelpIntervals(q,used=[]){return Array.from({length:HELP_COUNT},(_,i)=>i).filter(i=>{if(used.includes(i))return false;if(!q)return true;const b=helpBounds(i);return helpPaths(q,[i]).some(path=>path.length>1&&path.some(p=>p.x>b.min+1e-8&&p.x<b.max-1e-8));});}
function nextHelpInterval(used=[],rng=Math.random,q){const a=availableHelpIntervals(q,used);return a.length?a[Math.min(a.length-1,Math.floor(rng()*a.length))]:null;}
function helpPaths(q,intervals=[]){return intervals.flatMap(i=>{const b=helpBounds(i,q);return targetPaths(q,500,b.min,b.max);});}
function nearest(p,paths){
 const r=graphRange(),sx=600/(XMAX-XMIN),sy=500/(r.max-r.min);let best=Infinity;
 for(const s of paths){if(s.length===1)best=Math.min(best,Math.hypot((p.x-s[0].x)*sx,(p.y-s[0].y)*sy));for(let i=1;i<s.length;i++){const a=s[i-1],b=s[i],dx=(b.x-a.x)*sx,dy=(b.y-a.y)*sy,px=(p.x-a.x)*sx,py=(p.y-a.y)*sy,t=dx*dx+dy*dy?Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy))):0;best=Math.min(best,Math.hypot(px-t*dx,py-t*dy));}}return best;
}
function score(q,strokes,helpIntervals=[],baselineUsed=false){
 const help=[...new Set(helpIntervals)].filter(i=>Number.isInteger(i)&&i>=0&&i<HELP_COUNT),path=targetPaths(q),pts=resample(path,96),clipped=clipStrokes(strokes,help,q),quality=d=>Math.max(0,1-Math.max(0,d-7)/32);
 let sum=0,covered=0;const points=pts.map(p=>{const assisted=isHelpX(p.x,help,q),distance=assisted?0:nearest(p,clipped),value=quality(distance);sum+=value;if(value>0)covered++;return {x:p.x,target:p.y,value,assisted,excluded:false};});
 const inkPoints=resample(clipped,128),precision=inkPoints.length?inkPoints.reduce((s,p)=>s+quality(nearest(p,path)),0)/inkPoints.length:1;
 const rawScore=pts.length?100*sum/pts.length*precision:0,helpCount=help.length+Number(!!baselineUsed),factor=.8**helpCount;
 return {score:Math.round(rawScore*factor),rawScore,helpCount,baselineUsed:!!baselineUsed,factor,coverage:pts.length?Math.round(100*covered/pts.length):0,visible:pts.length,covered,points};
}
function inkBudget(q){return Math.max(1300,length(targetPaths(q))*1.8+400);}
function mergeYs(ys,tolerance=.16){let a=ys.filter(Number.isFinite).sort((a,b)=>a-b),out=[];for(let y of a){if(!out.length||y-out[out.length-1]>tolerance)out.push(y);else out[out.length-1]=(out[out.length-1]+y)/2;}return out;}
function intersections(strokes,x,tolerance=.16){let ys=[];for(let stroke of strokes){if(stroke.length===1&&Math.abs(stroke[0].x-x)<.018)ys.push(stroke[0].y);for(let i=1;i<stroke.length;i++){let a=stroke[i-1],b=stroke[i];if(x<Math.min(a.x,b.x)-1e-9||x>Math.max(a.x,b.x)+1e-9)continue;if(Math.abs(b.x-a.x)<1e-9){ys.push(a.y,b.y,(a.y+b.y)/2);}else ys.push(a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x));}}return mergeYs(ys,tolerance);}
function helpState(config,elapsedSeconds,used=0){
 const elapsed=Math.max(0,elapsedSeconds),limit=config.helpCards;
 const issued=Math.min(limit,elapsed<config.helpFirstDelay?0:1+Math.floor((elapsed-config.helpFirstDelay)/config.helpInterval));
 return {issued,available:Math.max(0,issued-used),nextIn:issued<limit?Math.max(0,config.helpFirstDelay+issued*config.helpInterval-elapsed):null};
}
function openSegments(a,b,intervals=[],q){
 if(!intervals.length)return [[a,b]];
 const dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)<1e-12)return isHelpX(a.x,intervals,q)?[]:[[a,b]];
 const cuts=[0,1];for(const i of intervals){const bounds=helpBounds(i,q);for(const x of [bounds.min,bounds.max]){const t=(x-a.x)/dx;if(t>0&&t<1)cuts.push(t);}}
 cuts.sort((a,b)=>a-b);const out=[],point=t=>({x:a.x+dx*t,y:a.y+dy*t});
 for(let j=1;j<cuts.length;j++){
  let from=cuts[j-1],to=cuts[j];if(to-from<1e-12||isHelpX(a.x+dx*(from+to)/2,intervals,q))continue;
  // Leave a negligible gap at a closed locked boundary, preserving stroke direction.
  const pad=Math.min(1e-7/Math.abs(dx),(to-from)/4);
  if(isHelpX(point(from).x,intervals,q))from+=pad;if(isHelpX(point(to).x,intervals,q))to-=pad;
  out.push([point(from),point(to)]);
 }return out;
}
function clipStrokes(strokes,intervals=[],q){
 if(!intervals.length)return strokes;
 const out=[],same=(a,b)=>a&&b&&Math.abs(a.x-b.x)<1e-9&&Math.abs(a.y-b.y)<1e-9;
 for(const stroke of strokes){
  if(stroke.length===1){if(!isHelpX(stroke[0].x,intervals,q))out.push(stroke);continue;}
  let path=[];function flush(){if(path.length)out.push(path);path=[];}
  for(let j=1;j<stroke.length;j++){
   const pieces=openSegments(stroke[j-1],stroke[j],intervals,q);if(!pieces.length){flush();continue;}
   for(const [a,b] of pieces){if(!same(path[path.length-1],a)){flush();path=[a];}if(!same(path[path.length-1],b))path.push(b);}
  }flush();
 }return out;
}
function tooManyYs(strokes,range={min:-6,max:6}){
const unit=(range.max-range.min)/12;
// Exact x intersections on a narrow lattice; also test vertical segment x positions.
const n=512,bins=Array.from({length:n+1},()=>[]);
for(let s of strokes)for(let i=1;i<s.length;i++){const a=s[i-1],b=s[i],lo=Math.max(0,Math.ceil((Math.min(a.x,b.x)-XMIN)/(XMAX-XMIN)*n)),hi=Math.min(n,Math.floor((Math.max(a.x,b.x)-XMIN)/(XMAX-XMIN)*n));if(Math.abs(b.x-a.x)<.0001){const k=Math.round((a.x-XMIN)/(XMAX-XMIN)*n);if(k>=0&&k<=n){let steps=Math.max(1,Math.ceil(Math.abs(b.y-a.y)/(.2*unit)));for(let j=0;j<=steps;j++)bins[k].push(a.y+(b.y-a.y)*j/steps);}}else for(let k=lo;k<=hi;k++){let x=XMIN+k/n*(XMAX-XMIN);bins[k].push(a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x));}}
return bins.some(ys=>mergeYs(ys,.18*unit).length>6);
}
function createInkTracker(strokes=[],range={min:-6,max:6},allowVertical=false){
 const n=512,span=XMAX-XMIN,unit=(range.max-range.min)/12;
 const bins=Array.from({length:n+1},()=>[]),over=Array(n+1).fill(false);
 let total=0,overCount=0;
 function refresh(k){const next=mergeYs(bins[k],.18*unit).length>6;if(next!==over[k]){overCount+=next?1:-1;over[k]=next;}}
 function addSegment(a,b,initializing=false){
  total+=Math.hypot((b.x-a.x)/span*600,(b.y-a.y)/(range.max-range.min)*500);
  const lo=Math.max(0,Math.ceil((Math.min(a.x,b.x)-XMIN)/span*n)),hi=Math.min(n,Math.floor((Math.max(a.x,b.x)-XMIN)/span*n));
  if(Math.abs(b.x-a.x)<.0001){
   const k=Math.round((a.x-XMIN)/span*n);
   if(k>=0&&k<=n){const steps=Math.max(1,Math.ceil(Math.abs(b.y-a.y)/(.2*unit)));for(let j=0;j<=steps;j++)bins[k].push(a.y+(b.y-a.y)*j/steps);if(!initializing)refresh(k);}
  }else for(let k=lo;k<=hi;k++){const x=XMIN+k/n*span;bins[k].push(a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x));if(!initializing)refresh(k);}
 }
 for(const stroke of strokes)for(let i=1;i<stroke.length;i++)addSegment(stroke[i-1],stroke[i],true);
 bins.forEach((_,k)=>refresh(k));
 return {addSegment,get length(){return total;},get tooMany(){return !allowVertical&&overCount>0;}};
}
function eraseSweep(strokes,from,to,radius,range={min:-6,max:6}){
 const sx=600/(XMAX-XMIN),sy=500/(range.max-range.min),ax=from.x*sx,ay=from.y*sy,bx=to.x*sx,by=to.y*sy;
 const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy,out=[];
 for(const stroke of strokes){let path=[];for(const p of stroke){const px=p.x*sx,py=p.y*sy,t=len2?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len2)):0;
  if(Math.hypot(px-ax-t*dx,py-ay-t*dy)<=radius){if(path.length>1)out.push(path);path=[];}else path.push(p);
 }if(path.length>1)out.push(path);}return out;
}
function erase(strokes,center,radius,range={min:-6,max:6}){let out=[];for(let stroke of strokes){let path=[];for(let p of stroke){if(Math.hypot((p.x-center.x)/(XMAX-XMIN)*600,(p.y-center.y)/(range.max-range.min)*500)<=radius){if(path.length>1)out.push(path);path=[];}else path.push(p);}if(path.length>1)out.push(path);}return out;}
const api={XMIN,XMAX,YMAX,HELP_COUNT,baseOptions,baseLabel,transforms,defaults,timeDefaults,clone,normalizeSettings,graphRange,formula,evaluate,baseQuestion,hasTransform,questionPool,signature,selectQuestion,validate,buildPlan,score,intersections,resample,helpState,helpBounds,isHelpX,nextHelpInterval,availableHelpIntervals,openSegments,clipStrokes,helpPaths,length,targetPaths,inkBudget,tooManyYs,createInkTracker,erase,eraseSweep};root.ExpLogEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
