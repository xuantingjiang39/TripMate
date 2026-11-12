// Deferred UI operations only; no real users or network.
import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../guest-v68/tripmate-mvp.html',import.meta.url),'utf8');const start=html.indexOf("$('#confirm-account-restore').onclick="),end=html.indexOf('\n    };',start)+7,code=html.slice(start,end);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function setup(){
 const before=deferred(),after=deferred(),nodes=new Map(),button={disabled:false,setAttribute:()=>{},removeAttribute:()=>{}},calls=[];
 const owner={id:'synthetic'},backup={data:{state:{'tripmate.v1.orders':[{id:'selected'}]}}};let dirty=false,installs=0,conflicts=0,downloads=0;
 const context={authCurrentUser:owner,pendingAccountRestore:backup,accountStateVersion:1,accountSyncConflict:false,accountSyncedSignature:'initial',$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},TripMateSyncJournal:{pending:()=>dirty,clear:()=>{dirty=false;}},apiJson:(path,options)=>{calls.push({path,options});return path.endsWith('/export')?before.promise:after.promise;},downloadAccountBackup:()=>downloads++,installImportedState:()=>installs++,stateSignature:()=> 'saved',accountState:()=>backup.data.state,clearRestorePreview:()=>{context.pendingAccountRestore=null;},initializeWorkspace:()=>{},restoreSummary:()=> 'synthetic result',switchAppPage:()=>{},setAccountSyncConflict:()=>{conflicts++;context.accountSyncConflict=true;},Error};
 vm.createContext(context);vm.runInContext(code,context);const run=()=>nodes.get('#confirm-account-restore').onclick({currentTarget:button});
 return{context,before,after,nodes,button,calls,run,dirty:value=>dirty=value,installs:()=>installs,conflicts:()=>conflicts,downloads:()=>downloads};
}
const valid={restoreVersionCheck:true,stateVersion:4};
const waitForImport=async x=>{for(let i=0;i<10&&x.calls.length<2;i++)await new Promise(setImmediate);assert.equal(x.calls.length,2,'Import must be pending before injecting a later event');};
{
 const x=setup(),pending=x.run();x.context.pendingAccountRestore=null;x.before.resolve(valid);await pending;assert.equal(x.calls.length,1);assert.equal(x.downloads(),0);assert(!x.button.disabled);
}
{
 const x=setup(),pending=x.run(),replacement={data:{state:{}}};x.context.pendingAccountRestore=replacement;x.before.resolve(valid);await pending;assert.equal(x.calls.length,1);assert.equal(x.context.pendingAccountRestore,replacement);
}
{
 const x=setup(),pending=x.run();x.dirty(true);x.before.resolve(valid);await pending;assert.equal(x.calls.length,1);assert.equal(x.installs(),0);
}
{
 const x=setup(),pending=x.run();x.before.resolve({});await pending;assert.equal(x.calls.length,1);assert(x.nodes.get('#profile-message').textContent.includes('v67'));
}
{
 const x=setup(),pending=x.run();x.before.resolve(valid);await waitForImport(x);x.dirty(true);x.after.resolve({stateVersion:5});await pending;assert.equal(x.installs(),0);assert.equal(x.conflicts(),1);assert.equal(x.context.accountStateVersion,5);assert(x.nodes.get('#profile-message').textContent.includes('本机新修改未被替换'));
}
{
 const x=setup(),pending=x.run();x.before.resolve(valid);await waitForImport(x);x.after.reject(Object.assign(Error('synthetic network error'),{code:'NETWORK_UNREACHABLE'}));await pending;assert(x.nodes.get('#profile-message').textContent.includes('未能确认恢复结果'));assert.equal(x.calls.length,2);assert(!x.button.disabled);
}
{
 const x=setup(),pending=x.run();x.before.resolve(valid);await Promise.resolve();x.after.resolve({stateVersion:5});await pending;assert.equal(x.installs(),1);assert.equal(x.context.accountSyncedSignature,'saved');assert.equal(JSON.parse(x.calls[1].options.body).expectedStateVersion,4);assert.equal(x.context.pendingAccountRestore,null);
}
{
 const x=setup(),pending=x.run();x.before.resolve(valid);await waitForImport(x);x.context.authCurrentUser={id:'new'};x.nodes.get('#profile-message').textContent='new account status';x.after.reject(Object.assign(Error('synthetic account switch'),{code:'AUTH_CONTEXT_CHANGED'}));await pending;assert.equal(x.nodes.get('#profile-message').textContent,'new account status');assert(x.button.disabled,'A late restore must not unlock a newer operation');
}
console.log('PASS 8 restore UI interleavings: cancel/reselect/local edits/old server stop before POST, edits during restore preserved, uncertain result not retried, success updates baseline and old callbacks do not touch a newer account.');
