'use strict';
importScripts('engine.js?v=1.3');
self.onmessage=e=>{const {id,q,strokes,help,baseline}=e.data;try{self.postMessage({id,result:ExpLogEngine.score(q,strokes,help,baseline)});}catch{self.postMessage({id,error:true});}};
