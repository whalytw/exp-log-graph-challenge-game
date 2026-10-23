'use strict';
// Lightweight DOM fixture for state and Pointer Events tests; it does not render CSS.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Element{
 constructor(tag='div',attrs={}){this.tag=tag;this.attrs=attrs;this.dataset=Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5),v]));this.children=[];this.style={};this.listeners={};this.hidden=false;this.disabled=false;this.checked='checked'in attrs;this.value=attrs.value||'';this.clientWidth=460;this.clientHeight=440;this.scrollWidth=0;this.captured=new Set();this._text='';this.classList={add:(c)=>this.className=[...new Set(this.className.split(' ').concat(c))].join(' '),remove:(c)=>this.className=this.className.split(' ').filter(x=>x!==c).join(' '),contains:c=>this.className.split(' ').includes(c),toggle:(c,on)=>{on??=!this.classList.contains(c);on?this.classList.add(c):this.classList.remove(c);return on;}};}
 get value(){if(this.tag==='select'&&!this._value){const opts=this.querySelectorAll('option');return (opts.find(o=>'selected'in o.attrs)||opts[0])?.attrs.value||'';}return this._value||'';}set value(v){this._value=String(v);}
 get className(){return this.attrs.class||'';}set className(v){this.attrs.class=v;}
 set textContent(v){this._text=String(v);}get textContent(){return this._text;}
 set innerHTML(html){this.children=[];parse(html,this);}get innerHTML(){return '';}
 appendChild(e){this.children.push(e);e.parent=this;return e;}
 setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 querySelectorAll(s){const result=[],selectors=s.split(',');function walk(el){for(const ch of el.children){if(selectors.some(s=>matches(ch,s.trim())))result.push(ch);walk(ch);}}walk(this);return result;}
 get elements(){const self=this;return new Proxy({}, {get(_,name){return self.querySelector('[name="'+String(name)+'"]');}});}
 addEventListener(type,cb){(this.listeners[type]??=[]).push(cb);}
 fire(type,extra={}){const e={type,button:0,detail:1,preventDefault(){},...extra};for(const cb of this.listeners[type]||[])cb(e);}
 getBoundingClientRect(){return {left:0,top:0,width:460,height:440};}
 getContext(){return new Proxy({measureText:s=>({width:String(s).length*8}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]??(()=>{})});}
 setPointerCapture(id){this.captured.add(id);}hasPointerCapture(id){return this.captured.has(id);}releasePointerCapture(id){this.captured.delete(id);}
 showModal(){this.attrs.open='';}close(){delete this.attrs.open;}
}
function matches(el,s){let checked=s.endsWith(':checked');if(checked){if(!el.checked)return false;s=s.replace(':checked','');}const attr=s.match(/\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]/);if(attr){if(!(attr[1]in el.attrs)||attr[2]!==undefined&&el.attrs[attr[1]]!==attr[2])return false;s=s.replace(attr[0],'');}if(!s)return true;if(s[0]==='#')return el.attrs.id===s.slice(1);if(s[0]==='.')return el.classList.contains(s.slice(1));return el.tag===s;}
function parse(html,parent){const stack=[parent];for(const m of html.matchAll(/<\/?[a-zA-Z][^>]*>/g)){const tok=m[0];if(tok.startsWith('</')){if(stack.length>1)stack.pop();continue;}const tag=tok.match(/^<([^\s/>]+)/)[1],attrs={};for(const a of tok.slice(tag.length+1,-1).matchAll(/([\w-]+)(?:="([^"]*)"|'([^']*)')?/g))attrs[a[1]]=a[2]??a[3]??'';const e=new Element(tag,attrs);stack.at(-1).appendChild(e);if(!['meta','link','input','br','hr','img'].includes(tag)&&!tok.endsWith('/>'))stack.push(e);}}
function fixture(extra={}){
 const doc=new Element('document');parse(fs.readFileSync(__dirname+'/../index.html','utf8'),doc);doc.body=doc.querySelector('body');doc.createElement=t=>new Element(t);
 const windowEvents={};let now=1000,raf=0;const frames=new Map();const context={window:{devicePixelRatio:1},document:doc,localStorage:{getItem:()=>null,setItem(){}},performance:{now:()=>now},ResizeObserver:class{observe(){}},requestAnimationFrame:cb=>{frames.set(++raf,cb);return raf;},cancelAnimationFrame:id=>frames.delete(id),setInterval(){},setTimeout(){},clearTimeout(){},getComputedStyle:()=>({fontSize:'28px',getPropertyValue:()=> '#aaa4ff'}),addEventListener:(type,cb)=>(windowEvents[type]??=[]).push(cb),console,...extra};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../engine.js','utf8'),context);vm.runInContext(fs.readFileSync(__dirname+'/../app.js','utf8'),context);
 return {G:context.ExpLogGame,E:context.ExpLogEngine,doc,clock:t=>now=t,windowEvent:type=>(windowEvents[type]||[]).forEach(cb=>cb()),frame:()=>{const current=[...frames.values()];frames.clear();current.forEach(cb=>cb());}};
}
test('three independent sessions, one baseline card, countdown synchronization and reset',()=>{
 const {G,E,clock}=fixture(),[a,b,c]=G.lanes;
 for(const [i,l] of G.lanes.entries())G.start(l,String(i+1));
 a.index=a.plan.indexOf(2);G.newQuestion(a);b.index=b.plan.indexOf(2);G.newQuestion(b);const untouched=JSON.stringify([b.q,c.q,b.index,c.index,b.deadline,c.deadline]);
 G.useBaseline(a);assert.equal(a.baselineUsed,false);
 clock(a.questionStarted+15000);G.updateHelpButton(a);
 assert.equal(a.el.querySelector('[data-action=help]').disabled,false);assert.equal(a.el.querySelector('[data-action=baseline]').disabled,false);
 G.useBaseline(a);assert.equal(a.baselineUsed,true);assert.equal(a.help.length,0);assert.equal(a.el.querySelector('[data-action=baseline]').disabled,true);
 G.useBaseline(a);assert.equal(a.help.length,0);assert.equal(b.baselineUsed,false);
 G.useHelp(a);assert.equal(a.help.length,1);assert.equal(b.help.length,0);assert.equal(a.baselineUsed,true);
 a.strokes=E.targetPaths(a.q);G.submit(a);assert.equal(a.result.score,64);assert.equal(JSON.stringify([b.q,c.q,b.index,c.index,b.deadline,c.deadline]),untouched);
 clock(a.feedbackDeadline+1);G.updateClock(a);assert.equal(a.index,3);assert.equal(a.baselineUsed,false);assert.equal(a.help.length,0);
 assert.equal(c.el.querySelector('[data-action=baseline]').hidden,true);
});
test('secondary pointers can draw and activate another lane without mixing strokes',()=>{
 const {G,clock}=fixture(),[a,b,c]=G.lanes;G.lanes.forEach(l=>G.start(l,''));
 const point=(l,x,y)=>{const p=G.toPixel(l,{x,y});return {clientX:p.x,clientY:p.y};};
 a.canvas.fire('pointerdown',{pointerId:41,isPrimary:true,...point(a,-2,1)});
 b.canvas.fire('pointerdown',{pointerId:42,isPrimary:false,...point(b,1,2)});
 b.canvas.fire('pointermove',{pointerId:41,...point(b,3,5)});assert.equal(b.pending.length,0);
 a.canvas.fire('pointermove',{pointerId:41,...point(a,0,2)});b.canvas.fire('pointermove',{pointerId:42,...point(b,2,4)});
 c.el.querySelector('[data-tool=eraser]').fire('pointerdown',{pointerId:43,isPrimary:false});assert.equal(c.tool,'eraser');assert.equal(a.pointer,41);assert.equal(b.pointer,42);
 a.canvas.fire('pointerup',{pointerId:41,...point(a,0,2)});b.canvas.fire('pointerup',{pointerId:42,...point(b,2,4)});
 assert.equal(a.pointer,null);assert.equal(b.pointer,null);assert.ok(a.strokes.flat().length>10);assert.ok(b.strokes.flat().length>10);assert.equal(c.strokes.length,0);
 assert.ok(a.strokes.flat().every(p=>p.x<=.001));assert.ok(b.strokes.flat().every(p=>p.x>=.999));
 clock(a.deadline+1);G.updateClock(a);assert.equal(a.status,'result');assert.equal(b.status,'drawing');
});
test('one lane can finish and restart while the others continue',()=>{
 const {G,E,clock}=fixture(),[a,b,c]=G.lanes;G.lanes.forEach(l=>G.start(l,''));
 a.index=a.plan.length-1;G.newQuestion(a);a.strokes=E.targetPaths(a.q);G.submit(a);clock(a.feedbackDeadline+1);G.updateClock(a);
 assert.equal(a.status,'finished');assert.equal(b.status,'drawing');assert.equal(c.status,'drawing');
 a.el.querySelector('.overlay').querySelector('button').fire('pointerdown',{pointerId:9,isPrimary:false});assert.equal(a.status,'idle');G.start(a,'8');assert.equal(a.seat,'8');assert.equal(a.index,0);assert.equal(b.index,0);
});
test('teacher settings contain only five levels; active configurations are retained',()=>{
 const {G,doc}=fixture(),a=G.lanes[0];G.start(a,'');const activeSeconds=a.config.levels[0].seconds;
 doc.querySelector('#settingsBtn').onclick();const form=doc.querySelector('#settingsForm');assert.equal(doc.querySelectorAll('.level-card').length,5);assert.equal(form.querySelectorAll('[value="sin"]').length,0);
 form.elements.seconds0.value='100';form.onsubmit({target:form,preventDefault(){}});assert.equal(G.settings.levels[0].seconds,100);assert.equal(a.config.levels[0].seconds,activeSeconds);
 G.start(G.lanes[1],'');assert.equal(G.lanes[1].config.levels[0].seconds,100);
});
test('teacher base checkboxes are sorted, validate selection and apply to the next student',()=>{
 const {G,doc}=fixture(),a=G.lanes[0];G.start(a,'');doc.querySelector('#settingsBtn').onclick();const form=doc.querySelector('#settingsForm'),choices=form.querySelectorAll('[name="bases"]');
 assert.deepEqual(choices.map(b=>Number(b.value)),[.1,.2,1/3,.5,2,3,5,10]);assert.deepEqual(choices.filter(b=>b.checked).map(b=>Number(b.value)),[1/3,.5,2,3]);
 choices.forEach(b=>b.checked=false);form.onsubmit({target:form,preventDefault(){}});assert.ok(doc.querySelector('#settingsError').textContent.length>0);
 choices.forEach(b=>b.checked=[.1,10].includes(Number(b.value)));form.onsubmit({target:form,preventDefault(){}});assert.equal(JSON.stringify(G.settings.bases),'[0.1,10]');assert.equal(JSON.stringify(a.config.bases),'[0.3333333333333333,0.5,2,3]');
 G.start(G.lanes[1],'');assert.ok([.1,10].includes(G.lanes[1].q.base));
 doc.querySelector('#settingsBtn').onclick();doc.querySelector('#defaultsBtn').onclick();assert.deepEqual(form.querySelectorAll('[name="bases"]:checked').map(b=>Number(b.value)),[1/3,.5,2,3]);assert.deepEqual(Array.from({length:5},(_,i)=>Number(form.elements['count'+i].value)),[2,1,1,0,0]);
});
test('one shared function selector applies to every star, validates empty choices and restores defaults',()=>{
 const {G,doc}=fixture(),[a,b,c]=G.lanes;G.start(a,'');doc.querySelector('#settingsBtn').onclick();const form=doc.querySelector('#settingsForm'),choices=form.querySelectorAll('[name="types"]');
 assert.equal(choices.length,2);assert.deepEqual(choices.map(b=>b.value),['exp','log']);assert.ok(choices.every(b=>b.checked));for(const card of doc.querySelectorAll('.level-card'))assert.equal(card.querySelectorAll('input').filter(b=>/^type/.test(b.attrs.name)).length,0);
 choices.forEach(b=>b.checked=false);form.onsubmit({target:form,preventDefault(){}});assert.ok(doc.querySelector('#settingsError').textContent.includes('出題函數'));
 choices[0].checked=true;form.onsubmit({target:form,preventDefault(){}});assert.equal(JSON.stringify(G.settings.types),'["exp"]');assert.equal(JSON.stringify(a.config.types),'["exp","log"]');
 G.start(b,'');b.plan=[1,2,3,4,5];for(let i=0;i<5;i++){b.index=i;G.newQuestion(b);assert.equal(b.q.type,'exp');}
 doc.querySelector('#settingsBtn').onclick();const nextChoices=form.querySelectorAll('[name="types"]');nextChoices.forEach(b=>b.checked=b.value==='log');form.onsubmit({target:form,preventDefault(){}});assert.equal(JSON.stringify(b.config.types),'["exp"]');
 G.start(c,'');c.plan=[1,2,3,4,5];for(let i=0;i<5;i++){c.index=i;G.newQuestion(c);assert.equal(c.q.type,'log');}
 doc.querySelector('#settingsBtn').onclick();doc.querySelector('#defaultsBtn').onclick();assert.deepEqual(form.querySelectorAll('[name="types"]:checked').map(b=>b.value),['exp','log']);
});
test('three simultaneous contacts retain coalesced samples and the driver endpoint',()=>{
 const {G,frame}=fixture();G.lanes.forEach(l=>G.start(l,''));
 const position=(l,x,y)=>{const p=G.toPixel(l,{x,y});return {clientX:p.x,clientY:p.y};};
 for(const l of G.lanes)l.canvas.fire('pointerdown',{pointerId:70+l.i,pointerType:'touch',isPrimary:l.i===0,...position(l,-4,1)});
 for(let step=1;step<=15;step++){
  for(const l of G.lanes){const mid=position(l,-4+(step-.5)*.3,1+step*.05);l.canvas.fire('pointermove',{pointerId:70+l.i,pointerType:'touch',isPrimary:l.i===0,getCoalescedEvents:()=>[mid],...position(l,-4+step*.3,1+step*.05)});}
  frame();
 }
 for(const l of G.lanes){assert.equal(l.pointer,70+l.i);assert.ok(Math.abs(l.strokes.at(-1).at(-1).x-.5)<1e-8);assert.ok(l.strokes.flat().length>30);l.canvas.fire('pointerup',{pointerId:70+l.i,...position(l,.8,2)});assert.equal(l.pointer,null);}
});
test('buttons act on every contact, deduplicate that contact only and retain click-only input',()=>{
 const {G,doc}=fixture(),button=new Element('button');let count=0;G.bindAction(button,()=>count++);
 button.fire('pointerdown',{pointerId:1,pointerType:'touch',isPrimary:true,clientX:10,clientY:10});
 button.fire('pointerdown',{pointerId:2,pointerType:'touch',isPrimary:false,clientX:10,clientY:10});assert.equal(count,2);
 button.fire('pointerup',{pointerId:1});button.fire('click',{pointerId:1,pointerType:'touch',clientX:10,clientY:10});assert.equal(count,2);assert.ok(button.classList.contains('pressed'));
 button.fire('pointerup',{pointerId:2});button.fire('click',{pointerId:2,pointerType:'touch',clientX:10,clientY:10});assert.equal(count,2);assert.ok(!button.classList.contains('pressed'));
 for(let i=3;i<15;i++){button.fire('pointerdown',{pointerId:i,isPrimary:false,clientX:10,clientY:10});button.fire('pointerup',{pointerId:i});button.fire('click',{pointerId:i,clientX:10,clientY:10});}assert.equal(count,14);
 button.fire('click',{clientX:200,clientY:200});assert.equal(count,15);button.fire('click',{detail:0});assert.equal(count,16);
 button.fire('pointerdown',{pointerId:50});assert.ok(button.classList.contains('pressed'));doc.fire('pointercancel',{pointerId:50});assert.ok(!button.classList.contains('pressed'));
});
test('cancellation, outside release, capture loss and page blur allow subsequent drawing',()=>{
 const {G,doc,windowEvent}=fixture();G.lanes.forEach(l=>G.start(l,''));const position=(l,x,y)=>{const p=G.toPixel(l,{x,y});return {clientX:p.x,clientY:p.y};};
 const [a,b,c]=G.lanes;G.lanes.forEach(l=>l.canvas.fire('pointerdown',{pointerId:10+l.i,...position(l,-2,1)}));
 b.canvas.fire('pointercancel',{pointerId:11});assert.equal(b.pointer,null);assert.equal(a.pointer,10);assert.equal(c.pointer,12);
 b.canvas.fire('pointerdown',{pointerId:21,...position(b,0,2)});b.canvas.fire('lostpointercapture',{pointerId:21});assert.equal(b.pointer,null);
 doc.fire('pointerup',{pointerId:10,...position(a,20,1)});assert.equal(a.pointer,null);assert.ok(Math.abs(a.strokes.at(-1).at(-1).x-10)<1e-7);
 windowEvent('blur');assert.equal(c.pointer,null);
 G.lanes.forEach(l=>{l.canvas.fire('pointerdown',{pointerId:30+l.i,...position(l,0,1)});l.canvas.fire('pointerup',{pointerId:30+l.i,...position(l,1,2)});assert.equal(l.pointer,null);assert.ok(l.strokes.some(s=>s.some(p=>Math.abs(p.x-1)<1e-7)));});
});
test('dragging out of a revealed interval starts ink without requiring a new contact',()=>{
 const {G}=fixture(),l=G.lanes[0];G.start(l,'');l.help=[8];const position=(x,y)=>{const p=G.toPixel(l,{x,y});return {clientX:p.x,clientY:p.y};};
 l.canvas.fire('pointerdown',{pointerId:7,...position(2.5,1)});assert.equal(l.pointer,7);assert.equal(l.strokes.length,0);
 l.canvas.fire('pointerup',{pointerId:7,...position(4,1)});assert.ok(l.strokes.flat().some(p=>p.x>3));assert.ok(l.strokes.flat().every(p=>p.x>3));
});
test('drawing reuses grid, existing ink and baseline calculations across frames',()=>{
 const {G,E,clock,frame}=fixture(),l=G.lanes[0];G.start(l,'');l.index=l.plan.indexOf(2);G.newQuestion(l);clock(l.questionStarted+15000);
 let paths=0;const original=E.targetPaths;E.targetPaths=(...args)=>{paths++;return original(...args);};G.useBaseline(l);const baselineCalls=paths,bg=l.backgroundLayer,ink=l.inkLayer;
 const position=(x,y)=>{const p=G.toPixel(l,{x,y});return {clientX:p.x,clientY:p.y};};l.canvas.fire('pointerdown',{pointerId:55,...position(-3,1)});
 for(let i=1;i<=30;i++){l.canvas.fire('pointermove',{pointerId:55,...position(-3+i*.1,1+i*.02)});frame();}
 assert.equal(l.backgroundLayer,bg);assert.equal(l.inkLayer,ink);assert.equal(paths,baselineCalls);assert.ok(l.strokes.flat().length>30);
 l.canvas.fire('pointerup',{pointerId:55,...position(0,2)});G.useHelp(l);assert.notEqual(l.backgroundLayer,bg);assert.equal(l.inkLayer.source,l.strokes);
});
test('background scoring keeps the other students drawing while a result is pending',()=>{
 let worker;class WorkerStub{constructor(){worker=this;this.jobs=[];}postMessage(job){this.jobs.push(job);}terminate(){}}
 const {G,E}=fixture({Worker:WorkerStub}),[a,b,c]=G.lanes;G.lanes.forEach(l=>G.start(l,''));a.strokes=E.targetPaths(a.q);G.submit(a);assert.equal(a.status,'grading');assert.equal(worker.jobs.length,1);
 for(const l of [b,c]){const p=G.toPixel(l,{x:1,y:2}),end=G.toPixel(l,{x:2,y:3});l.canvas.fire('pointerdown',{pointerId:100+l.i,clientX:p.x,clientY:p.y});l.canvas.fire('pointerup',{pointerId:100+l.i,clientX:end.x,clientY:end.y});assert.ok(l.strokes.flat().length>2);assert.equal(l.status,'drawing');}
 const job=worker.jobs[0];worker.onmessage({data:{id:job.id,result:E.score(job.q,job.strokes,job.help,job.baseline)}});assert.equal(a.status,'result');assert.equal(a.result.score,100);
});
test('a failed worker falls back to scoring once without leaving a lane stuck',()=>{
 let worker;class WorkerStub{constructor(){worker=this;}postMessage(){}terminate(){}}
 const {G,E}=fixture({Worker:WorkerStub}),l=G.lanes[0];G.start(l,'');l.strokes=E.targetPaths(l.q);G.submit(l);assert.equal(l.status,'grading');worker.onerror({preventDefault(){}});assert.equal(l.status,'result');assert.equal(l.attempts,1);assert.equal(l.result.score,100);
});
