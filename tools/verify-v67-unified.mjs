// Local HTTP/SQLite and browser routing only. No production login, emails, AI or payment.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes,scryptSync,createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..'),dir=await mkdtemp(join(tmpdir(),'tripmate-v67-')),globalOrigin='https://tripmate-3x7.pages.dev';
const password=randomBytes(20).toString('hex'),salt=randomBytes(16).toString('hex');
const plan=title=>({title,days:[{day:'第1天',events:[],city:'杭州'}],budget:{currency:'CNY',total:100},transportLegs:[],recommendations:{hotels:[],restaurants:[]}});
const users=['alpha','beta'].map((id,i)=>({id,email:id+'@example.invalid',name:id,role:'user',passwordSalt:salt,passwordHash:scryptSync(password,salt,64).toString('hex'),creditBalance:37+i,creditTransactions:[],stateVersion:0,state:{'tripmate.v1.draft':plan(id+'统一行程'),'tripmate.v1.trips':[{id:id+'-trip',plan:plan(id+'的行程')}],'tripmate.v1.orders':[],'tripmate.v1.packing':[]}}));
await writeFile(join(dir,'accounts.json'),JSON.stringify({version:2,users,sessions:[],guests:[]}));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const child=spawn(process.execPath,[join(root,'guest-v67/tripmate-ai-server.mjs')],{env:{...process.env,PORT:String(port),TRIPMATE_DATA_DIR:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});
await new Promise((r,j)=>{child.stdout.once('data',r);child.once('error',j);setTimeout(()=>j(Error('Startup timeout')),10000).unref();});
const base='http://127.0.0.1:'+port,realFetch=globalThis.fetch;
const env={};
globalThis.fetch=async()=>{throw Error('Worker must not proxy raw IPs or contact outside services');};
const worker=(await import(pathToFileURL(join(root,'TripMate-pages-v67/dist/_worker.js'))+'?t='+Date.now())).default;
const edge=createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const r=await worker.fetch(new Request(globalOrigin+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch(e){res.writeHead(500);res.end('Local test adapter error');}});
await new Promise(r=>edge.listen(0,'127.0.0.1',r));const edgeBase='http://127.0.0.1:'+edge.address().port;
let browser;
try{
 const domesticHtml=await (await realFetch(base)).text(),globalHtml=await (await realFetch(edgeBase)).text();assert.equal(globalHtml,domesticHtml,'Both entries ship byte-identical primary HTML');
 assert.equal(await (await realFetch(edgeBase+'/tripmate-unified.js')).text(),await readFile(join(root,'guest-v67/tripmate-unified.js'),'utf8'));
 assert.equal((await realFetch(edgeBase+'/api/auth/me')).status,409,'Old independent auth must not be exposed at normal API paths');
 assert.equal((await realFetch(base+'/api/account/state',{method:'OPTIONS',headers:{origin:globalOrigin,'access-control-request-method':'PUT','access-control-request-headers':'authorization,content-type,x-tripmate-client'}})).status,204);
 const previousOrigin='https://tripmate-travel-planner.xuantingjiang39.chatgpt.site';
 const compatibility=await realFetch(base+'/api/account/state',{method:'OPTIONS',headers:{origin:previousOrigin,'access-control-request-method':'PUT','access-control-request-headers':'authorization,content-type,x-tripmate-client'}});assert.equal(compatibility.status,204);assert.equal(compatibility.headers.get('access-control-allow-origin'),previousOrigin);
 assert.equal((await realFetch(base+'/api/auth/login',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:'{}'})).status,403);
 assert.equal((await realFetch(edgeBase+'/legacy',{redirect:'manual'})).headers.get('location'),'https://tripmate.xuantingjiang39.chatgpt.site/legacy');
 assert.equal((await realFetch(edgeBase+'/legacy-api/sync')).status,404);
 const {chromium}=await import(pathToFileURL(join(root,'TripMate-desktop-v54/node_modules/playwright-core/index.mjs')));browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844}});
  await context.addInitScript(()=>{if(location.origin==='https://tripmate-3x7.pages.dev')localStorage.setItem('tripmate.v1.trips',JSON.stringify([{id:'old-private',plan:{title:'不可自动导入的旧账号副本'}}]));});
  await context.route(globalOrigin+'/**',async route=>{const req=route.request(),r=await route.fetch({url:edgeBase+new URL(req.url()).pathname+new URL(req.url()).search,headers:await req.allHeaders()});await route.fulfill({response:r});});
  await context.route('https://111.230.133.155/**',async route=>{const req=route.request(),headers=await req.allHeaders();assert(!headers.cookie,'International entry never forwards cookies');const r=await route.fetch({url:base+new URL(req.url()).pathname+new URL(req.url()).search,headers:{...headers,cookie:''}});await route.fulfill({response:r});});
  const domestic=await context.newPage(),international=await context.newPage(),errors=[];for(const p of [domestic,international])p.on('pageerror',e=>errors.push(e.message));
  const login=async(page,url)=>{await page.goto(url);await page.fill('#login-email',users[0].email);await page.fill('#login-password',password);await page.locator('#login-form button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('auth-gate').hidden);await page.waitForFunction(()=>!accountSyncInFlight&&!syncTimer);await page.evaluate(()=>document.activeElement?.blur());};
  await login(domestic,base);await login(international,globalOrigin);
  assert.equal(await international.evaluate(()=>authCurrentUser.id),'alpha');assert.equal(await international.evaluate(()=>authCurrentUser.creditBalance),37);
  assert.equal(await international.evaluate(()=>readStore(storeKeys.draft,{}).title),'alpha统一行程');
  assert(!await international.evaluate(()=>JSON.stringify(accountState()).includes('old-private')),'Legacy storage is quarantined from unified login');
  assert(await international.evaluate(()=>sessionStorage.getItem('tripmate.unified.session')?.length>20));assert(!await international.evaluate(()=>Object.keys(localStorage).some(k=>localStorage.getItem(k)===sessionStorage.getItem('tripmate.unified.session'))),'Bearer token never persists in localStorage');
  await domestic.evaluate(()=>{writeStore(storeKeys.orders,[{id:'domestic-edit',name:'国内修改',type:'酒店',date:'',status:'待预订',amount:100}]);clearTimeout(syncTimer);return flushAccountSync();});
  await international.bringToFront();await international.evaluate(()=>pollUnifiedState());assert.equal(await international.evaluate(()=>readStore(storeKeys.orders,[])[0]?.id),'domestic-edit');
  await international.evaluate(()=>{writeStore(storeKeys.reminders,[{id:'global-edit',text:'国际修改',date:'',time:'',done:false}]);clearTimeout(syncTimer);return flushAccountSync();});
  await domestic.bringToFront();await domestic.evaluate(()=>pollUnifiedState());assert.equal(await domestic.evaluate(()=>readStore(storeKeys.reminders,[])[0]?.id),'global-edit','Automatic refresh works both ways');
  const creditA=await domestic.evaluate(()=>apiJson('/api/credits')),creditB=await international.evaluate(()=>apiJson('/api/credits'));assert.equal(creditA.balance,creditB.balance);
  assert(await international.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await international.screenshot({path:join(dir,'unified-global-'+width+'.png'),fullPage:true});await domestic.screenshot({path:join(dir,'unified-domestic-'+width+'.png'),fullPage:true});
  await international.reload();await international.waitForFunction(()=>document.getElementById('auth-gate').hidden);assert.equal(await international.evaluate(()=>authCurrentUser.id),'alpha','Tab reload keeps the unified session');
  const me=await international.evaluate(()=>apiJson('/api/auth/me'));assert.equal(me.user.email,users[0].email);
  await international.evaluate(()=>apiJson('/api/auth/logout',{method:'POST'}));assert.equal(await international.evaluate(()=>sessionStorage.getItem('tripmate.unified.session')),null);
  await international.reload();await international.locator('#login-form').waitFor();await international.fill('#login-email',users[1].email);await international.fill('#login-password',password);await international.locator('#login-form button[type=submit]').click();await international.waitForFunction(()=>document.getElementById('auth-gate').hidden);assert.equal(await international.evaluate(()=>readStore(storeKeys.draft,{}).title),'beta统一行程','Unified account isolation');
  // Exercise actual form recovery on stalled requests; shorten only the production 12s auth timer.
  await international.evaluate(()=>apiJson('/api/auth/logout',{method:'POST'}));await international.reload();await international.locator('#login-form').waitFor();
  await international.evaluate(()=>{const original=setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===12000?75:ms,...args);});
  const loginPattern='https://111.230.133.155/api/auth/login';
  let stalledRoute;await context.route(loginPattern,route=>{stalledRoute=route;});
  await international.fill('#login-email',users[1].email);await international.fill('#login-password',password);await international.locator('#login-form button[type=submit]').click();
  await international.waitForFunction(()=>document.querySelector('#auth-message').textContent.includes('请求超时')&&!document.querySelector('#login-form button[type=submit]').disabled);
  await stalledRoute.abort().catch(()=>{});await context.unroute(loginPattern);
  await context.route('https://111.230.133.155/api/health',async route=>{
    assert.equal(route.request().headers()['authorization'],undefined);assert.equal(route.request().headers()['cookie'],undefined);
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':globalOrigin},body:JSON.stringify({ok:true,service:'TripMate',version:'v64-session-races'})});
  });
  await international.locator('#connection-help summary').click();await international.locator('#check-connection').click();
  await international.waitForFunction(()=>document.querySelector('#connection-status').dataset.state==='connected'&&!document.querySelector('#check-connection').disabled);
  assert((await international.locator('#connection-status').innerText()).includes('v64-session-races'));
  assert(await international.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // Visual captures use a fresh, normal-clock fixture in verify-v67-recovery-ui.cjs.
  assert.deepEqual(errors,[]);await context.close();
 }
 for(const name of (await readdir(join(root,'guest-v67'))).filter(n=>n.endsWith('.sh'))){const bytes=await readFile(join(root,'guest-v67',name));assert(!bytes.includes(13));assert(!bytes.subarray(0,3).equals(Buffer.from([239,187,191])));execFileSync('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/usr/bin/sh.exe',['-n',join(root,'guest-v67',name).replaceAll('\\','/')],{windowsHide:true});}
 console.log('PASS v67: identical UI, unified account/records/credits, two-way sync, strict CORS/session isolation, stalled login abort + form recovery, anonymous real-version diagnosis, desktop/mobile UI and shell syntax. Artifacts:',dir);
}finally{globalThis.fetch=realFetch;if(browser)await browser.close();child.kill();edge.closeAllConnections();await new Promise(r=>edge.close(r));}
