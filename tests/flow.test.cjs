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
 fire(type,extra={}){const e={button:0,detail:1,preventDefault(){},...extra};for(const cb of this.listeners[type]||[])cb(e);}
 getBoundingClientRect(){return {left:0,top:0,width:460,height:440};}
 getContext(){return new Proxy({measureText:s=>({width:String(s).length*8}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]??(()=>{})});}
 setPointerCapture(id){this.captured.add(id);}hasPointerCapture(id){return this.captured.has(id);}releasePointerCapture(id){this.captured.delete(id);}
 showModal(){this.attrs.open='';}close(){delete this.attrs.open;}
}
function matches(el,s){let checked=s.endsWith(':checked');if(checked){if(!el.checked)return false;s=s.replace(':checked','');}const attr=s.match(/\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]/);if(attr){if(!(attr[1]in el.attrs)||attr[2]!==undefined&&el.attrs[attr[1]]!==attr[2])return false;s=s.replace(attr[0],'');}if(!s)return true;if(s[0]==='#')return el.attrs.id===s.slice(1);if(s[0]==='.')return el.classList.contains(s.slice(1));return el.tag===s;}
function parse(html,parent){const stack=[parent];for(const m of html.matchAll(/<\/?[a-zA-Z][^>]*>/g)){const tok=m[0];if(tok.startsWith('</')){if(stack.length>1)stack.pop();continue;}const tag=tok.match(/^<([^\s/>]+)/)[1],attrs={};for(const a of tok.slice(tag.length+1,-1).matchAll(/([\w-]+)(?:="([^"]*)"|'([^']*)')?/g))attrs[a[1]]=a[2]??a[3]??'';const e=new Element(tag,attrs);stack.at(-1).appendChild(e);if(!['meta','link','input','br','hr','img'].includes(tag)&&!tok.endsWith('/>'))stack.push(e);}}
function fixture(){
 const doc=new Element('document');parse(fs.readFileSync(__dirname+'/../index.html','utf8'),doc);doc.body=doc.querySelector('body');doc.createElement=t=>new Element(t);
 let now=1000,raf=0;const context={window:{devicePixelRatio:1},document:doc,localStorage:{getItem:()=>null,setItem(){}},performance:{now:()=>now},ResizeObserver:class{observe(){}},requestAnimationFrame:()=>++raf,cancelAnimationFrame(){},setInterval(){},setTimeout(){},clearTimeout(){},getComputedStyle:()=>({fontSize:'28px',getPropertyValue:()=> '#aaa4ff'}),console};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../engine.js','utf8'),context);vm.runInContext(fs.readFileSync(__dirname+'/../app.js','utf8'),context);
 return {G:context.ExpLogGame,E:context.ExpLogEngine,doc,clock:t=>now=t};
}
test('three independent sessions, one baseline card, countdown synchronization and reset',()=>{
 const {G,E,clock}=fixture(),[a,b,c]=G.lanes;
 for(const [i,l] of G.lanes.entries())G.start(l,String(i+1));
 a.index=1;G.newQuestion(a);b.index=1;G.newQuestion(b);const untouched=JSON.stringify([b.q,c.q,b.index,c.index,b.deadline,c.deadline]);
 G.useBaseline(a);assert.equal(a.baselineUsed,false);
 clock(a.questionStarted+15000);G.updateHelpButton(a);
 assert.equal(a.el.querySelector('[data-action=help]').disabled,false);assert.equal(a.el.querySelector('[data-action=baseline]').disabled,false);
 G.useBaseline(a);assert.equal(a.baselineUsed,true);assert.equal(a.help.length,0);assert.equal(a.el.querySelector('[data-action=baseline]').disabled,true);
 G.useBaseline(a);assert.equal(a.help.length,0);assert.equal(b.baselineUsed,false);
 G.useHelp(a);assert.equal(a.help.length,1);assert.equal(b.help.length,0);assert.equal(a.baselineUsed,true);
 a.strokes=E.targetPaths(a.q);G.submit(a);assert.equal(a.result.score,64);assert.equal(JSON.stringify([b.q,c.q,b.index,c.index,b.deadline,c.deadline]),untouched);
 clock(a.feedbackDeadline+1);G.updateClock(a);assert.equal(a.index,2);assert.equal(a.baselineUsed,false);assert.equal(a.help.length,0);
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
