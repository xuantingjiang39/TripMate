'use strict';
// Run against an isolated test profile; never submit real credentials or call paid AI.
const { _electron: electron } = require('playwright-core');
const {readFile,writeFile,mkdir,stat} = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const output = path.join(root,'test-results');
const env = {...process.env,TRIPMATE_DESKTOP_TEST:'1',TRIPMATE_TEST_PROFILE:path.join(os.tmpdir(),`tripmate-desktop-test-${Date.now()}`)};
delete env.ELECTRON_RUN_AS_NODE;
let application;
async function main() {
  await mkdir(output,{recursive:true});
  application = await electron.launch({executablePath:require('electron'),args:[root],env,timeout:45000});
  await application.firstWindow();
  await application.evaluate(async()=>{while(!globalThis.__tripmateTest) await new Promise(resolve=>setTimeout(resolve,30));});
  let pages = application.context().pages();
  const frame = pages.find(p=>p.url().startsWith('tripmate-desktop://app/index.html'));
  assert.ok(frame,'local desktop shell exists');
  await frame.waitForFunction(()=>window.desktop);
  let page = pages.find(p=>p !== frame && p.url().startsWith('https://111.230.133.155'));
  if (!page) page = await application.context().waitForEvent('page');
  await page.waitForSelector('#login-email',{timeout:35000});
  assert.equal(await page.evaluate(()=>typeof require),'undefined');
  assert.equal(await page.evaluate(()=>typeof process),'undefined');
  assert.deepEqual(await application.evaluate(()=>{
    const p=globalThis.__tripmateTest.workspace.webContents.getLastWebPreferences();
    return {nodeIntegration:p.nodeIntegration,contextIsolation:p.contextIsolation,sandbox:p.sandbox,webSecurity:p.webSecurity};
  }),{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true});
  await frame.screenshot({path:path.join(output,'live-toolbar.png')});
  await page.screenshot({path:path.join(output,'live-login.png')});
  console.log('PASS real HTTPS connection and login page, sandbox and Node isolation');

  // Isolate all subsequent flows from the real server. The actual deployed UI is reused.
  const html=await readFile(path.join(root,'tests/fixtures/workspace.html'),'utf8');
  let offline=false;
  await application.context().route('https://111.230.133.155/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    if (url.pathname === '/') {
      if(offline) return route.abort('internetdisconnected');
      return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html});
    }
    if(url.pathname==='/api/auth/guest' && request.method()==='POST') return route.fulfill({json:{previewRemaining:1}});
    if(url.pathname==='/api/credits/estimate') return route.fulfill({json:{guest:true,enough:true,cost:3}});
    return route.fulfill({status:401,json:{error:'测试环境：未登录'}});
  });
  await application.evaluate(()=>globalThis.__tripmateTest.connect());
  await page.locator('#show-register').click();
  await page.locator('#register-name').waitFor({state:'visible'});
  await page.locator('#show-login').click();
  assert.equal(await page.locator('#login-email').isVisible(),true);
  await page.locator('#continue-as-guest').click();
  await page.waitForFunction(()=>document.querySelector('#auth-gate').hidden);
  await page.locator('#days .day').first().waitFor();
  await page.screenshot({path:path.join(output,'guest-workspace.png')});
  await frame.locator('#zoom-in').click();
  await frame.waitForFunction(()=>document.querySelector('#zoom-reset').textContent==='110%');
  assert.equal(await application.evaluate(()=>globalThis.__tripmateTest.workspace.webContents.getZoomFactor()),1.1);
  await frame.locator('#zoom-reset').click();
  await application.evaluate(()=>globalThis.__tripmateTest.win.setContentSize(800,640));
  assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
  await frame.screenshot({path:path.join(output,'compact-toolbar.png')});
  await page.screenshot({path:path.join(output,'compact-workspace.png')});
  console.log('PASS register/login switching, guest sample, zoom, compact layout');

  await application.evaluate(({shell})=>{
    globalThis.__externalLinks=[];
    shell.openExternal=async url=>{globalThis.__externalLinks.push(url);};
  });
  await page.evaluate(()=>window.open('https://m.meituan.com/hotel/123','_blank'));
  await application.evaluate(async()=>{while(!globalThis.__externalLinks.length)await new Promise(resolve=>setTimeout(resolve,20));});
  assert.deepEqual(await application.evaluate(()=>globalThis.__externalLinks),['https://m.meituan.com/hotel/123']);
  await page.evaluate(()=>window.open('file:///C:/Windows/System32/calc.exe','_blank'));
  assert.equal((await application.evaluate(()=>globalThis.__externalLinks)).length,1);
  assert.equal(await page.evaluate(()=>location.origin),'https://111.230.133.155');
  console.log('PASS booking links use external browser; executable/file links blocked');

  const pdf=path.join(output,'sample-itinerary.pdf');
  await application.evaluate(({dialog},pdf)=>{
    dialog.showSaveDialog=async()=>({canceled:false,filePath:pdf});
    dialog.showMessageBox=async()=>({response:0});
  },pdf);
  await frame.locator('#pdf').click();
  for(let i=0;i<100;i++){try{if((await stat(pdf)).size>100)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.equal((await readFile(pdf)).subarray(0,4).toString(),'%PDF');
  console.log('PASS actual guest itinerary rendered into PDF with desktop export control');
  const preferences=await application.evaluate(()=>({partition:globalThis.__tripmateTest.workspace.webContents.session.getStoragePath()}));
  assert.ok(preferences.partition.startsWith(env.TRIPMATE_TEST_PROFILE));
  offline=true;
  await application.evaluate(()=>globalThis.__tripmateTest.connect());
  await frame.waitForFunction(()=>document.querySelector('#connection-text').textContent==='连接中断');
  await frame.locator('#retry').waitFor({state:'visible'});
  assert.match(await frame.locator('#status-message').innerText(),/联网/);
  assert.equal(await application.evaluate(()=>globalThis.__tripmateTest.workspace.getVisible()),false);
  await frame.screenshot({path:path.join(output,'offline-recovery.png')});
  offline=false;
  await frame.locator('#retry').click();
  await page.locator('#login-email').waitFor({state:'visible'});
  await frame.waitForFunction(()=>document.querySelector('#connection-text').textContent==='已连接');
  console.log('PASS offline error and reconnect; temporary isolated profile');
  await writeFile(path.join(output,'summary.json'),JSON.stringify({passed:true,realHTTPS:true,mocked:['register/login switching','guest','booking URL','PDF save dialog','offline recovery'],noRealAccountOrPaidAI:true},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(application)await application.close();});
