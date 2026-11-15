// Real browser + current HTML, synthetic API responses only. No production accounts or paid calls.
import assert from 'node:assert/strict';
import {readFile,mkdtemp} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..'),source=process.argv[2]||'guest-v71',expectBug=process.argv.includes('--expect-bug');
const dir=await mkdtemp(join(tmpdir(),'tripmate-v71-edit-refresh-'));
const files={'/':'tripmate-mvp.html','/tripmate-state-schema.js':'tripmate-state-schema.js','/tripmate-sync-journal.js':'tripmate-sync-journal.js','/tripmate-network.js':'tripmate-network.js','/tripmate-unified.js':'tripmate-unified.js','/tripmate-regions.js':'tripmate-regions.js','/tripmate-icon.png':'tripmate-icon.png'};
const server=createServer(async(req,res)=>{try{const f=files[new URL(req.url,'http://local').pathname];if(!f){res.writeHead(404);return res.end();}res.setHeader('content-type',f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html; charset=utf-8');res.end(await readFile(join(root,source,f)));}catch{res.writeHead(500);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const {chromium}=await import(pathToFileURL(join(root,'TripMate-desktop-v54/node_modules/playwright-core/index.mjs')));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const original={
 'tripmate.v1.draft':{title:'本机已保存行程',days:[{day:'第1天',city:'杭州',events:[{name:'10:00 西湖示例',note:'隔离测试数据'}]}],transportLegs:[],recommendations:{hotels:[],restaurants:[]},budget:{currency:'CNY',total:100,transport:{total:100,items:[]},lodging:{total:0,items:[]},foodTickets:{total:0,items:[]}}},
 'tripmate.v1.preferences':{companion:'父母或长辈',pace:'轻松慢游',walk:'尽量少走路',hotel:'安静舒适优先',food:'本机已保存偏好'},
 'tripmate.v1.trips':[],'tripmate.v1.orders':[],'tripmate.v1.packing':[]
};
const remote={...original,'tripmate.v1.draft':{...original['tripmate.v1.draft'],title:'远端新行程'},'tripmate.v1.preferences':{...original['tripmate.v1.preferences'],food:'云端其他设备偏好'}};
const results=[];
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  let hold=false,held,started,readCount=0,version=3;
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());assert.equal(url.origin,origin,'No external request is allowed');
   if(!url.pathname.startsWith('/api/'))return route.continue();
   if(url.pathname==='/api/auth/login')return route.fulfill({json:{user:{id:'alpha',name:'测试用户',email:'alpha@example.invalid',role:'user',creditBalance:37,aiEnabled:true}}});
   if(url.pathname==='/api/account/state'&&req.method()==='GET'){
    readCount++;if(hold){held=route;started?.();return;}
    return route.fulfill({json:{state:version===3?original:remote,stateVersion:version}});
   }
   if(url.pathname.startsWith('/api/credits'))return route.fulfill({json:{balance:37,transactions:[],cost:3,enough:true,enabled:true}});
   return route.fulfill({status:401,json:{error:'Synthetic local fixture'}});
  });
  try{
   await page.goto(origin);await page.fill('#login-email','alpha@example.invalid');await page.fill('#login-password','Synthetic-not-a-real-password');await page.locator('#login-form button[type=submit]').click();
   await page.waitForFunction(()=>document.querySelector('#auth-gate').hidden&&!accountSyncInFlight&&!syncTimer,{},{timeout:5000}).catch(async error=>{console.log(await page.evaluate(()=>({auth:document.querySelector('#auth-message').textContent,user:authCurrentUser,notice:notice.textContent})),errors);throw error;});
   await page.evaluate(()=>document.activeElement?.blur());
   // Start on the read-only planner, then enter an editable page while GET is in flight.
   hold=true;const observed=new Promise(r=>started=r);const polling=page.evaluate(()=>pollUnifiedState());await observed;
   await page.getByRole('button',{name:'旅行偏好',exact:true}).click();
   await page.fill('#pref-food','尚未保存的花生过敏提醒');
   version=4;hold=false;await held.fulfill({json:{state:remote,stateVersion:4}});await polling;
   const value=await page.inputValue('#pref-food');
   if(expectBug){assert.equal(value,'云端其他设备偏好');results.push({width,baselineBugReproduced:true});continue;}
   assert.equal(value,'尚未保存的花生过敏提醒','A late refresh cannot erase unsaved preferences');
   assert.equal(await page.evaluate(()=>accountStateVersion),3);assert.equal(await page.evaluate(()=>readStore(storeKeys.draft).title),'本机已保存行程');
   // Blurring a form does not make the whole editable page safe to rebuild.
   await page.evaluate(()=>document.activeElement?.blur());const before=readCount;await page.evaluate(()=>pollUnifiedState());assert.equal(readCount,before);
   await page.locator('#pref-food').scrollIntoViewIfNeeded();
   await page.screenshot({path:join(dir,'preferences-preserved-'+width+'.png'),fullPage:false});
   await page.getByRole('button',{name:'AI 规划',exact:true}).click();await page.evaluate(()=>document.activeElement?.blur());
   await page.evaluate(()=>pollUnifiedState());assert.equal(await page.evaluate(()=>accountStateVersion),4);assert.equal(await page.evaluate(()=>readStore(storeKeys.draft).title),'远端新行程','Refresh resumes on a safe reading page');
   // Opening the editor while a later refresh is in flight also blocks replacement.
   hold=true;const observedEditor=new Promise(r=>started=r);const editorPoll=page.evaluate(()=>pollUnifiedState());await observedEditor;
   await page.locator('#edit-plan').click();await page.locator('#plan-editor').waitFor({state:'visible'});
   await page.evaluate(()=>document.querySelector('#close-editor').focus());
   const newer={...remote,'tripmate.v1.draft':{...remote['tripmate.v1.draft'],title:'不得打断编辑的远端稿'}};
   hold=false;await held.fulfill({json:{state:newer,stateVersion:5}});await editorPoll;
   assert.equal(await page.evaluate(()=>accountStateVersion),4);assert.equal(await page.evaluate(()=>readStore(storeKeys.draft).title),'远端新行程');
   const dialogBefore=readCount;await page.evaluate(()=>pollUnifiedState());assert.equal(readCount,dialogBefore,'Open dialogs block new automatic pulls even with a button focused');
   await page.screenshot({path:join(dir,'editor-preserved-'+width+'.png'),fullPage:false});
   await page.locator('#close-editor').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
   results.push({width,unsavedPreferencesPreserved:true,editablePageDefers:true,resumesAfterLeave:true,openEditorPreserved:true,noHorizontalOverflow:true});
  }finally{await context.close();}
 }
 console.log(JSON.stringify({source,results,artifacts:dir},null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
