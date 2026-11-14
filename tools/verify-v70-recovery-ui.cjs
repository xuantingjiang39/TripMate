'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),{chromium}=require(path.join(root,'TripMate-desktop-v54/node_modules/playwright-core'));
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tripmate-v70-recovery-'));
 const files={'/tripmate-state-schema.js':'tripmate-state-schema.js','/':'tripmate-mvp.html','/tripmate-sync-journal.js':'tripmate-sync-journal.js','/tripmate-network.js':'tripmate-network.js','/tripmate-unified.js':'tripmate-unified.js','/tripmate-regions.js':'tripmate-regions.js','/tripmate-icon.png':'tripmate-icon.png'};
 const server=http.createServer(async(req,res)=>{try{const file=files[new URL(req.url,'http://local').pathname];if(!file){res.writeHead(404);res.end();return;}res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html; charset=utf-8');res.end(await fs.readFile(path.join(root,'guest-v70',file)));}catch{res.writeHead(500);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/auth/login'){await route.abort('connectionrefused');return;}
    const health=url.pathname==='/api/health';
    if(health){assert(!route.request().headers()['authorization']);assert(!route.request().headers()['cookie']);}
    await route.fulfill({status:health?200:401,contentType:'application/json',body:JSON.stringify(health?{ok:true,service:'TripMate',version:'v64-session-races'}:{error:'Synthetic unauthenticated fixture'})});
   });
   await page.goto(base);await page.locator('#login-form').waitFor();
   await page.fill('#login-email','fixture@example.invalid');await page.fill('#login-password','Synthetic-test-only-123');await page.locator('#login-form button[type=submit]').click();
   await page.waitForFunction(()=>document.querySelector('#auth-message').textContent.includes('暂时无法连接')&&!document.querySelector('#login-form button[type=submit]').disabled);
   assert(!(await page.locator('#auth-message').innerText()).includes('升级'));
   await page.locator('#connection-help summary').click();await page.locator('#check-connection').click();
   await page.waitForFunction(()=>document.querySelector('#connection-status').dataset.state==='connected');
   assert((await page.locator('#connection-status').innerText()).includes('v64-session-races'));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('#connection-status').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(dir,'recovery-'+width+'.png'),fullPage:false,timeout:10000});
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS normal-clock 390/1280 login failure, enabled retry, anonymous version diagnosis, keyboard-ready recovery and no overflow. Artifacts:',dir);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
