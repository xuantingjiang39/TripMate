// Exercise the actual polling function with synthetic deferred responses; no external API calls.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=process.argv[2]||'guest-v71';
const html=await readFile(new URL(`../${source}/tripmate-mvp.html`,import.meta.url),'utf8');
const start=html.indexOf('async function pollUnifiedState');
const fn=html.slice(start,html.indexOf('    setInterval(pollUnifiedState',start));
const schema=await readFile(new URL(`../${source}/tripmate-state-schema.js`,import.meta.url),'utf8');
function fixture(){
 let state={'tripmate.v1.orders':[{id:'saved-local'}]},resolve,requests=0,writes=0,rebuilds=0;
 const owner={id:'alpha'};
 const context={authCurrentUser:owner,accountPolling:false,accountSyncInFlight:false,accountSyncQueued:false,accountSyncConflict:false,syncTimer:null,button:{disabled:false},accountStateVersion:3,accountSyncedSignature:JSON.stringify(state),notice:{textContent:''},storeKeys:{orders:'tripmate.v1.orders'},storageKey:k=>k,
  document:{visibilityState:'visible',activeElement:null,body:{dataset:{appPage:'planner'}},querySelector:()=>null},
  TripMateSyncJournal:{pending:()=>null},accountState:()=>state,
  apiJson:()=>{requests++;return new Promise(r=>resolve=r);},loadCredits:()=>{},
  localStorage:{setItem:(k,v)=>{writes++;state[k]=JSON.parse(v);},removeItem:k=>{writes++;delete state[k];}},initializeWorkspace:()=>rebuilds++};
 context.window=context;vm.createContext(context);vm.runInContext(schema,context);vm.runInContext(fn,context);
 return{context,owner,poll:()=>context.pollUnifiedState(),respond:()=>resolve({state:{'tripmate.v1.orders':[{id:'remote'}]},stateVersion:4}),requests:()=>requests,writes:()=>writes,rebuilds:()=>rebuilds,state:()=>state};
}
const blockers={
 hidden:x=>x.document.visibilityState='hidden',
 generating:x=>x.button.disabled=true,
 focusedInput:x=>x.document.activeElement={matches:()=>true},
 openDialog:x=>x.document.querySelector=()=>({open:true}),
 ...Object.fromEntries(['preferences','orders','reminders','tools','admin'].map(page=>[page,x=>x.document.body.dataset.appPage=page]))
};
for(const [name,block] of Object.entries(blockers)){
 const before=fixture();block(before.context);await before.poll();assert.equal(before.requests(),0,name+' blocks a new read');
 const late=fixture(),task=late.poll();assert.equal(late.requests(),1);block(late.context);late.respond();await task;
 assert.equal(late.writes(),0,name+' blocks a late response');assert.equal(late.rebuilds(),0);assert.equal(late.context.accountStateVersion,3);assert.equal(late.context.accountPolling,false);
}
for(const page of ['planner','today','saved','wallet']){
 const x=fixture();x.context.document.body.dataset.appPage=page;const task=x.poll();x.respond();await task;
 assert.equal(x.writes(),1,page+' remains refreshable');assert.equal(x.rebuilds(),1);assert.equal(x.context.accountStateVersion,4);
}
for(const mutate of [x=>x.authCurrentUser={id:'beta'},x=>x.accountSyncQueued=true,x=>x.accountSyncInFlight=true,x=>x.accountSyncConflict=true,x=>x.accountStateVersion=5]){
 const x=fixture(),task=x.poll();mutate(x.context);x.respond();await task;assert.equal(x.writes(),0);assert.equal(x.rebuilds(),0);
}
const local=fixture(),task=local.poll();local.state()['tripmate.v1.orders'].push({id:'new-local'});local.respond();await task;assert.equal(local.writes(),0);assert.equal(local.state()['tripmate.v1.orders'].length,2);
console.log('PASS 9 editing/visibility blockers before GET and after response; 4 reading pages refresh; account change, queued/inflight writes, conflict, version change and new local edits preserve records.');
