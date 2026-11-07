// Real isolated Node HTTP + SQLite-backed D1 adapter. No production accounts or paid APIs.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes,scryptSync,createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mergeTravelStates} from '../guest-v60/tripmate-merge.mjs';
const root=resolve(import.meta.dirname,'..'),dir=await mkdtemp(join(tmpdir(),'tripmate-v60-'));
const key='tripmate.v1.trips',stateA={[key]:[{id:'same',plan:{title:'国内行程'}},{id:'dupe',plan:{title:'共有'}}],'tripmate.v1.draft':{title:'国内草稿'},'tripmate.v1.preferences':{pace:'relaxed'}},stateB={[key]:[{id:'same',plan:{title:'国际行程'}},{id:'dupe',plan:{title:'共有'}}],'tripmate.v1.draft':{title:'国际草稿'},'tripmate.v1.orders':[{id:'global-order',amount:5}]};
const merged=mergeTravelStates(stateA,stateB);assert.equal(merged.state[key].length,4);assert.equal(merged.summary.duplicates,1);assert.equal(new Set(merged.state[key].map(x=>x.id)).size,4);assert.deepEqual(stateA[key][0],{id:'same',plan:{title:'国内行程'}});
assert.equal(mergeTravelStates({'tripmate.v1.orders':[{id:'order-1',amount:100}]},{'tripmate.v1.orders':[{id:'order-2',amount:100}]}).state['tripmate.v1.orders'].length,2,'Equal-price bookings with different IDs are never collapsed');
assert(!Object.hasOwn(mergeTravelStates({...stateA,creditBalance:999},stateB).state,'creditBalance'));
assert.throws(()=>mergeTravelStates({[key]:{}},{}));assert.throws(()=>mergeTravelStates({'tripmate.v1.draft':{note:'x'.repeat(1_500_000)}},{}));
assert.equal(mergeTravelStates({[key]:Array.from({length:30},(_,i)=>({id:'a'+i,title:'A'+i}))},{[key]:Array.from({length:30},(_,i)=>({id:'b'+i,title:'B'+i}))}).state[key].length,60,'Merge never trims to the former UI list limits');
const salt=randomBytes(16).toString('hex'),password=randomBytes(20).toString('hex');
const users=['alpha','beta'].map((id,i)=>({id,name:id,email:id+'@example.invalid',passwordSalt:salt,passwordHash:scryptSync(password,salt,64).toString('hex'),role:'user',creditBalance:37+i,creditTransactions:[{id:'ledger',amount:37+i}],stateVersion:0,state:structuredClone(i?{[key]:[{id:'private',title:'另一账号'}]}:stateA)}));
await writeFile(join(dir,'accounts.json'),JSON.stringify({version:2,users,sessions:[],guests:[]}));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const child=spawn(process.execPath,[join(root,'guest-v60/tripmate-ai-server.mjs')],{env:{...process.env,PORT:String(port),TRIPMATE_DATA_DIR:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});
await new Promise((r,j)=>{child.stdout.once('data',r);child.once('error',j);setTimeout(()=>j(Error('Startup timeout')),10000).unref();});
const base='http://127.0.0.1:'+port,actualFetch=globalThis.fetch;
const call=async(path,{cookie='',method='GET',body,headers={}}={})=>{const r=await actualFetch(base+path,{method,headers:{cookie,'content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});let json;try{json=await r.json();}catch{}return{status:r.status,json,headers:r.headers};};
const db=new DatabaseSync(join(dir,'global.sqlite'));
for(const name of (await readdir(join(root,'TripMate-overseas-v60/drizzle'))).filter(n=>n.endsWith('.sql')).sort())db.exec(await readFile(join(root,'TripMate-overseas-v60/drizzle',name),'utf8'));
class Prepared{
 constructor(sql,values=[]){this.sql=sql;this.values=values;}bind(...values){return new Prepared(this.sql,values);}async first(){return db.prepare(this.sql).get(...this.values)||null;}async all(){return{results:db.prepare(this.sql).all(...this.values)};}async run(){const r=db.prepare(this.sql).run(...this.values);return{success:true,meta:{changes:Number(r.changes)}};}
}
const env={DB:{prepare:sql=>new Prepared(sql),batch:async statements=>{db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}}};
const globalTokens={};
for(const id of ['alpha','beta']){const token=randomBytes(24).toString('hex');globalTokens[id]=token;db.prepare('INSERT INTO public_users (id,email,email_normalized,display_name,password_hash,password_salt,status,role,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id,id+'-global@example.invalid',id+'-global@example.invalid',id,'unused','unused','active','user',new Date().toISOString());db.prepare('INSERT INTO public_sessions VALUES (?,?,?,?)').run(createHash('sha256').update(token).digest('hex'),id,new Date(Date.now()+3600000).toISOString(),new Date().toISOString());db.prepare('INSERT INTO app_state VALUES (?,?,?)').run(id,JSON.stringify(id==='alpha'?stateB:{[key]:[{id:'secret-beta'}]}),'2026-11-01T00:00:00.000Z');}
let offline=false,loseActivateResponse=false;
globalThis.fetch=async()=>{throw Error('Workers must not fetch IP origins or external services in this test');};
const worker=(await import(pathToFileURL(join(root,'TripMate-overseas-v60/dist/server/index.js'))+'?t='+Date.now())).default;
const globalOrigin='https://tripmate-travel-planner.xuantingjiang39.chatgpt.site';
const workerCall=async(path,{id='alpha',body,method=body?'POST':'GET',origin=globalOrigin}={})=>{const response=await worker.fetch(new Request(globalOrigin+path,{method,headers:{cookie:'tripmate_session='+globalTokens[id],origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);return{status:response.status,json:await response.json()};};
const directCall=async(action,token,body,method=body?'POST':'GET')=>{
 if(offline)return{status:503,json:{error:'Offline test'}};
 const result=await call('/api/bridge/'+action,{method,body,headers:{origin:globalOrigin,...(token?{'x-tripmate-sync-token':token}:{})}});
 assert.equal(result.headers.get('access-control-allow-origin'),globalOrigin);assert.equal(result.headers.get('access-control-allow-credentials'),null);
 if(action==='activate'&&loseActivateResponse){loseActivateResponse=false;return{status:503,json:{error:'Lost response test'}};}
 return result;
};
const globalCall=async(path,options={})=>{
 const {body,id='alpha',origin=globalOrigin}=options;
 if(origin!==globalOrigin)return workerCall(path,options);
 if(path==='/api/bridge/link'&&body?.code){
  const redeemed=await directCall('redeem',null,{code:body.code,peerEmail:id+'-global@example.invalid'});if(redeemed.status!==200)return redeemed;
  const {token,...domestic}=redeemed.json;return workerCall(path,{...options,body:{token,domestic,preferred:body.preferred}});
 }
 if(path==='/api/bridge/preview'){
  const a=await workerCall('/api/bridge/access',{id});if(a.status!==200)return a;const d=await directCall('state',a.json.token);if(d.status!==200)return d;
  return workerCall(path,{...options,body:{domestic:d.json,preferred:body.preferred}});
 }
 if(path==='/api/bridge/confirm'){
  const a=await workerCall('/api/bridge/access',{id}),p=await workerCall('/api/bridge/prepare-confirm',{id});if(p.status!==200)return p;
  if(p.json.activationId!==body.activationId)return{status:409,json:{error:'Preview changed'}};
  const d=await directCall('activate',a.json.token,p.json);if(d.status!==200)return d;
  return workerCall(path,{...options,body:{activationId:body.activationId,activated:true}});
 }
 if(path==='/api/bridge/disconnect'){
  const a=await workerCall('/api/bridge/access',{id});if(a.status!==200)return a;const d=await directCall('state',a.json.token);if(d.status!==200)return d;
  const r=await workerCall(path,{...options,body:{domestic:d.json}});if(r.status===200)await directCall('disconnect',a.json.token,{});return r;
 }
 let result=await workerCall(path,options);
 if(result.json.clientBridge){const saving=options.method==='PUT';const d=await directCall('state',result.json.token,saving?{state:body.data,stateVersion:body.stateVersion}:undefined,saving?'PUT':'GET');if(d.status!==200)return d;return{status:200,json:{data:d.json.state,stateVersion:d.json.stateVersion,shared:true}};}
 if(path==='/api/bridge/backup'){const a=await workerCall('/api/bridge/access',{id});if(a.status===200&&a.json.status==='active'){const d=await directCall('state',a.json.token);if(d.status===200)result.json.currentShared=d.json;else result.json.sharedUnavailable=true;}}
 return result;
};
let uiServer;
try{
 const cookies={};for(const id of ['alpha','beta']){const r=await call('/api/auth/login',{method:'POST',body:{email:id+'@example.invalid',password}});assert.equal(r.status,200);cookies[id]=r.headers.get('set-cookie').split(';')[0];}
 assert.equal((await call('/api/bridge/code',{method:'POST',body:{}})).status,401);
 assert.equal((await call('/api/bridge/code',{cookie:cookies.alpha,method:'POST',headers:{origin:'https://evil.invalid'},body:{}})).status,403);
 assert.equal((await globalCall('/api/bridge/link',{body:{code:'bad'},origin:'https://evil.invalid'})).status,403);
 const expired=(await call('/api/bridge/code',{cookie:cookies.alpha,method:'POST',body:{}})).json.code;
 const expiredFixture=JSON.parse(await readFile(join(dir,'accounts.json'),'utf8'));expiredFixture.users[0].regionalBridge.codeExpiresAt=Date.now()-1;await writeFile(join(dir,'accounts.json'),JSON.stringify(expiredFixture));
 assert.equal((await directCall('redeem',null,{code:expired})).status,401,'Expired code rejected');
 const cloud=(await globalCall('/api/sync')).json;assert.equal(typeof cloud.stateVersion,'string');
 assert.equal((await globalCall('/api/sync',{method:'PUT',body:{data:stateB,stateVersion:'stale'}})).status,409);
 const saved=await globalCall('/api/sync',{method:'PUT',body:{data:stateB,stateVersion:cloud.stateVersion}});assert.equal(saved.status,200);
 let code=(await call('/api/bridge/code',{cookie:cookies.alpha,method:'POST',body:{}})).json.code;
 assert(!JSON.stringify(await (await readFile(join(dir,'accounts.json'),'utf8'))).includes(code),'Code stored hashed');
 let preview=await globalCall('/api/bridge/link',{body:{code,preferred:'domestic'}});assert.equal(preview.status,200,JSON.stringify(preview.json));assert.equal(preview.json.summary.after.trips,4);
 assert(!JSON.stringify(preview.json).includes('tokenHash'));assert(!Object.hasOwn(preview.json,'token'));
 assert.equal((await globalCall('/api/bridge/link',{id:'beta',body:{code}})).status,401,'Code single use');
 assert.equal((await globalCall('/api/sync',{method:'PUT',body:{data:stateB,stateVersion:saved.json.stateVersion}})).status,409,'Freeze writes during preview');
 const originalGlobal=JSON.parse(db.prepare('SELECT data FROM app_state WHERE id=?').get('alpha').data);assert.deepEqual(originalGlobal,stateB);
 const a=await call('/api/account/state',{cookie:cookies.alpha});
 const changed={...a.json.state,'tripmate.v1.reminders':[{id:'concurrent'}]};
 assert.equal((await call('/api/account/state',{cookie:cookies.alpha,method:'PUT',body:{state:changed,stateVersion:a.json.stateVersion}})).status,200);
 assert.equal((await globalCall('/api/bridge/confirm',{body:{activationId:preview.json.activationId}})).status,409,'Concurrent domestic edit refuses stale merge');
 const oldPreviewId=preview.json.activationId;
 preview=await globalCall('/api/bridge/preview',{body:{preferred:'overseas'}});assert.equal(preview.status,200);
 assert.notEqual(preview.json.activationId,oldPreviewId);assert.equal((await globalCall('/api/bridge/confirm',{body:{activationId:oldPreviewId}})).status,409,'An old tab cannot confirm a newly changed preview');
 const betaBefore=(await call('/api/account/export',{cookie:cookies.beta})).json;
 loseActivateResponse=true;assert.equal((await globalCall('/api/bridge/confirm',{body:{activationId:preview.json.activationId}})).status,503,'Lost activation response');
 const pendingBackup=(await call('/api/account/state',{cookie:cookies.alpha})).json;
 const newer={...pendingBackup.state,'tripmate.v1.expenses':[{id:'after-activation',amount:1}]};
 assert.equal((await call('/api/account/state',{cookie:cookies.alpha,method:'PUT',body:{state:newer,stateVersion:pendingBackup.stateVersion}})).status,200);
 assert.equal((await globalCall('/api/bridge/confirm',{body:{activationId:preview.json.activationId}})).status,200,'Idempotent confirm retry');
 const shared=(await globalCall('/api/sync')).json;assert.equal(shared.shared,true);assert.deepEqual(shared.data['tripmate.v1.expenses'],newer['tripmate.v1.expenses']);assert.equal(shared.data['tripmate.v1.draft'].title,'国际草稿');
 assert.deepEqual((await call('/api/account/export',{cookie:cookies.beta})).json.data,betaBefore.data,'Domestic account isolation');
 assert.equal((await globalCall('/api/sync',{id:'beta'})).json.data[key][0].id,'secret-beta','Global account isolation');
 assert.equal((await call('/api/credits',{cookie:cookies.alpha})).json.balance,37,'Credits unchanged');
 const grant=db.prepare('SELECT token FROM regional_links WHERE user_id=?').get('alpha').token;
 assert.equal((await call('/api/credits',{headers:{'x-tripmate-sync-token':grant}})).status,401,'Grant cannot access credits');
 const dirty={...shared.data,'tripmate.v1.orders':[...shared.data['tripmate.v1.orders'],{id:'shared-new'}]};
 assert.equal((await globalCall('/api/sync',{method:'PUT',body:{data:dirty,stateVersion:shared.stateVersion}})).status,200);
 assert.equal((await globalCall('/api/sync',{method:'PUT',body:{data:shared.data,stateVersion:shared.stateVersion}})).status,409,'CAS shared writes');
 const backup=(await globalCall('/api/bridge/backup')).json;assert.deepEqual(backup.overseasOriginal,stateB);assert.deepEqual(backup.domesticBefore,changed);assert(!JSON.stringify(backup).includes(grant));
 offline=true;assert.equal((await globalCall('/api/sync')).status,503);assert.equal((await globalCall('/api/bridge/disconnect',{body:{}})).status,503,'Offline disconnect cannot restore stale copy');assert.equal((await globalCall('/api/bridge/backup')).json.sharedUnavailable,true);offline=false;
 // Desktop/mobile UI against the same local Worker adapter with synthetic session cookies.
 uiServer=createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const result=await worker.fetch(new Request(globalOrigin+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),env);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}catch{res.writeHead(500);res.end();}});
 await new Promise(r=>uiServer.listen(0,'127.0.0.1',r));const uiBase='http://127.0.0.1:'+uiServer.address().port;
 const {chromium}=await import(pathToFileURL(join(root,'TripMate-desktop-v54/node_modules/playwright-core/index.mjs')));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
   for(const width of [390,1280]){
     const context=await browser.newContext({viewport:{width,height:844}});await context.addCookies([{name:'tripmate_session',value:globalTokens.alpha,url:globalOrigin}]);await context.route(globalOrigin+'/**',async route=>{const req=route.request();const response=await route.fetch({url:uiBase+new URL(req.url()).pathname+new URL(req.url()).search,headers:await req.allHeaders()});await route.fulfill({response});});
     await context.route('https://111.230.133.155/api/bridge/**',async route=>{const req=route.request(),headers=await req.allHeaders();assert(!headers.cookie,'No cookies sent cross-site');const response=await route.fetch({url:base+new URL(req.url()).pathname,headers});await route.fulfill({response});});
     const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
     await page.goto(globalOrigin+'/account-link');await page.locator('#connection-state').filter({hasText:'已启用共享记录'}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('#backup').isVisible());await page.screenshot({path:join(dir,'shared-'+width+'.png'),fullPage:true});
     await page.goto(globalOrigin+'/');try{await page.waitForFunction(()=>document.querySelector('#cloud-status')?.textContent==='已同步',null,{timeout:5000});}catch(error){console.error('Workspace diagnostics:',errors,await page.locator('#cloud-status').textContent());throw error;}
     assert.deepEqual(errors,[],'Main workspace must render real linked records');
     await page.screenshot({path:join(dir,'workspace-'+width+'.png'),fullPage:true});
     if(width===390){
       let release,entered;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});let intercepted=false;
       await page.route('**/api/sync',async route=>{if(route.request().method()==='PUT'&&!intercepted){intercepted=true;const response=await route.fetch({url:uiBase+'/api/sync',headers:await route.request().allHeaders()});entered();await gate;await route.fulfill({response});}else await route.fallback();});
       await page.evaluate(()=>{writeStore(storeKeys.orders,[...readStore(storeKeys.orders,[]),{id:'during-push-1'}]);clearTimeout(syncTimer);});
       const pushing=page.evaluate(()=>pushCloudState());await started;
       await page.evaluate(()=>writeStore(storeKeys.orders,[...readStore(storeKeys.orders,[]),{id:'during-push-2'}]));release();await pushing;
       await page.waitForFunction(()=>!localStorage.getItem('tripmate.v1.syncDirty'));
       assert((await globalCall('/api/sync')).json.data['tripmate.v1.orders'].some(x=>x.id==='during-push-2'),'Edits during an in-flight save are not dropped');
       await page.unroute('**/api/sync');
       await page.evaluate(()=>{writeStore(storeKeys.draft,{title:'本机未同步修改'});clearTimeout(syncTimer);});
       const live=(await globalCall('/api/sync')).json;
       assert.equal((await globalCall('/api/sync',{method:'PUT',body:{data:{...live.data,'tripmate.v1.reminders':[{id:'remote-new',text:'远端新提醒',date:'',time:''}]},stateVersion:live.stateVersion}})).status,200);
       await page.evaluate(()=>syncFromCloud());assert.equal(await page.evaluate(()=>readStore(storeKeys.draft,{}).title),'本机未同步修改');
       await page.reload();await page.waitForFunction(()=>document.querySelector('#cloud-status')?.textContent.includes('云端与本机都有修改'));assert.equal(await page.evaluate(()=>readStore(storeKeys.draft,{}).title),'本机未同步修改','Reload retains dirty local records');
       await page.goto(globalOrigin+'/account-link');await page.locator('#local-backup').waitFor();await page.locator('#local-backup').click();await page.locator('#result').filter({hasText:'本机备份已交给浏览器下载'}).waitFor();await page.check('#cloud-consent');await page.locator('#use-cloud').click();try{await page.locator('#result').filter({hasText:'此浏览器已采用云端记录'}).waitFor({timeout:5000});}catch(e){console.error('Use-cloud diagnostics:',await page.locator('#result').textContent(),errors);throw e;}assert.equal(await page.evaluate(()=>localStorage.getItem('tripmate.v1.syncDirty')),null);
     }
     assert.deepEqual(errors,[]);await context.close();
   }
 }finally{await browser.close();}
 assert.equal((await globalCall('/api/bridge/disconnect',{body:{}})).status,200);
 assert.equal(db.prepare('SELECT count(*) AS n FROM regional_archives WHERE user_id=?').get('alpha').n,1);
 const after=(await globalCall('/api/sync')).json;assert(after.data['tripmate.v1.orders'].some(x=>x.id==='shared-new'));
 assert.equal((await call('/api/bridge/state',{headers:{'x-tripmate-sync-token':grant}})).status,401,'Disconnect revoked grant');
 const archives=(await globalCall('/api/bridge/backup')).json.archives;assert.equal(archives.length,1);assert.equal((await globalCall('/api/bridge/archive?id='+archives[0].id)).status,200);assert.equal((await globalCall('/api/bridge/archive?id='+archives[0].id,{id:'beta'})).status,404);
 // A fresh code can be cancelled with zero changes to either account's records.
 const beforeCancel=(await call('/api/account/state',{cookie:cookies.alpha})).json;
 code=(await call('/api/bridge/code',{cookie:cookies.alpha,method:'POST',body:{}})).json.code;
 assert.equal((await globalCall('/api/bridge/link',{body:{code,preferred:'domestic'}})).status,200);
 assert.equal((await globalCall('/api/bridge/disconnect',{body:{}})).status,200);
 assert.deepEqual((await call('/api/account/state',{cookie:cookies.alpha})).json.state,beforeCancel.state);
 // Actual browser connection, preview, explicit confirmation and disconnect, using local endpoints only.
 code=(await call('/api/bridge/code',{cookie:cookies.alpha,method:'POST',body:{}})).json.code;
 const uiBrowser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  for(const width of [390,1280]){
   const context=await uiBrowser.newContext({viewport:{width,height:844}});await context.addCookies([{name:'tripmate_session',value:globalTokens.alpha,url:globalOrigin}]);
   await context.route(globalOrigin+'/**',async route=>{const req=route.request();const response=await route.fetch({url:uiBase+new URL(req.url()).pathname+new URL(req.url()).search,headers:await req.allHeaders()});await route.fulfill({response});});
   await context.route('https://111.230.133.155/api/bridge/**',async route=>{const req=route.request(),headers=await req.allHeaders();assert(!headers.cookie);const response=await route.fetch({url:base+new URL(req.url()).pathname,headers});await route.fulfill({response});});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(globalOrigin+'/account-link');await page.locator('#account').filter({hasText:'alpha-global'}).waitFor();await page.check('#transfer-consent');
   if(width===390){await page.fill('#paste-code',code);await page.locator('#connect').click();}else await page.locator('#refresh-preview').click();
   await page.locator('#counts table').waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(dir,'preview-'+width+'.png'),fullPage:true});
   if(width===1280){await page.check('#confirm-consent');await page.locator('#confirm').click();await page.locator('#result').filter({hasText:'合并完成'}).waitFor();page.on('dialog',d=>d.accept());await page.locator('#disconnect').click();await page.locator('#result').filter({hasText:'连接已解除'}).waitFor();}
   assert.deepEqual(errors,[]);await context.close();
  }
 }finally{await uiBrowser.close();}
 const preflight=await call('/api/bridge/state',{method:'OPTIONS',headers:{origin:globalOrigin,'access-control-request-method':'PUT','access-control-request-headers':'x-tripmate-sync-token,content-type'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),globalOrigin);
 const deniedCors=await call('/api/bridge/state',{method:'OPTIONS',headers:{origin:'https://evil.invalid'}});assert.equal(deniedCors.headers.get('access-control-allow-origin'),null);
 const finalAccounts=JSON.parse(await readFile(join(dir,'accounts.json'),'utf8'));assert.equal(finalAccounts.users[0].creditBalance,37);assert.deepEqual(finalAccounts.users[0].creditTransactions,users[0].creditTransactions);
 console.log('PASS v60: merge dedup/conflicts/drafts, explicit link ownership, CSRF, one-use code, narrow grant, original backups, cancel, idempotent activation, concurrent edits/CAS, shared read/write, no offline stale fallback, two-account isolation, unchanged credit ledger, disconnect copy and revocation, archive isolation, real local SQLite/HTTP and desktop/mobile browser. Artifacts:',dir);
}finally{globalThis.fetch=actualFetch;child.kill();if(uiServer){uiServer.closeAllConnections();await new Promise(r=>uiServer.close(r));}db.close();}
