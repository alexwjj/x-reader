import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
test('optional analytics requests no permission or network at startup', async()=>{
 const source=(await readFile(new URL('../src/popup/analytics.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
 let listener,requests=0,started=0,stopped=0,removed=0;
 const toggle={checked:false,addEventListener:(name,fn)=>listener=fn};
 const chrome={storage:{local:{get:async()=>({}),set:async()=>{}}},permissions:{contains:async()=>false,request:async()=>{requests++;return true;},remove:async()=>{removed++;}}};
 runInNewContext(source,{document:{getElementById:()=>toggle},chrome,createHubAnalytics:()=>{started++;return{stop:()=>stopped++};}});
 await new Promise(setImmediate);
 assert.equal(started,0);assert.equal(requests,0);
 toggle.checked=true;await listener();assert.equal(requests,1);assert.equal(started,1);
 toggle.checked=false;await listener();assert.equal(stopped,1);assert.equal(removed,1);
});
