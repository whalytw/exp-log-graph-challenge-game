'use strict';
const E=ExpLogEngine;
let settings=E.clone(E.defaults);
try{const old=JSON.parse(localStorage.getItem('exp-log-graph-v1-settings'));if(old&&Array.isArray(old.levels)&&old.levels.length===5){const migrated=E.normalizeSettings(old);if(E.validate(migrated).length===0){settings=migrated;localStorage.setItem('exp-log-graph-v1-settings',JSON.stringify(settings));}}}catch{}
const HELP_REVEAL_MS=1800;
const $=s=>document.querySelector(s),lanes=[],names=['左區','中區','右區'],transformNames={horizontalShift:'左右平移',horizontalScale:'左右伸縮',verticalScale:'上下伸縮',verticalShift:'上下平移'};
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',3300);}
// Pointer down accepts secondary touches while another student is drawing.
// Suppress its later compatibility click, keeping keyboard/assistive clicks usable.
function bindAction(button,action){
 let lastPointer=-Infinity;
 button.addEventListener('pointerdown',e=>{if(button.disabled||e.button>0)return;e.preventDefault();lastPointer=performance.now();button.classList.add('pressed');action();});
 for(const type of ['pointerup','pointercancel','pointerleave'])button.addEventListener(type,()=>{if(button.classList.contains('pressed'))lastPointer=performance.now();button.classList.remove('pressed');});
 button.addEventListener('click',e=>{if(button.disabled)return;if(e.detail!==0&&performance.now()-lastPointer<800){e.preventDefault();return;}action();});
}
function applyTheme(){document.body.dataset.theme=settings.theme;}
applyTheme();
for(let i=0;i<3;i++){
const el=document.createElement('section');el.className='lane';el.setAttribute('aria-label',names[i]+'遊戲區');el.innerHTML=`<div class="lane-head"><span class="lane-name">${names[i]} · 挑戰區</span><span class="seat-label">等待下一位</span></div><div class="progress"></div><div class="question"><div class="question-meta"><span class="stars">★</span><span class="counter"></span><span class="countdown" role="timer">— 秒</span></div><div class="formula">f(x) = 2<sup>x</sup></div></div><div class="plot-wrap"><canvas aria-label="${names[i]}函數繪圖區"></canvas><span class="plot-hint">x：−6 ～ 10 · y：−6 ～ 12</span></div><div class="result-strip"><span class="score"></span><span class="result-detail"></span></div><div class="ink-state" role="status">用細筆畫出函數圖</div><div class="toolbar"><button class="quiet tool active" data-tool="pen">細筆</button><button class="quiet tool" data-tool="eraser">橡皮擦</button><button class="quiet" data-action="undo">復原</button></div><div class="rescuebar"><button class="quiet help-card" data-action="help" title="每張揭示一個區間，本題得分再乘 0.8">求救 15秒</button><button class="quiet baseline-card" data-action="baseline" title="顯示同底數原始函數，每題限用一次，得分乘 0.8">基準線求救卡</button></div><button class="submit">確定送出</button><div class="overlay"></div>`;
$('#lanes').appendChild(el);const l={i,el,canvas:el.querySelector('canvas'),ctx:el.querySelector('canvas').getContext('2d'),status:'idle',strokes:[],undo:[],tool:'pen',pointer:null,blocked:false,blockReason:'',frame:0,pending:[],ink:null,inputRect:null,help:[],helpPaths:[],helpEffects:[],smokeFrame:0};lanes.push(l);
el.querySelectorAll('[data-tool]').forEach(b=>bindAction(b,()=>setTool(l,b.dataset.tool)));bindAction(el.querySelector('[data-action=undo]'),()=>{if(l.status!=='drawing')return;releasePointer(l);if(l.undo.length){l.strokes=E.clipStrokes(l.undo.pop(),l.help,l.q);updateInk(l);draw(l);}});
bindAction(el.querySelector('[data-action=baseline]'),()=>useBaseline(l));bindAction(el.querySelector('.submit'),()=>submit(l));bindAction(el.querySelector('[data-action=help]'),()=>useHelp(l));
const c=l.canvas;c.addEventListener('pointerdown',e=>pointerDown(l,e));c.addEventListener('pointermove',e=>pointerMove(l,e));['pointerup','pointercancel','lostpointercapture'].forEach(t=>c.addEventListener(t,e=>pointerEnd(l,e)));
new ResizeObserver(()=>resize(l)).observe(el.querySelector('.plot-wrap'));welcome(l);
}
function seatOptions(selected=''){return '<option value="">不選座號</option>'+Array.from({length:settings.seatMax-settings.seatMin+1},(_,i)=>{let n=settings.seatMin+i;return `<option value="${n}" ${String(n)===String(selected)?'selected':''}>${n} 號</option>`;}).join('');}
function welcome(l){stopHelpAnimation(l);l.helpEffects=[];l.help=[];l.helpPaths=[];l.baselineUsed=false;l.status='idle';l.pointer=null;l.deadline=null;l.feedbackDeadline=null;l.el.querySelector('.countdown').textContent='— 秒';l.el.querySelector('.countdown').classList.remove('urgent');l.el.classList.remove('result-mode');l.el.querySelector('.seat-label').textContent='等待下一位';l.el.querySelector('.result-strip').classList.remove('visible');let o=l.el.querySelector('.overlay');o.hidden=false;o.style.display='flex';o.innerHTML=`<div class="welcome-icon">↗</div><span class="mini-stars">★★★★★</span><h2>準備畫出你的曲線</h2><p>以 2、3 為底，挑戰平移與伸縮<br>完成後換下一位同學上場</p><label>${names[l.i]}座號（可不選）<select aria-label="${names[l.i]}座號">${seatOptions()}</select></label><button class="primary">開始挑戰</button><p class="welcome-detail">共 ${E.buildPlan(settings).length} 題 · 每題限時繪圖</p>`;bindAction(o.querySelector('button'),()=>start(l,o.querySelector('select').value));draw(l);}
function start(l,seat){l.config=E.clone(settings);l.plan=E.buildPlan(l.config);l.index=0;l.seat=seat;l.scores=[];l.attempts=0;l.history=[];l.el.querySelector('.seat-label').textContent=seat?seat+' 號':'未填座號';l.el.querySelector('.overlay').style.display='none';newQuestion(l);}
function newQuestion(l){stopHelpAnimation(l);const star=l.plan[l.index],avoid=lanes.filter(o=>o!==l&&o.q).map(o=>E.signature(o.q)).concat(l.history.slice(-8));l.q=E.selectQuestion(star,l.config.levels[star-1],avoid);l.history.push(E.signature(l.q));l.status='drawing';l.strokes=[];l.undo=[];l.pointer=null;l.pending=[];l.ink=null;l.result=null;l.help=[];l.helpPaths=[];l.baselineUsed=false;l.helpEffects=[];l.range=E.graphRange(l.q);l.questionStarted=performance.now();l.deadline=l.questionStarted+l.config.levels[star-1].seconds*1000;l.feedbackDeadline=null;l.budget=E.inkBudget(l.q);l.blocked=false;l.blockReason='';setTool(l,'pen');l.el.classList.remove('result-mode');l.el.querySelector('.result-strip').classList.remove('visible');l.el.querySelector('.stars').textContent='★'.repeat(star);l.el.querySelector('.counter').textContent=`第 ${l.index+1} / ${l.plan.length} 題`;l.el.querySelector('.formula').innerHTML=E.formula(l.q);l.el.querySelector('.plot-hint').textContent='x：−6 ～ 10 · y：−6 ～ 12';l.el.querySelector('.progress').style.gap=l.plan.length>30?'1px':l.plan.length>15?'3px':'5px';l.el.querySelector('.progress').innerHTML=l.plan.map((level,i)=>`<span class="step ${i<l.index?'done':i===l.index?'current':''}" title="第 ${i+1} 題 · ${level} 星" aria-label="第 ${i+1} 題，${level} 星${i<l.index?'，已完成':i===l.index?'，目前題目':''}"></span>`).join('');l.el.querySelector('.submit').textContent='確定送出';l.el.querySelector('.submit').disabled=false;l.el.querySelector('[data-action=undo]').disabled=false;l.el.querySelectorAll('[data-tool]').forEach(b=>b.disabled=false);updateHelpButton(l);updateInk(l);updateClock(l);fitFormula(l);draw(l);}
function setTool(l,tool){if(l.status!=='drawing')return;releasePointer(l);l.tool=tool;l.el.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));l.canvas.style.cursor=tool==='pen'?'crosshair':'cell';}
function axisTextSize(l){return Math.min(settings.axisFontSize,Math.max(10,((l.width||300)-40)/22));}
function geometry(l){const w=l.width||300,h=l.height||350,size=axisTextSize(l);return {left:Math.max(w>500?45:36,Math.ceil(size*2.4)+8),right:w-Math.max(17,Math.ceil(size*1.4)),top:29,bottom:h-Math.max(35,Math.ceil(size*2.2+10))};}
function toPixel(l,p){let g=geometry(l);return {x:g.left+(p.x-E.XMIN)/(E.XMAX-E.XMIN)*(g.right-g.left),y:g.bottom-(p.y-(l.range?.min??-6))/((l.range?.max??12)-(l.range?.min??-6))*(g.bottom-g.top)};}
function toPoint(l,e){const rect=l.inputRect||l.canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,g=geometry(l);if(x<g.left||x>g.right||y<g.top||y>g.bottom)return null;return {x:E.XMIN+(x-g.left)/(g.right-g.left)*(E.XMAX-E.XMIN),y:(l.range?.min??-6)+(g.bottom-y)/(g.bottom-g.top)*((l.range?.max??12)-(l.range?.min??-6))};}
function fitFormula(l){
 const node=l.el.querySelector('.formula');node.style.fontSize='';
 if(!node.clientWidth||node.scrollWidth<=node.clientWidth)return;
 let size=parseFloat(getComputedStyle(node).fontSize);
 while(node.scrollWidth>node.clientWidth&&size>14){size-=.5;node.style.fontSize=size+'px';}
}
function resize(l){releasePointer(l);fitFormula(l);const r=l.canvas.getBoundingClientRect();l.width=r.width;l.height=r.height;const dpr=Math.min(window.devicePixelRatio||1,2);l.canvas.width=Math.round(r.width*dpr);l.canvas.height=Math.round(r.height*dpr);l.ctx.setTransform(dpr,0,0,dpr,0,0);draw(l);}
function drawAxisLabels(l,c,g,zero,range){
 const size=axisTextSize(l),color=settings.axisLabelColor,bg=settings.theme==='dark'?'#111d30':'#fff';
 c.font=size+'px "Microsoft JhengHei", sans-serif';c.textAlign='center';c.textBaseline='top';
 for(let x=E.XMIN;x<=E.XMAX;x+=2){const p=toPixel(l,{x,y:0}),text=String(x),w=c.measureText(text).width;c.fillStyle=bg;c.fillRect(p.x-w/2-2,p.y+4,w+4,size+4);c.fillStyle=color;c.fillText(text,p.x,p.y+6);}
 c.textAlign='right';c.textBaseline='middle';
 for(let y=range.min;y<=range.max;y+=2){if(y===0)continue;const p=toPixel(l,{x:0,y}),text=String(y),w=c.measureText(text).width;c.fillStyle=bg;c.fillRect(zero.x-w-10,p.y-size/2-1,w+6,size+2);c.fillStyle=color;c.fillText(text,zero.x-7,p.y);}
 c.fillStyle=color;c.textAlign='left';c.textBaseline='top';c.fillText('y',zero.x+7,g.top+2);c.textAlign='right';c.fillText('x',g.right-3,zero.y-22);
}
function draw(l){
 const c=l.ctx,w=l.width||l.canvas.clientWidth,h=l.height||l.canvas.clientHeight;if(!w||!h)return;
 c.clearRect(0,0,w,h);const g=geometry(l),range=l.range||E.graphRange(l.q),dark=settings.theme==='dark',axis=dark?'#b9c9dd':'#536781';
 l.el.querySelector('.plot-hint').style.left=(g.left+5)+'px';
 if(l.help.length||l.baselineUsed){const hint=l.el.querySelector('.plot-hint'),text=(l.baselineUsed?'藍點線：基準　':'')+(l.help.length?'粉紅：求救　':'')+(l.status==='result'?'橘虛線：答案':'');if(hint.textContent!==text)hint.textContent=text;}
 function clipPlot(){c.beginPath();c.rect(g.left,g.top,g.right-g.left,g.bottom-g.top);c.clip();}
 c.save();clipPlot();c.lineWidth=Number(settings.gridWidth);c.strokeStyle=settings.gridColor;
 for(let k=E.XMIN;k<=E.XMAX;k++){const x=toPixel(l,{x:k,y:0}).x;c.beginPath();c.moveTo(x,g.top);c.lineTo(x,g.bottom);c.stroke();}
 for(let y=range.min;y<=range.max+1e-8;y+=range.step){const py=toPixel(l,{x:0,y}).y;c.beginPath();c.moveTo(g.left,py);c.lineTo(g.right,py);c.stroke();}
 const zero=toPixel(l,{x:0,y:0});c.lineWidth=1.5;c.strokeStyle=axis;c.beginPath();c.moveTo(zero.x,g.top);c.lineTo(zero.x,g.bottom);c.moveTo(g.left,zero.y);c.lineTo(g.right,zero.y);c.stroke();c.restore();
 c.save();clipPlot();
 for(const i of l.help){const b=E.helpBounds(i,l.q),left=toPixel(l,{x:b.min,y:0}).x,right=toPixel(l,{x:b.max,y:0}).x,fog=c.createLinearGradient(left,0,right,0);
  fog.addColorStop(0,dark?'rgba(226,232,240,.08)':'rgba(167,139,250,.09)');fog.addColorStop(.5,dark?'rgba(226,232,240,.18)':'rgba(167,139,250,.20)');fog.addColorStop(1,dark?'rgba(226,232,240,.08)':'rgba(167,139,250,.09)');
  c.fillStyle=fog;c.fillRect(left,g.top,right-left,g.bottom-g.top);c.strokeStyle=dark?'rgba(251,113,133,.35)':'rgba(192,38,211,.30)';c.lineWidth=1;c.strokeRect(left,g.top,right-left,g.bottom-g.top);
 }c.restore();
 // Labels and their backgrounds are below the ink; erasing restores them naturally.
 drawAxisLabels(l,c,g,zero,range);
 c.save();clipPlot();
 function paths(strokes,color,width,dash=[]){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.setLineDash(dash);for(const s of strokes){if(!s.length)continue;c.beginPath();let p=toPixel(l,s[0]);c.moveTo(p.x,p.y);for(let j=1;j<s.length;j++){p=toPixel(l,s[j]);c.lineTo(p.x,p.y);}if(s.length===1)c.lineTo(p.x+.2,p.y+.2);c.stroke();}c.setLineDash([]);}
 const accent=getComputedStyle(l.el).getPropertyValue('--accent').trim();paths(l.strokes,dark?(l.i===0?'#aaa4ff':l.i===1?'#45d9c5':'#ffd080'):accent,2.2);
if(l.baselineUsed&&l.q)paths(E.targetPaths(E.baseQuestion(l.q)),dark?'#69d2ff':'#087fb8',2.4,[3,5]);
 if(l.status==='result'&&l.q){c.strokeStyle=dark?'#8fa0b8':'#8b98a8';c.lineWidth=1;c.setLineDash([2,6]);const asym=l.q.type==='log'?toPixel(l,{x:l.q.h,y:0}):toPixel(l,{x:0,y:l.q.d});c.beginPath();if(l.q.type==='log'){c.moveTo(asym.x,g.top);c.lineTo(asym.x,g.bottom);}else{c.moveTo(g.left,asym.y);c.lineTo(g.right,asym.y);}c.stroke();c.setLineDash([]);paths(E.targetPaths(l.q),dark?'#ffab5e':'#df641c',2.4,[7,6]);for(const sample of l.result.points){if(sample.excluded)continue;const p=toPixel(l,{x:sample.x,y:sample.target});c.fillStyle=sample.value>=.8?(dark?'#75d9b3':'#2d9b70'):(dark?'#ffab5e':'#df641c');c.beginPath();c.arc(p.x,p.y,2.3,0,Math.PI*2);c.fill();}}
 const now=performance.now();
for(const effect of l.helpEffects){
 const progress=l.status==='drawing'?Math.min(1,Math.max(0,(now-effect.started)/HELP_REVEAL_MS)):1;
 c.globalAlpha=progress*progress*(3-2*progress);paths(effect.paths,dark?'#fb7185':'#c026d3',2.7);c.globalAlpha=1;
 if(progress<1)drawHelpSmoke(l,c,g,effect,progress,dark);
}
c.restore();
}
function saveUndo(l){l.undo.push(l.strokes.map(s=>s.map(p=>({...p}))));if(l.undo.length>12)l.undo.shift();}
function pointerDown(l,e){
 if(l.status==='drawing'&&performance.now()>=l.deadline){submit(l,true);return;}
 if(l.status!=='drawing'||l.pointer!==null||e.button>0)return;
 l.inputRect=l.canvas.getBoundingClientRect();const p=toPoint(l,e);if(!p){l.inputRect=null;return;}
 e.preventDefault();if(E.isHelpX(p.x,l.help,l.q)){l.inputRect=null;l.el.querySelector('.ink-state').textContent='求救區域已鎖定，請畫未覆蓋區間';return;}if(l.tool==='pen'&&l.blocked){l.inputRect=null;return;}
 saveUndo(l);l.pointer=e.pointerId;l.last=p;l.active=null;l.pending=[];l.pointerTool=l.tool;
 try{l.canvas.setPointerCapture(e.pointerId);}catch{}
 if(l.tool==='pen'){l.active=[p];l.strokes.push(l.active);}else{l.strokes=E.eraseSweep(l.strokes,p,p,22,l.range);l.ink=null;}
 updateInk(l,l.pointerTool==='eraser');draw(l);
}
function pointerMove(l,e){
 if(l.pointer!==e.pointerId||l.status!=='drawing')return;
 if(performance.now()>=l.deadline){submit(l,true);return;}
 e.preventDefault();const events=e.getCoalescedEvents?e.getCoalescedEvents():[];
 for(const event of events.length?events:[e])l.pending.push({clientX:event.clientX,clientY:event.clientY});
 if(!l.frame)l.frame=requestAnimationFrame(()=>{l.frame=0;flushPointer(l);draw(l);});
}
function flushPointer(l){
 if(l.status!=='drawing'||l.pointer===null){l.pending=[];return;}
 let erased=false;
 for(const event of l.pending){
  const p=toPoint(l,event);
  if(!p){l.last=null;l.active=null;continue;}
  if(l.pointerTool==='pen'){
   if(l.blocked)break;
   if(!l.last){l.last=p;if(!E.isHelpX(p.x,l.help,l.q)){l.active=[p];l.strokes.push(l.active);}continue;}
   appendInterpolated(l,p);
  }else{l.strokes=E.eraseSweep(l.strokes,l.last||p,p,22,l.range);l.last=p;erased=true;}
 }
 l.pending=[];updateInk(l,erased);
}
function appendInterpolated(l,p){
 const a=l.last||p,steps=Math.max(1,Math.ceil(Math.hypot((p.x-a.x)/(E.XMAX-E.XMIN)*600,(p.y-a.y)/(l.range.max-l.range.min)*500)/3));
 let previous=a;
 for(let i=1;i<=steps;i++){
  const next={x:a.x+(p.x-a.x)*i/steps,y:a.y+(p.y-a.y)*i/steps};
  for(const [from,to] of E.openSegments(previous,next,l.help,l.q)){
   const end=l.active?.[l.active.length-1];
   if(!end||Math.abs(end.x-from.x)>1e-9||Math.abs(end.y-from.y)>1e-9){l.active=[from];l.strokes.push(l.active);}
   const tail=l.active[l.active.length-1];l.active.push(to);l.ink.addSegment(tail,to);
   if(l.ink.length>l.budget||l.ink.tooMany){l.blocked=true;l.last=to;return;}
  }
  if(E.isHelpX(next.x,l.help,l.q))l.active=null;
  previous=next;l.last=next;
 }
}
function updateHelpButton(l,now=performance.now()){
 const button=l.el.querySelector('[data-action=help]'),config=l.config||settings,limit=config.helpCards;
 const state=E.helpState(config,(now-(l.questionStarted??now))/1000,l.help.length),ready=l.status==='drawing'&&state.available>0;
 const wait=state.nextIn===null?null:Math.ceil(state.nextIn);
 updateBaselineButton(l,now);button.hidden=limit===0;button.disabled=!ready;button.classList.toggle('help-ready',ready);
 const text=state.available?'求救卡 '+state.available:wait!==null?'求救 '+wait+'秒':'求救用完';
 if(button.textContent!==text)button.textContent=text;
 const next=wait===null?'本題已發完':('下一張 '+wait+' 秒後');
 const label=names[l.i]+'求救卡，可用 '+state.available+' 張，已用 '+l.help.length+'/'+limit+' 張，'+next;
 if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
 const title='可用 '+state.available+' 張；'+next+'。每題最多 '+limit+' 張，使用一張得分再乘 0.8';
 if(button.title!==title)button.title=title;
 return state;
}
function updateBaselineButton(l,now=performance.now()){
 const button=l.el.querySelector('[data-action=baseline]'),config=l.config||settings;
 button.hidden=!l.q||!E.hasTransform(l.q)||config.helpCards===0;
 const wait=Math.max(0,Math.ceil(config.helpFirstDelay-(now-(l.questionStarted??now))/1000));
 const ready=l.status==='drawing'&&!l.baselineUsed&&wait===0;
 button.disabled=!ready;button.classList.toggle('help-ready',ready);
 button.textContent=l.baselineUsed?'基準線已使用':wait?'基準卡 '+wait+'秒':'基準線求救卡';
 button.setAttribute('aria-label',names[l.i]+'基準線求救卡，'+(l.baselineUsed?'已使用':wait?'等待 '+wait+' 秒':'可使用一張'));
}
function useBaseline(l){
 if(l.status!=='drawing'||l.baselineUsed||!E.hasTransform(l.q)||!l.config.helpCards)return;
 const now=performance.now();if(now>=l.deadline){submit(l,true);return;}
 if(now-l.questionStarted<l.config.helpFirstDelay*1000)return;
 releasePointer(l);l.baselineUsed=true;updateHelpButton(l,now);updateInk(l);draw(l);
}
function useHelp(l){
 if(l.status!=='drawing')return;
 const now=performance.now();if(now>=l.deadline){submit(l,true);return;}
 if(updateHelpButton(l,now).available===0)return;
 releasePointer(l);const index=E.nextHelpInterval(l.help);if(index===null)return;
 l.help.push(index);l.strokes=E.clipStrokes(l.strokes,l.help,l.q);l.undo=l.undo.map(strokes=>E.clipStrokes(strokes,l.help,l.q));
 const paths=E.helpPaths(l.q,[index]);l.helpPaths.push(...paths);
 const puffs=Array.from({length:12},(_,i)=>({x:(i%2+.3+Math.random()*.4)/2,y:(Math.floor(i/2)+.2+Math.random()*.6)/6,radius:.45+Math.random()*.4,drift:(Math.random()-.5)*.24,speed:.08+Math.random()*.1}));
 l.helpEffects.push({index,started:now,paths,puffs});
 l.el.querySelector('.plot-hint').textContent=settings.theme==='dark'?'粉紅線：求救解答':'紫紅線：求救解答';
 updateHelpButton(l,now);updateInk(l);draw(l);animateHelp(l);
}
function stopHelpAnimation(l){if(l.smokeFrame){cancelAnimationFrame(l.smokeFrame);l.smokeFrame=0;}}
function animateHelp(l){
 if(l.smokeFrame||l.status!=='drawing'||!l.helpEffects.some(e=>performance.now()-e.started<HELP_REVEAL_MS))return;
 l.smokeFrame=requestAnimationFrame(()=>{l.smokeFrame=0;draw(l);animateHelp(l);});
}
function drawHelpSmoke(l,c,g,effect,progress,dark){
 const bounds=E.helpBounds(effect.index,l.q),left=toPixel(l,{x:bounds.min,y:0}).x,right=toPixel(l,{x:bounds.max,y:0}).x,width=right-left,height=g.bottom-g.top;
 c.save();c.beginPath();c.rect(left,g.top,width,height);c.clip();
 for(const puff of effect.puffs){
  const x=left+width*(puff.x+puff.drift*progress),y=g.top+height*(puff.y-puff.speed*progress),rx=width*puff.radius*(1+progress*.65),ry=Math.max(18,height/6)*puff.radius*(1+progress*.8);
  c.save();c.translate(x,y);c.scale(rx,ry);
  const cloud=c.createRadialGradient(0,0,0,0,0,1),opacity=.8*(1-progress)**1.3;
  cloud.addColorStop(0,dark?'rgba(222,228,243,'+opacity+')':'rgba(211,197,234,'+opacity+')');
  cloud.addColorStop(.45,dark?'rgba(179,190,218,'+opacity*.72+')':'rgba(181,163,214,'+opacity*.72+')');cloud.addColorStop(1,'rgba(190,190,220,0)');
  c.fillStyle=cloud;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.restore();
 }c.restore();
}
function pointerEnd(l,e){
 if(l.pointer!==e.pointerId)return;
 if(e.type==='pointerup'&&l.status==='drawing'&&performance.now()<l.deadline)l.pending.push({clientX:e.clientX,clientY:e.clientY});
 releasePointer(l);draw(l);
}
function updateInk(l,rebuild=true){
 if(l.status!=='drawing')return;
 if(rebuild||!l.ink)l.ink=E.createInkTracker(l.strokes,l.range);
 const long=l.ink.length>l.budget,multi=l.ink.tooMany;l.blocked=long||multi;
 l.blockReason=multi?'同一 x 的筆跡過多':'筆跡長度超出用量';
 const uses=l.help.length+Number(l.baselineUsed),el=l.el.querySelector('.ink-state'),message=l.blocked?'墨水已耗盡，請用橡皮擦擦除筆跡':uses?'求救 '+l.help.length+' 張'+(l.baselineUsed?'＋基準卡':'')+' · 本題 ×'+Number((.8**uses).toFixed(4)):l.config.helpCards?'細筆畫圖 · 每用一張卡 ×0.8':'用細筆畫出函數圖 · 畫錯可擦除';
 el.classList.toggle('exhausted',l.blocked);if(el.textContent!==message)el.textContent=message;
}
function releasePointer(l){
 flushPointer(l);if(l.frame){cancelAnimationFrame(l.frame);l.frame=0;}
 const id=l.pointer;l.pointer=null;l.active=null;l.last=null;l.inputRect=null;
 if(id!==null&&l.canvas.hasPointerCapture(id))l.canvas.releasePointerCapture(id);
}
function updateClock(l,now=performance.now()){
 const badge=l.el.querySelector('.countdown');
 if(l.status==='drawing'){
  const seconds=Math.max(0,Math.ceil((l.deadline-now)/1000));if(badge.textContent!==seconds+' 秒')badge.textContent=seconds+' 秒';badge.classList.toggle('urgent',seconds<=10);
  if(now>=l.deadline)submit(l,true);else updateHelpButton(l,now);
 }else if(l.status==='result'){
  const seconds=Math.max(0,Math.ceil((l.feedbackDeadline-now)/1000));badge.textContent='已評分';badge.classList.remove('urgent');
  l.el.querySelector('.submit').textContent=seconds+' 秒後'+(l.index+1>=l.plan.length?'顯示總分':'自動換題');
  if(now>=l.feedbackDeadline){l.index++;if(l.index>=l.plan.length)finish(l);else newQuestion(l);}
 }
}
function submit(l,timedOut=false){
 if(l.status!=='drawing')return;
 releasePointer(l);
 l.result=E.score(l.q,l.strokes,l.help,l.baselineUsed);l.attempts++;stopHelpAnimation(l);l.status='result';l.deadline=null;l.feedbackDeadline=performance.now()+2000;
 l.scores.push({star:l.q.star,score:l.result.score,timedOut,helpCount:l.result.helpCount,factor:l.result.factor});
 l.el.classList.add('result-mode');l.el.querySelector('.result-strip').classList.add('visible');l.el.querySelector('.score').textContent=l.result.score+' 分';
 l.el.querySelector('.result-detail').innerHTML=`<strong>${timedOut?'時間到，已自動送出':'本題已評分'}</strong><br>完整度 ${l.result.coverage}% · ${l.result.helpCount?'用卡 '+l.result.helpCount+' 張 ×'+Number(l.result.factor.toFixed(4)):'比對 '+l.result.visible+' 點'}`;
 l.el.querySelector('.submit').disabled=true;l.el.querySelectorAll('[data-tool],[data-action]').forEach(b=>b.disabled=true);l.el.querySelectorAll('.help-ready').forEach(b=>b.classList.remove('help-ready'));
 l.el.querySelector('.plot-hint').textContent=l.help.length?(settings.theme==='dark'?'粉紅：求救　虛線：答案':'紫紅：求救　虛線：答案'):'實線：你的圖　虛線：參考答案';updateClock(l);draw(l);
}
function finish(l){
 l.status='finished';l.feedbackDeadline=null;l.deadline=null;const total=l.scores.reduce((s,v)=>s+v.score,0),maximum=l.plan.length*100;
 l.el.querySelector('.countdown').textContent='已完成';
 let o=l.el.querySelector('.overlay');o.style.display='flex';
 o.innerHTML=`<span class="mini-stars">★★★★★</span><h2>${l.seat?l.seat+' 號 · ':''}闖關完成</h2><span class="big-score">${total}</span><span class="score-caption">總分 / ${maximum} 分</span><div class="summary-scores">${Array.from({length:5},(_,i)=>{let ss=l.scores.filter(s=>s.star===i+1);return `<div>${i+1} 星<strong>${ss.length?ss.reduce((a,s)=>a+s.score,0):'—'}</strong></div>`;}).join('')}</div><p>完成 ${l.scores.length} 題 · 平均 ${Math.round(total/l.scores.length)} 分</p><button class="primary">下一位學生</button>`;
 bindAction(o.querySelector('button'),()=>{l.q=null;l.strokes=[];l.range=null;welcome(l);});
}
setInterval(()=>{const now=performance.now();for(const lane of lanes)updateClock(lane,now);},100);
function openSettings(){const f=$('#settingsForm');for(let k of ['theme','gridColor','gridWidth','axisFontSize','axisLabelColor','helpCards','helpFirstDelay','helpInterval','seatMin','seatMax'])f.elements[k].value=settings[k];renderLevels(settings);$('#settingsError').textContent='';$('#settingsDialog').showModal();}
function renderLevels(s){$('#levelSettings').innerHTML=s.levels.map((l,i)=>`<section class="level-card" data-level="${i}"><div class="level-title"><strong><span class="stars">${'★'.repeat(i+1)}</span> ${i===0?'基礎圖形':i+' 種圖形變化'}</strong><div class="level-options"><label class="time-label">限時<select name="seconds${i}">${Array.from({length:30},(_,j)=>{const seconds=(j+1)*10;return `<option value="${seconds}" ${l.seconds===seconds?'selected':''}>${seconds} 秒</option>`;}).join('')}</select></label><label class="count-label">題數<input type="number" name="count${i}" min="0" max="20" value="${l.count}" required></label></div></div><div class="checks">${['exp','log'].map(t=>`<label><input type="checkbox" name="type${i}" value="${t}" ${l.types.includes(t)?'checked':''}>${t==='exp'?'指數函數':'對數函數'}</label>`).join('')}</div>${i?`<div class="checks">${E.transforms.map(t=>`<label><input type="checkbox" name="trans${i}" value="${t}" ${l.transforms.includes(t)?'checked':''}>${transformNames[t]}</label>`).join('')}</div><p>每題從勾選項目取恰好 ${i} 種變化。至少勾選 ${i} 種，或將題數設為 0。底數隨機為 2 或 3。</p>`:'<p>畫出 y = 2ˣ、y = 3ˣ、y = log₂ x 或 y = log₃ x 的基礎圖形。</p>'}</section>`).join('');}
$('#settingsForm').elements.theme.onchange=e=>{const color=$('#settingsForm').elements.gridColor;if(e.target.value==='dark'&&color.value==='#dce5f0')color.value='#2a3b54';else if(e.target.value==='light'&&color.value==='#2a3b54')color.value='#dce5f0';const axisColor=$('#settingsForm').elements.axisLabelColor;if(e.target.value==='dark'&&axisColor.value==='#65778c')axisColor.value='#a8b9cf';else if(e.target.value==='light'&&axisColor.value==='#a8b9cf')axisColor.value='#65778c';};
$('#settingsBtn').onclick=openSettings;$('#helpBtn').onclick=()=>$('#helpDialog').showModal();document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());$('#defaultsBtn').onclick=()=>{let f=$('#settingsForm');for(let k of ['theme','gridColor','gridWidth','axisFontSize','axisLabelColor','helpCards','helpFirstDelay','helpInterval','seatMin','seatMax'])f.elements[k].value=E.defaults[k];renderLevels(E.defaults);$('#settingsError').textContent='';};
$('#settingsForm').onsubmit=e=>{e.preventDefault();let f=e.target,s=E.clone(settings);for(let k of ['theme','gridColor','axisLabelColor'])s[k]=f.elements[k].value;for(let k of ['gridWidth','axisFontSize','helpCards','helpFirstDelay','helpInterval','seatMin','seatMax'])s[k]=Number(f.elements[k].value);s.levels=Array.from({length:5},(_,i)=>({count:Number(f.elements['count'+i].value),seconds:Number(f.elements['seconds'+i].value),types:[...f.querySelectorAll(`[name="type${i}"]:checked`)].map(b=>b.value),transforms:[...f.querySelectorAll(`[name="trans${i}"]:checked`)].map(b=>b.value)}));let errs=E.validate(s);if(errs.length){$('#settingsError').textContent=errs.join(' ');return;}for(const l of lanes)releasePointer(l);settings=s;try{localStorage.setItem('exp-log-graph-v1-settings',JSON.stringify(settings));}catch{toast('設定已套用；此瀏覽器無法保存設定。');}applyTheme();for(let l of lanes){if(l.status==='idle')welcome(l);draw(l);}$('#settingsDialog').close();toast('設定已儲存，新題目設定從下一位學生開始。');};
$('#fullBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('請使用瀏覽器全螢幕鍵（F11）。');}};document.addEventListener('fullscreenchange',()=>$('#fullBtn').textContent=document.fullscreenElement?'離開全螢幕':'全螢幕');
document.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('dragstart',e=>e.preventDefault());document.addEventListener('selectstart',e=>{if(!e.target.closest?.('input,select'))e.preventDefault();});document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;if((e.ctrlKey&&(e.key==='u'||e.key==='U'||e.key==='+'||e.key==='-'||e.key==='='))||e.key==='F7')e.preventDefault();});
// A local bridge for automated verification; all scoring and rendering use these same functions.
window.ExpLogGame={bindAction,useHelp,useBaseline,updateHelpButton,lanes,get settings(){return settings;},start,newQuestion,submit,draw,updateInk,geometry,toPixel,toPoint,welcome,updateClock,finish,fitFormula};

