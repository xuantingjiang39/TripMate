// Deferred file reads against the actual restore-selection handlers. Synthetic data only.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=process.argv[2]||'guest-v70';
const html=await readFile(new URL(`../${source}/tripmate-mvp.html`,import.meta.url),'utf8');
const clearStart=html.indexOf('function clearRestorePreview()'),clearEnd=html.indexOf('\n',clearStart);
const start=html.indexOf("$('#account-backup-file').onchange="),end=html.indexOf('\n    async function pollUnifiedState',start);
const code=html.slice(clearStart,clearEnd)+'\n'+html.slice(start,end);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function setup(){
 const nodes=new Map(),owner={id:'alpha',email:'alpha@example.invalid'};
 const context={authCurrentUser:owner,accountRestoreReadGeneration:0,pendingAccountRestore:null,TripMateStateSchema:{assertState:()=>{}},restoreSummary:()=> 'synthetic summary',$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}};
 vm.createContext(context);vm.runInContext(code,context);
 const select=(name,read)=>nodes.get('#account-backup-file').onchange({target:{files:[{name,size:100,text:()=>read.promise}]}});
 const content=(title,email=owner.email)=>JSON.stringify({format:'tripmate-account-backup',version:1,user:{email},data:{state:{'tripmate.v1.draft':{title}}}});
 const title=()=>context.pendingAccountRestore?.data.state['tripmate.v1.draft'].title;
 return{context,nodes,select,content,title,cancel:()=>nodes.get('#cancel-account-restore').onclick()};
}
{
 const x=setup(),a=deferred(),b=deferred(),pa=x.select('old.json',a),pb=x.select('new.json',b);
 b.resolve(x.content('new'));await pb;a.resolve(x.content('old'));await pa;
 assert.equal(x.title(),'new','A slow older file must never replace a newer selected backup');
 assert.equal(x.nodes.get('#restore-file-name').textContent,'new.json');
}
{
 const x=setup(),a=deferred(),b=deferred(),pa=x.select('invalid.json',a),pb=x.select('new.json',b);
 b.resolve(x.content('new'));await pb;a.resolve('{broken-json');await pa;
 assert.equal(x.title(),'new','Late parse failures must not clear the new preview');
 assert(x.nodes.get('#profile-message').textContent.includes('通过本机检查'));
}
{
 const x=setup(),a=deferred(),pa=x.select('old.json',a);x.cancel();a.resolve(x.content('old'));await pa;
 assert.equal(x.context.pendingAccountRestore,null);assert(x.nodes.get('#restore-preview').hidden);
 assert(x.nodes.get('#profile-message').textContent.includes('已取消'));
}
for(const fail of [false,true]){
 const x=setup(),a=deferred(),pa=x.select('alpha-private.json',a);
 x.context.authCurrentUser={id:'beta',email:'beta@example.invalid'};
 if(fail)vm.runInContext('clearRestorePreview()',x.context);
 x.nodes.get('#profile-message').textContent='beta status';
 if(fail)a.reject(Error('private-alpha-error'));else a.resolve(x.content('alpha private'));
 await pa;assert.equal(x.nodes.get('#profile-message').textContent,'beta status');assert.equal(x.context.pendingAccountRestore,null);
}
{
 const x=setup(),a=deferred(),pa=x.select('before-logout.json',a);x.context.authCurrentUser=null;
 vm.runInContext('clearRestorePreview()',x.context);x.nodes.get('#profile-message').textContent='signed out';a.resolve(x.content('private'));await pa;
 assert.equal(x.context.pendingAccountRestore,null);assert.equal(x.nodes.get('#profile-message').textContent,'signed out');
}
{
 const x=setup(),a=deferred(),pa=x.select('valid.json',a);a.resolve(x.content('valid'));await pa;
 assert.equal(x.title(),'valid');assert.equal(x.nodes.get('#restore-preview').hidden,false);
 const b=deferred(),pb=x.select('bad.json',b);b.resolve('{broken-json');await pb;
 assert.equal(x.context.pendingAccountRestore,null);assert(x.nodes.get('#profile-message').textContent.includes('无法读取备份'));
}
console.log('PASS 7 file-read races: newest file wins, stale failure ignored, cancellation, account switch success/failure, logout and current valid/invalid files.');
