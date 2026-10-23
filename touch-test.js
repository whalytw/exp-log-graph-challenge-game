'use strict';
const active=new Map(),names=['左區','中區','右區'],panels=[],total={max:0},types=new Set();
for(let i=0;i<3;i++){
 const el=document.createElement('section');el.className='panel';el.dataset.lane=String(i);el.innerHTML=`<h2>${names[i]}</h2><div class="stats" role="status"></div><div class="surface"><canvas aria-label="${names[i]}觸控測試畫布"></canvas></div><button class="tap">點按測試：0 次</button>`;document.querySelector('#panels').appendChild(el);
 const canvas=el.querySelector('canvas'),p={el,canvas,ctx:canvas.getContext('2d'),down:0,move:0,samples:0,up:0,cancel:0,lost:0,taps:0,max:0,queue:[],frame:0};panels.push(p);
 new ResizeObserver(()=>{const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);p.ctx.setTransform(dpr,0,0,dpr,0,0);}).observe(el.querySelector('.surface'));
 const tap=el.querySelector('.tap');tap.addEventListener('pointerdown',e=>{e.preventDefault();p.taps++;tap.textContent='點按測試：'+p.taps+' 次';tap.classList.add('pressed');},{passive:false});tap.addEventListener('click',e=>{if(e.detail===0&&!e.pointerType){p.taps++;tap.textContent='點按測試：'+p.taps+' 次';}});
}
function point(canvas,e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function paint(p){p.frame=0;const c=p.ctx;c.strokeStyle=['#aaa4ff','#45d9c5','#ffd080'][panels.indexOf(p)];c.lineWidth=3;c.lineCap='round';c.lineJoin='round';for(const [a,b] of p.queue){c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x+(a.x===b.x&&a.y===b.y?.2:0),b.y);c.stroke();}p.queue=[];}
function queue(p,a,b){p.queue.push([a,b]);if(!p.frame)p.frame=requestAnimationFrame(()=>paint(p));}
document.addEventListener('pointerdown',e=>{
 const el=e.target.closest?.('.panel');if(!el||e.button>0)return;e.preventDefault();const p=panels[Number(el.dataset.lane)],drawing=e.target===p.canvas,last=drawing?point(p.canvas,e):null;
 active.set(e.pointerId,{p,drawing,last,target:e.target});p.down++;types.add(e.pointerType||'未提供');total.max=Math.max(total.max,active.size);p.max=Math.max(p.max,[...active.values()].filter(v=>v.p===p).length);try{e.target.setPointerCapture(e.pointerId);}catch{}if(drawing)queue(p,last,last);
},{capture:true,passive:false});
document.addEventListener('pointermove',e=>{const contact=active.get(e.pointerId);if(!contact)return;e.preventDefault();const p=contact.p,events=e.getCoalescedEvents?.()||[];p.move++;const last=events[events.length-1],samples=events.slice();if(!last||last.clientX!==e.clientX||last.clientY!==e.clientY)samples.push(e);p.samples+=samples.length;if(contact.drawing)for(const sample of samples){const next=point(p.canvas,sample);queue(p,contact.last,next);contact.last=next;}},{capture:true,passive:false});
function end(e){const contact=active.get(e.pointerId);if(!contact)return;const p=contact.p;active.delete(e.pointerId);if(e.type==='pointercancel')p.cancel++;else if(e.type==='lostpointercapture')p.lost++;else{p.up++;if(contact.drawing&&Number.isFinite(e.clientX))queue(p,contact.last,point(p.canvas,e));}if(![...active.values()].some(v=>v.p===p&&!v.drawing))p.el.querySelector('.tap').classList.remove('pressed');}
for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,end,true);
function releaseAll(){for(const [pointerId] of [...active])end({pointerId,type:'pointercancel'});}
window.addEventListener('blur',releaseAll);window.addEventListener('pagehide',releaseAll);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll();});
setInterval(()=>{document.querySelector('#total').textContent=`目前觸點 ${active.size} · 最大同時觸點 ${total.max} · 收到類型：${[...types].join('、')||'等待觸控'}`;for(const p of panels){const count=[...active.values()].filter(v=>v.p===p).length;p.el.querySelector('.stats').textContent=`目前 ${count} 點／最多 ${p.max} 點｜按下 ${p.down} 次\n移動 ${p.move} 次／樣本 ${p.samples}｜放開 ${p.up}\n取消 ${p.cancel}／捕獲中斷 ${p.lost}`;p.el.querySelector('.stats').style.whiteSpace='pre-line';}},200);
function clearTest(){releaseAll();total.max=0;types.clear();for(const p of panels){if(p.frame)cancelAnimationFrame(p.frame);p.frame=0;p.queue=[];for(const key of ['down','move','samples','up','cancel','lost','taps','max'])p[key]=0;p.ctx.clearRect(0,0,p.canvas.width,p.canvas.height);p.el.querySelector('.tap').textContent='點按測試：0 次';}}
document.querySelector('#clear').addEventListener('pointerdown',e=>{e.preventDefault();clearTest();});document.querySelector('#clear').addEventListener('click',e=>{if(e.detail===0&&!e.pointerType)clearTest();});
document.querySelector('#full').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{document.querySelector('#full').textContent='請按 F11';}});
document.addEventListener('contextmenu',e=>e.preventDefault());
