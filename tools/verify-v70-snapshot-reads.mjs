// Actual page read/apply functions, deferred synthetic API responses and in-memory storage.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=process.argv[2]||'guest-v70',html=await readFile(new URL(`../${source}/tripmate-mvp.html`,import.meta.url),'utf8');
const schema=await readFile(new URL(`../${source}/tripmate-state-schema.js`,import.meta.url),'utf8');
const slice=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const functions=slice('async function loadAccountState','async function activateUser')+slice("$('#load-cloud-preserving-local').onclick", "$('#choose-account-backup').onclick")+slice('async function pollUnifiedState',"    setInterval(pollUnifiedState");
const original={'tripmate.v1.draft':{title:'local draft',days:[]},'tripmate.v1.orders':[{id:'local-order'}]},user={id:'alpha'};
function setup(payload){
 const storage=new Map(Object.entries(original).map(([k,v])=>[k,JSON.stringify(v)])),nodes=new Map();let writes=0,initializes=0,clears=0,archives=0;
 const context={authCurrentUser:user,accountStateVersion:5,accountSyncConflict:false,accountSyncedSignature:JSON.stringify(original),accountPolling:false,accountSyncInFlight:false,accountSyncQueued:false,syncTimer:null,button:{disabled:false},document:{visibilityState:'visible',activeElement:null},notice:{textContent:''},storeKeys:{draft:'tripmate.v1.draft',orders:'tripmate.v1.orders'},storageKey:k=>k,
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{writes++;storage.set(k,v);},removeItem:k=>{writes++;storage.delete(k);}},
  $:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},accountState:()=>Object.fromEntries([...storage].map(([k,v])=>[k,JSON.parse(v)])),stateSignature:JSON.stringify,apiJson:async()=>payload,
  TripMateSyncJournal:{pending:()=>null,clear:()=>clears++,mark:()=>{throw Error('Unexpected write journal');},archive:()=>archives++},
  initializeWorkspace:()=>initializes++,loadCredits:()=>{},scheduleAccountSync:()=>{},renderSyncRecoveries:()=>{},localAccountBackup:()=>({}),setAccountSyncConflict:()=>{},installImportedState:state=>{for(const k of Object.keys(original)){writes++;if(Object.hasOwn(state,k))storage.set(k,JSON.stringify(state[k]));else storage.delete(k);}}};
 context.window=context;vm.createContext(context);vm.runInContext(schema,context);vm.runInContext(functions,context);
 return{context,nodes,storage,poll:()=>context.pollUnifiedState(),load:()=>context.loadAccountState(),cloud:()=>{context.accountSyncConflict=true;return nodes.get('#load-cloud-preserving-local').onclick({currentTarget:{disabled:false}});},writes:()=>writes,initializes:()=>initializes,clears:()=>clears,archives:()=>archives};
}
const invalid=[{stateVersion:6},{state:null,stateVersion:6},{state:[],stateVersion:6},{state:original},{state:original,stateVersion:'6'},{state:original,stateVersion:6.5},{state:original,stateVersion:-1},{state:original,stateVersion:6,ok:false},{state:{'tripmate.v1.orders':[null]},stateVersion:6}];
for(const payload of invalid){
 for(const mode of ['poll','load','cloud']){
  const x=setup(payload);
  if(mode==='load')await assert.rejects(x.load());else await x[mode]();
  assert.deepEqual(x.context.accountState(),original,`${mode}: incomplete snapshots must preserve local records`);
  assert.equal(x.writes(),0);assert.equal(x.initializes(),0);assert.equal(x.clears(),0);assert.equal(x.archives(),0);assert.equal(x.context.accountStateVersion,5);
 }
}
for(const mode of ['poll','cloud']){
 const x=setup({state:{},stateVersion:4});await x[mode]();assert.deepEqual(x.context.accountState(),original);assert.equal(x.writes(),0);assert.equal(x.context.accountStateVersion,5);
}
for(const mode of ['poll','load','cloud']){
 const x=setup({state:{},stateVersion:6});await x[mode]();assert.deepEqual(x.context.accountState(),{},'An explicit validated empty state is legitimate');assert.equal(x.context.accountStateVersion,6);
}
for(const mode of ['poll','cloud']){
 const x=setup(null);let reject;
 x.context.apiJson=()=>new Promise((_,fail)=>{reject=fail;});
 const task=x[mode]();x.context.authCurrentUser={id:'beta'};
 x.context.notice.textContent='beta notice';x.context.$('#profile-message').textContent='beta profile';
 reject(Object.assign(Error('old account read failed'),{code:'STATE_SNAPSHOT_INVALID'}));await task;
 assert.equal(x.context.notice.textContent,'beta notice');assert.equal(x.nodes.get('#profile-message').textContent,'beta profile');assert.equal(x.writes(),0);
}
console.log('PASS 9 invalid snapshots across initial load, polling and cloud switch; stale versions preserve data; explicit valid empty state still applies.');
