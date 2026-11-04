import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const source=(await readFile(new URL('../src/popup/analytics.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
async function setup(saved){
 let listener,started=0,stopped=0;
 const toggle={checked:false,addEventListener:(_,fn)=>listener=fn};
 runInNewContext(source,{document:{getElementById:()=>toggle},chrome:{storage:{local:{get:async()=>saved,set:async()=>{}}}},createHubAnalytics:options=>{assert.equal(options.projectId,'x-reader');started++;return{stop:options=>{assert.equal(options.flush,false);stopped++;}};}});
 await new Promise(setImmediate);return{toggle,change:()=>listener(),counts:()=>({started,stopped})};
}
test('analytics starts by default, can be disabled without a final send',async()=>{const s=await setup({});assert.equal(s.counts().started,1);s.toggle.checked=false;await s.change();assert.equal(s.counts().stopped,1);});
test('explicit opt-out persists across popup opens',async()=>{const s=await setup({hubAnalyticsEnabled:false});assert.equal(s.counts().started,0);assert.equal(s.toggle.checked,false);});
