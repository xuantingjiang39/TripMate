// Real local HTTP/account service + Chromium. Only GPS and navigation results are synthetic.
// No real phone GPS, map APIs, production accounts, mail, AI or payments.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {randomBytes,scryptSync} from 'node:crypto';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..'),source=process.argv[2]||'guest-v72',expectBug=process.argv.includes('--expect-bug');
const dir=await mkdtemp(join(tmpdir(),'tripmate-v72-navigation-ui-'));
const password=randomBytes(18).toString('hex'),salt=randomBytes(16).toString('hex');
const plan=prefix=>({title:prefix+'行程',days:[{day:'第1天',city:'测试城',events:[{name:'10:00 测试第一天',note:'仅用于导航取消测试'}]},{day:'第2天',city:'测试城',events:[]}],transportLegs:[{day:'第1天',time:'10:00',from:'示例起点',to:prefix+'第一天终点',mode:'步行',duration:'示例',route:'示例'},{day:'第2天',time:'10:00',from:'示例起点',to:prefix+'第二天终点',mode:'步行',duration:'示例',route:'示例'}],recommendations:{hotels:[],restaurants:[]},budget:{currency:'CNY',total:100}});
const users=['alpha','beta'].map((id,i)=>({id,email:id+'@example.invalid',name:id,role:'user',passwordSalt:salt,passwordHash:scryptSync(password,salt,64).toString('hex'),creditBalance:37+i,creditTransactions:[],stateVersion:1,state:{'tripmate.v1.draft':plan(id),'tripmate.v1.trips':[{id:id+'-saved',plan:plan(id+'另存'),savedAt:'2026-11-16T01:00:00Z'}],'tripmate.v1.orders':[],'tripmate.v1.packing':[]}}));
await writeFile(join(dir,'accounts.json'),JSON.stringify({version:2,users,sessions:[],guests:[]}));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const child=spawn(process.execPath,[join(root,source,'tripmate-ai-server.mjs')],{env:{...process.env,PORT:String(port),TRIPMATE_DATA_DIR:dir},stdio:['ignore','pipe','pipe'],windowsHide:true});
await new Promise((r,j)=>{child.stdout.once('data',r);child.once('error',j);setTimeout(()=>j(Error('Startup timeout')),10000).unref();});
const origin='http://127.0.0.1:'+port;
const {chromium}=await import(pathToFileURL(join(root,'TripMate-desktop-v54/node_modules/playwright-core/index.mjs')));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},userAgent:width===390?'Android synthetic-navigation-test':'Windows synthetic-navigation-test'});
  await context.addInitScript(()=>{
   let counter=0,timerCounter=1000000;const watchers=new Map(),timers=new Map();
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition:(ok,error)=>{const id=++counter;watchers.set(id,{ok,error,active:true});return id;},clearWatch:id=>{if(watchers.has(id))watchers.get(id).active=false;}}});
   const originalSet=window.setTimeout.bind(window),originalClear=window.clearTimeout.bind(window);
   window.setTimeout=(fn,ms,...args)=>{if(ms===180){const id=timerCounter++;timers.set(id,()=>fn(...args));return id;}return originalSet(fn,ms,...args);};
   window.clearTimeout=id=>{if(timers.has(id))timers.delete(id);else originalClear(id);};
   window.__navFixture={latest:()=>counter,active:()=>[...watchers.values()].filter(v=>v.active).length,emit:id=>watchers.get(id).ok({coords:{latitude:0,longitude:0,accuracy:10}}),error:id=>watchers.get(id).error({code:1}),flushLaunch:()=>{for(const [id,fn]of [...timers]){timers.delete(id);fn();}}};
  });
  const page=await context.newPage(),errors=[],bodies=[];let hold=false,held,notify;
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());assert.equal(u.origin,origin,'No outside service may be contacted');
   if(u.pathname!=='/api/navigation/guide')return route.continue();
   const body=route.request().postDataJSON();bodies.push(body);
   if(hold){held=route;notify?.();return;}
   await route.fulfill({json:{currentStep:1,totalStops:2,reachedIndex:-1,nextStop:{name:body.stops[0].name},distance:250,duration:240,accuracy:10,routeModeLabel:'步行',navigationUrl:origin+'/maps-launched'}});
  });
  const login=async index=>{await page.fill('#login-email',users[index].email);await page.fill('#login-password',password);await page.locator('#login-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#auth-gate').hidden&&!accountSyncInFlight&&!syncTimer);};
  const emit=()=>page.evaluate(()=>window.__navFixture.emit(window.__navFixture.latest()));
  const start=async()=>{await page.locator('#start-live-navigation').click();return page.evaluate(()=>window.__navFixture.latest());};
  const late=async()=>{hold=true;const observed=new Promise(r=>notify=r);await emit();await observed;return held;};
  const settle=()=>page.evaluate(()=>new Promise(r=>setTimeout(r,0)));
  try{
   await page.goto(origin);await login(0);await page.locator('[data-app-page-target=today]').click();
   assert.equal(await page.locator('#today-day').inputValue(),expectBug?'':'0','Initial selected day must match the route actually used');
   if(!expectBug)assert.equal(await page.locator('#today-day option:checked').innerText(),'第1天');
   await start();const request=await late();await page.locator('#stop-live-navigation').click();
   hold=false;await request.fulfill({json:{currentStep:1,totalStops:1,nextStop:{name:'LATE-GUIDE'},navigationUrl:origin+'/maps-launched'}}).catch(()=>{});await settle();
   if(expectBug){assert((await page.locator('#navigation-result').innerText()).includes('LATE-GUIDE'));results.push({width,baselineStoppedGuideReproduced:true});continue;}
   assert((await page.locator('#navigation-result').innerText()).includes('已停止'));assert(!(await page.locator('#navigation-result').innerText()).includes('LATE-GUIDE'));
   assert.equal(await page.evaluate(()=>navigationState.lastPosition),null);assert.equal(await page.evaluate(()=>window.__navFixture.active()),0);
   const oldWatch=await page.evaluate(()=>window.__navFixture.latest()),before=bodies.length;await page.evaluate(id=>{window.__navFixture.emit(id);window.__navFixture.error(id);},oldWatch);await settle();assert.equal(bodies.length,before);
   await page.locator('#navigation-result').scrollIntoViewIfNeeded();await page.screenshot({path:join(dir,'stopped-'+width+'.png')});
   // A fresh watch works; then cancel a mobile launch that is already queued.
   await start();await emit();await page.waitForFunction(()=>document.querySelector('#navigation-result').textContent.includes('alpha第一天终点'));
   await page.screenshot({path:join(dir,'active-'+width+'.png')});await page.locator('#stop-live-navigation').click();await page.evaluate(()=>window.__navFixture.flushLaunch());assert.equal(page.url(),origin+'/');
   // Switch the selected day while a request is pending. Old callbacks/results remain inert.
   await start();const dayRequest=await late();await page.selectOption('#today-day','1');hold=false;await dayRequest.fulfill({json:{nextStop:{name:'LATE-DAY'}}}).catch(()=>{});await settle();
   assert((await page.locator('#navigation-result').innerText()).includes('已切换行程日期'));assert.equal(await page.evaluate(()=>window.__navFixture.active()),0);
   await start();await emit();await page.waitForFunction(()=>document.querySelector('#navigation-result').textContent.includes('alpha第二天终点'));assert.equal(bodies.at(-1).stops[0].name,'alpha第二天终点');
   // Opening another saved route also releases GPS and its queued launch.
   await page.locator('[data-app-page-target=saved]').click();await page.locator('[data-trip-action=open]').click();assert.equal(await page.evaluate(()=>window.__navFixture.active()),0);assert.equal(await page.evaluate(()=>navigationState.lastPosition),null);
   await page.locator('[data-app-page-target=today]').click();await start();await emit();await page.waitForFunction(()=>document.querySelector('#navigation-result').textContent.includes('alpha另存'));
   // Real local logout/account switch must not inherit the previous user's live position.
   await page.locator('#account-button').click();await page.locator('#logout-button').click();await page.waitForFunction(()=>!document.querySelector('#auth-gate').hidden);
   assert.equal(await page.evaluate(()=>window.__navFixture.active()),0);assert.equal(await page.evaluate(()=>navigationState.lastPosition),null);
   const old=await page.evaluate(()=>window.__navFixture.latest()),beforeLogin=bodies.length;await login(1);await page.evaluate(id=>window.__navFixture.emit(id),old);await settle();assert.equal(bodies.length,beforeLogin);
   assert.equal(await page.evaluate(()=>authCurrentUser.id),'beta');assert.equal(await page.evaluate(()=>readStore(storeKeys.draft).title),'beta行程');assert.equal(await page.evaluate(()=>authCurrentUser.creditBalance),38);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
   results.push({width,stopPreservesStatus:true,queuedGpsIgnored:true,mobileLaunchCancelled:true,dayRestart:true,savedRouteReleasesGps:true,logoutAndAccountIsolation:true,noOverflow:true});
  }finally{await context.close();}
 }
 const disk=JSON.parse(await readFile(join(dir,'accounts.json'),'utf8'));assert.equal(disk.users.find(u=>u.id==='beta').state['tripmate.v1.draft'].title,'beta行程');assert.equal(disk.users.find(u=>u.id==='beta').creditBalance,38);
 console.log(JSON.stringify({source,results,artifacts:dir},null,2));
}finally{await browser.close();child.kill();}
