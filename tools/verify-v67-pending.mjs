// Real local server/browser, synthetic users only. No production APIs or paid work.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {createServer} from 'node:http';import {spawn} from 'node:child_process';
import {randomBytes,scryptSync} from 'node:crypto';import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..'),source=process.argv[2]||'guest-v67',dir=await mkdtemp(join(tmpdir(),'tripmate-v67-pending-'));
const password=randomBytes(18).toString('hex'),salt=randomBytes(16).toString('hex');
const plan=title=>({title,days:[{day:'第1天',events:[],city:'杭州'}],budget:{currency:'CNY',total:100},transportLegs:[],recommendations:{hotels:[],restaurants:[]}});
const users=['alpha','beta'].map(id=>({id,email:id+'@example.invalid',name:id,role:'user',passwordSalt:salt,passwordHash:scryptSync(password,salt,64).toString('hex'),creditBalance:37,creditTransactions:[],stateVersion:1,state:{'tripmate.v1.draft':plan(id+'云端原稿'),'tripmate.v1.trips':[],'tripmate.v1.orders':[]}}));
await writeFile(join(dir,'accounts.json'),JSON.stringify({version:2,users,sessions:[],guests:[]}));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const child=spawn(process.execPath,[join(root,source,'tripmate-ai-server.mjs')],{env:{...process.env,PORT:String(port),TRIPMATE_DATA_DIR:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});
await new Promise((r,j)=>{child.stdout.once('data',r);child.once('error',j);setTimeout(()=>j(Error('startup timeout')),10000).unref();});
const base='http://127.0.0.1:'+port;
const {chromium}=await import(pathToFileURL(join(root,'TripMate-desktop-v54/node_modules/playwright-core/index.mjs')));const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const login=async id=>{await page.goto(base);await page.fill('#login-email',id+'@example.invalid');await page.fill('#login-password',password);await page.locator('#login-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#auth-gate').hidden&&!accountSyncInFlight&&!syncTimer);};
  await login('alpha');
  const state=async()=>{const raw=JSON.parse(await readFile(join(dir,'accounts.json'),'utf8'));return raw.users.find(u=>u.id==='alpha');};
  const failPUT=async route=>{if(route.request().method()==='PUT')await route.abort('connectionrefused');else await route.continue();};
  await context.route('**/api/account/state',failPUT);
  await page.evaluate(()=>{const p=readStore(storeKeys.draft);p.title='断网后未同步的修改';writeStore(storeKeys.draft,p);clearTimeout(syncTimer);return flushAccountSync();});
  assert.notEqual((await state()).state['tripmate.v1.draft'].title,'断网后未同步的修改');
  await context.unroute('**/api/account/state',failPUT);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#auth-gate').hidden);
  assert.equal(await page.evaluate(()=>readStore(storeKeys.draft).title),'断网后未同步的修改','Reload must preserve unacknowledged local edits');
  await page.waitForFunction(()=>!accountSyncInFlight&&!syncTimer);assert.equal((await state()).state['tripmate.v1.draft'].title,'断网后未同步的修改');
  // Preserve new edits made while a previous snapshot is in flight.
  let release;const gate=new Promise(r=>release=r);let entered=false;
  const delayedPUT=async route=>{if(route.request().method()==='PUT'&&!entered){entered=true;await gate;}await route.continue();};
  await context.route('**/api/account/state',delayedPUT);
  await page.evaluate(()=>{const p=readStore(storeKeys.draft);p.title='较早的提交';writeStore(storeKeys.draft,p);clearTimeout(syncTimer);window.testFlush=flushAccountSync();});
  while(!entered)await new Promise(r=>setTimeout(r,10));
  await page.evaluate(()=>{const p=readStore(storeKeys.draft);p.title='提交期间的新修改';writeStore(storeKeys.draft,p);clearTimeout(syncTimer);});release();await page.evaluate(()=>window.testFlush);await context.unroute('**/api/account/state',delayedPUT);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#auth-gate').hidden&&!accountSyncInFlight&&!syncTimer);assert.equal(await page.evaluate(()=>readStore(storeKeys.draft).title),'提交期间的新修改');assert.equal((await state()).state['tripmate.v1.draft'].title,'提交期间的新修改');
  // Server committed, but the browser never received the acknowledgment.
  let committed=0;const lostACK=async route=>{if(route.request().method()==='PUT'){await route.fetch();committed++;await route.abort('connectionrefused');}else await route.continue();};
  await context.route('**/api/account/state',lostACK);await page.evaluate(()=>{const p=readStore(storeKeys.draft);p.title='已提交但回执丢失';writeStore(storeKeys.draft,p);clearTimeout(syncTimer);return flushAccountSync();});
  assert.equal(committed,1);assert.equal((await state()).state['tripmate.v1.draft'].title,'已提交但回执丢失');const ackVersion=(await state()).stateVersion;
  await context.unroute('**/api/account/state',lostACK);await page.reload();await page.waitForFunction(()=>document.querySelector('#auth-gate').hidden&&!accountSyncInFlight&&!syncTimer);
  assert.equal((await state()).stateVersion,ackVersion,'Equal acknowledged state must not be resubmitted');assert(!await page.evaluate(()=>accountSyncConflict));
  // Another device changes the server while this page has an unsynced draft.
  await context.route('**/api/account/state',failPUT);await page.evaluate(()=>{const p=readStore(storeKeys.draft);p.title='需要保留的本机冲突稿';writeStore(storeKeys.draft,p);clearTimeout(syncTimer);return flushAccountSync();});
  const cookies=(await context.cookies(base)).map(c=>c.name+'='+c.value).join('; '),remote=await state();const remoteState={...remote.state,'tripmate.v1.draft':plan('另一台设备的新稿')};
  const changed=await fetch(base+'/api/account/state',{method:'PUT',headers:{cookie:cookies,'content-type':'application/json'},body:JSON.stringify({state:remoteState,stateVersion:remote.stateVersion})});assert.equal(changed.status,200);
  await context.unroute('**/api/account/state',failPUT);await page.reload();await page.waitForFunction(()=>document.querySelector('#auth-gate').hidden);
  assert.equal(await page.evaluate(()=>readStore(storeKeys.draft).title),'需要保留的本机冲突稿');assert(await page.evaluate(()=>accountSyncConflict));assert.equal((await state()).state['tripmate.v1.draft'].title,'另一台设备的新稿');
  await page.locator('#account-button').click();await page.locator('#load-cloud-preserving-local').click();await page.waitForFunction(()=>!accountSyncConflict&&readStore(storeKeys.draft).title==='另一台设备的新稿');
  assert(await page.evaluate(()=>TripMateSyncJournal.recoveries(authCurrentUser).some(b=>b.data.state['tripmate.v1.draft']?.title==='需要保留的本机冲突稿')));
  await page.locator('#sync-recoveries summary').click();const downloadWait=page.waitForEvent('download');await page.locator('#sync-recovery-items button').last().click();const download=await downloadWait,backup=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(backup.format,'tripmate-account-backup');assert.equal(backup.user.id,'alpha');
  assert.equal(backup.data.state['tripmate.v1.draft'].title,'需要保留的本机冲突稿');
  if(await page.evaluate(()=>document.querySelector('#account-menu').hidden))await page.locator('#account-button').click();
  await page.locator('#account-backup-file').setInputFiles(await download.path());
  let restorePosts=0;
  const raceRestore=async route=>{
    restorePosts++;const body=route.request().postDataJSON(),snapshot=await state();assert.equal(body.expectedStateVersion,snapshot.stateVersion);
    const update=await fetch(base+'/api/account/state',{method:'PUT',headers:{cookie:cookies,'content-type':'application/json'},body:JSON.stringify({state:{...snapshot.state,'tripmate.v1.orders':[{id:'new-during-restore',name:'other device saved',amount:200}]},stateVersion:snapshot.stateVersion})});assert.equal(update.status,200);await route.continue();
  };
  await context.route('**/api/account/import',raceRestore);await page.locator('#confirm-account-restore').click();
  await page.waitForFunction(()=>document.querySelector('#profile-message').textContent.startsWith('恢复已暂停'));
  assert.equal(restorePosts,1);assert.equal((await state()).state['tripmate.v1.orders'][0].id,'new-during-restore');
  assert(await page.evaluate(()=>pendingAccountRestore!==null));assert(await page.locator('#confirm-account-restore').isEnabled());
  if(await page.evaluate(()=>document.querySelector('#account-menu').hidden))await page.locator('#account-button').click();
  await page.locator('#profile-message').scrollIntoViewIfNeeded();await page.screenshot({path:join(dir,'restore-conflict-'+width+'.png'),fullPage:false});
  await context.unroute('**/api/account/import',raceRestore);
  const oldExport=async route=>{const result=await route.fetch(),body=await result.json();delete body.restoreVersionCheck;delete body.stateVersion;await route.fulfill({response:result,json:body});};
  const countRestore=async route=>{restorePosts++;await route.continue();};
  await context.route('**/api/account/export',oldExport);await context.route('**/api/account/import',countRestore);await page.locator('#confirm-account-restore').click();
  await page.waitForFunction(()=>document.querySelector('#profile-message').textContent.includes('请先升级国内服务器 v67'));
  assert.equal(restorePosts,1,'Old-server capability must stop before POST');await context.unroute('**/api/account/export',oldExport);await context.unroute('**/api/account/import',countRestore);
  await page.locator('#confirm-account-restore').click();
  await page.waitForFunction(()=>document.querySelector('#profile-message').textContent.startsWith('恢复完成'));
  assert.equal((await state()).state['tripmate.v1.draft'].title,'需要保留的本机冲突稿','Archived file remains compatible with the existing restore flow');
  // Commit succeeds but the response is lost: report uncertainty, do not claim no data changed.
  const lostBackup={...backup,data:{...backup.data,state:{...backup.data.state,'tripmate.v1.draft':plan('已恢复但回执丢失的稿件')}}};
  if(await page.evaluate(()=>document.querySelector('#account-menu').hidden))await page.locator('#account-button').click();
  await page.locator('#account-backup-file').setInputFiles({name:'synthetic-lost-ack.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lostBackup))});
  let lostPosts=0;const lostRestore=async route=>{lostPosts++;await route.fetch();await route.abort('connectionrefused');};
  await context.route('**/api/account/import',lostRestore);await page.locator('#confirm-account-restore').click();await page.waitForFunction(()=>document.querySelector('#profile-message').textContent.startsWith('未能确认恢复结果'));
  assert.equal(lostPosts,1);assert.equal((await state()).state['tripmate.v1.draft'].title,'已恢复但回执丢失的稿件');await context.unroute('**/api/account/import',lostRestore);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#auth-gate').hidden&&!accountSyncInFlight&&!syncTimer);assert.equal(await page.evaluate(()=>readStore(storeKeys.draft).title),'已恢复但回执丢失的稿件');
  if(await page.evaluate(()=>document.querySelector('#account-menu').hidden))await page.locator('#account-button').click();
  await page.locator('#sync-recovery-items').scrollIntoViewIfNeeded();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(dir,'pending-recovery-'+width+'.png'),fullPage:false});
  await context.route('**/api/account/state',failPUT);await page.evaluate(()=>{const p=readStore(storeKeys.draft);p.title='alpha独有的未同步稿';writeStore(storeKeys.draft,p);clearTimeout(syncTimer);return flushAccountSync();});
  if(await page.evaluate(()=>document.querySelector('#account-menu').hidden))await page.locator('#account-button').click();
  await page.locator('#account-backup-file').setInputFiles(await download.path());assert(await page.evaluate(()=>pendingAccountRestore!==null));
  await page.locator('#logout-button').click();await page.waitForFunction(()=>!document.querySelector('#auth-gate').hidden);
  assert.equal(await page.evaluate(()=>pendingAccountRestore),null);assert.equal(await page.locator('#account-backup-file').inputValue(),'');
  await page.fill('#login-email',users[1].email);await page.fill('#login-password',password);await page.locator('#login-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#auth-gate').hidden&&!accountSyncInFlight&&!syncTimer);
  assert.equal(await page.evaluate(()=>TripMateSyncJournal.recoveries(authCurrentUser).length),0);assert(!await page.evaluate(()=>JSON.stringify(accountState()).includes('alpha独有的未同步稿')));assert(await page.locator('#restore-preview').isHidden());
  await page.evaluate(()=>apiJson('/api/auth/logout',{method:'POST'}));await context.unroute('**/api/account/state',failPUT);await login('alpha');assert.equal(await page.evaluate(()=>readStore(storeKeys.draft).title),'alpha独有的未同步稿');
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS durable pending: offline reload/resume, newer edit during PUT, cloud conflict preserves both, local recovery archive/export, two-user isolation and 390/1280 UI. Artifacts:',dir);
}finally{await browser.close();child.kill();}
