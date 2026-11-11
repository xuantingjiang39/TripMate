// Synthetic accounts on an isolated local server only.
import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {createServer} from 'node:http';import {spawn} from 'node:child_process';import {randomBytes,scryptSync} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),source=process.argv[2]||'guest-v67',dir=await mkdtemp(join(tmpdir(),'tripmate-v67-restore-'));
const password=randomBytes(18).toString('hex'),salt=randomBytes(16).toString('hex');
const users=['alpha','beta'].map(id=>({id,email:id+'@example.invalid',name:id,role:'user',passwordSalt:salt,passwordHash:scryptSync(password,salt,64).toString('hex'),creditBalance:73,creditTransactions:[{id:id+'-gift',type:'gift',amount:73,detail:'synthetic fixture',createdAt:new Date().toISOString()}],stateVersion:5,state:{'tripmate.v1.orders':[{id:id+'-order',name:id+' initial',amount:150}]}}));
await writeFile(join(dir,'accounts.json'),JSON.stringify({version:2,users,sessions:[],guests:[]}));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const child=spawn(process.execPath,[join(root,source,'tripmate-ai-server.mjs')],{env:{...process.env,PORT:String(port),TRIPMATE_DATA_DIR:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((r,j)=>{child.stdout.once('data',r);child.once('error',j);setTimeout(()=>j(Error('startup timeout')),10000).unref();});
const base='http://127.0.0.1:'+port,call=async(path,token,body)=>{const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'x-tripmate-client':'native',...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json()};};
try{
 const token=(await call('/api/auth/login','',{email:users[0].email,password})).data.token;
 const backup={format:'tripmate-account-backup',version:1,user:{email:users[0].email,id:'alpha'},data:{state:{'tripmate.v1.orders':[{id:'restored',name:'fixture backup',amount:20}]},creditBalance:999999,creditTransactions:[{id:'injected',amount:999999}]}};
 if(source==='guest-v66'){
  await fetch(base+'/api/account/state',{method:'PUT',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({state:{'tripmate.v1.orders':[{id:'newer-device-order',amount:300}]},stateVersion:5})});
  const stale=await call('/api/account/import',token,{...backup,expectedStateVersion:5});
  assert.equal(stale.status,409,'A backup prepared before a newer cloud write must not overwrite it');
 }
 assert.equal((await call('/api/account/import',token,backup)).status,428,'Unversioned restore must not overwrite current records');
 const exported=(await call('/api/account/export',token)).data;assert.equal(exported.stateVersion,5);assert.equal(exported.restoreVersionCheck,true);assert(!JSON.stringify(exported).includes('passwordHash'));
 for(const value of [-1,1.5,'5',null])assert.equal((await call('/api/account/import',token,{...backup,expectedStateVersion:value})).status,400);
 const newerState={'tripmate.v1.orders':[{id:'other-device',name:'newer cloud order',amount:250}]};
 const put=await fetch(base+'/api/account/state',{method:'PUT',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({state:newerState,stateVersion:5})});assert.equal(put.status,200);
 const conflict=await call('/api/account/import',token,{...backup,expectedStateVersion:exported.stateVersion});assert.equal(conflict.status,409);assert.equal(conflict.data.code,'RESTORE_CONFLICT');assert.equal(conflict.data.stateVersion,6);
 assert.deepEqual((await call('/api/account/state',token)).data.state,newerState);
 const other=await call('/api/account/import',token,{...backup,user:{email:users[1].email},expectedStateVersion:6});assert.equal(other.status,403);
 const attempts=await Promise.all([call('/api/account/import',token,{...backup,expectedStateVersion:6}),call('/api/account/import',token,{...backup,expectedStateVersion:6})]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
 const after=(await call('/api/account/state',token)).data;assert.equal(after.stateVersion,7);assert.deepEqual(after.state,backup.data.state);
 const raw=JSON.parse(await readFile(join(dir,'accounts.json'),'utf8')),alpha=raw.users.find(u=>u.id==='alpha'),beta=raw.users.find(u=>u.id==='beta');
 assert.equal(alpha.creditBalance,73);assert.equal(alpha.role,'user');assert.equal(alpha.creditTransactions.length,1);assert.deepEqual(beta.state,users[1].state);assert.equal(beta.stateVersion,5);
 assert.equal((await call('/api/account/import','',{...backup,expectedStateVersion:7})).status,401);
 console.log('PASS versioned restore: unversioned/invalid input rejected, consistent export snapshot, stale/concurrent restore blocked atomically, current restore succeeds, cross-account/credit/role isolation.');
}finally{child.kill();}
