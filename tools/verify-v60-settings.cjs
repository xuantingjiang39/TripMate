'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const {chromium}=require(path.join(root,'TripMate-desktop-v54/node_modules/playwright-core'));
(async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'tripmate-regional-ui-'));
  const worker=(await import(pathToFileURL(path.join(root,'TripMate-overseas-v60/dist/server/index.js')))).default;
  const originalFetch=globalThis.fetch;
  let upstreamOptions;
  globalThis.fetch=async(input,options)=>{
    if(String(input).startsWith('https://github.com/')){upstreamOptions=options;return new Response(options.method==='HEAD'?null:'APK',{status:206,headers:{'content-length':'3','content-range':'bytes 0-2/40748630','accept-ranges':'bytes'}});}
    return originalFetch(input,options);
  };
  try{
    const response=await worker.fetch(new Request('https://global.test/downloads/TripMate-v58-android-v1.1.5.apk',{headers:{range:'bytes=0-2',cookie:'private=never-forward',authorization:'Bearer private'}}),{});
    assert.equal(response.status,206);assert.equal(await response.text(),'APK');assert.equal(upstreamOptions.headers.get('range'),'bytes=0-2');assert.equal(upstreamOptions.headers.get('cookie'),null);assert.equal(upstreamOptions.headers.get('authorization'),null);
    for(const name of ['accounts.json','toString','config.json'])assert.equal((await worker.fetch(new Request('https://global.test/downloads/'+name),{})).status,404);
    assert.equal((await worker.fetch(new Request('https://global.test/downloads/TripMate-v58-android-v1.1.5.apk',{method:'POST'}),{})).status,405);
  }finally{globalThis.fetch=originalFetch;}
  const globalServer=http.createServer(async(req,res)=>{
    if(req.url.startsWith('/api/')){res.writeHead(401,{'content-type':'application/json'});return res.end('{"authenticated":false}');}
    try{const response=await worker.fetch(new Request('http://localhost'+req.url,{method:req.method}),{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end();}
  });
  await new Promise(r=>globalServer.listen(0,'127.0.0.1',r));
  const domesticProbe=http.createServer();await new Promise(r=>domesticProbe.listen(0,'127.0.0.1',r));const domesticPort=domesticProbe.address().port;await new Promise(r=>domesticProbe.close(r));
  const child=spawn(process.execPath,[path.join(root,'guest-v60/tripmate-ai-server.mjs')],{env:{...process.env,PORT:String(domesticPort),TRIPMATE_DATA_DIR:path.join(output,'data')},windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    for(const [region,port] of [['domestic',domesticPort],['overseas',globalServer.address().port]]){
      const base=`http://127.0.0.1:${port}`;
      for(const width of [390,1280]){
        const context=await browser.newContext({viewport:{width,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.goto(base+'/download?private=do-not-transfer');
        await page.locator('#tripmate-region-switch').waitFor();
        assert(await page.locator('#tripmate-region-switch').isVisible());
        const link=new URL(await page.locator('#tripmate-region-switch').getAttribute('href'));
        assert.equal(link.hostname,region==='domestic'?'tripmate-travel-planner.xuantingjiang39.chatgpt.site':'111.230.133.155');
        assert.equal(link.pathname,'/download');assert.equal(link.searchParams.get('private'),null);
        await page.locator('#tripmate-settings-toggle').click();
        assert.equal(await page.locator('#tripmate-settings-toggle').getAttribute('aria-expanded'),'true');
        const codes=await page.locator('#tripmate-language option').evaluateAll(items=>items.map(i=>i.value));assert.equal(codes.length,44);
        for(const code of codes){
          await page.selectOption('#tripmate-language',code);
          assert.equal(await page.locator('html').getAttribute('lang'),code);
          assert.equal(await page.locator('html').getAttribute('dir'),['ar','he','fa','ur'].includes(code)?'rtl':'ltr');
          assert((await page.locator('#tripmate-settings-title').textContent()).length>0);
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),code+' overflow');
        }
        await page.selectOption('#tripmate-language','fr');
        assert.equal(await page.locator('#tripmate-settings-title').textContent(),'Paramètres');
        await page.selectOption('#tripmate-text-size','large');await page.check('#tripmate-reduce-motion');
        assert(await page.locator('html').evaluate(el=>el.classList.contains('tripmate-large-text')&&el.classList.contains('tripmate-reduce-motion')));
        await page.reload();await page.locator('#tripmate-settings-toggle').click();
        assert.equal(await page.locator('#tripmate-language').inputValue(),'fr');assert.equal(await page.locator('#tripmate-text-size').inputValue(),'large');assert(await page.locator('#tripmate-reduce-motion').isChecked());
        const savedLink=new URL(await page.locator('#tripmate-region-switch').getAttribute('href'));assert.equal(savedLink.searchParams.get('lang'),'fr');assert.equal(savedLink.searchParams.get('textSize'),'large');assert.equal(savedLink.searchParams.get('motion'),'true');
        await page.screenshot({path:path.join(output,`${region}-${width}-settings-fr.png`),fullPage:true});
        await page.selectOption('#tripmate-language','ar');await page.screenshot({path:path.join(output,`${region}-${width}-settings-ar.png`),fullPage:true});
        await page.keyboard.press('Escape');assert(await page.locator('#tripmate-settings-panel').isHidden());assert(await page.locator('#tripmate-settings-toggle').evaluate(el=>el===document.activeElement));
        const target=new URL(await page.locator('#tripmate-region-switch').getAttribute('href'));
        await page.route(target.origin+'/**',route=>route.fulfill({body:'<html>route selected</html>',contentType:'text/html'}));
        await page.locator('#tripmate-region-switch').click();await page.waitForURL(target.href);
        await page.goto(base+'/?lang=zh-CN&textSize=standard&motion=system');await page.locator('#tripmate-settings-toggle').waitFor();
        const input=page.locator('input[type="email"]').first();await input.fill('example@example.invalid');
        const optionValues=await page.locator('select:not(#tripmate-language):not(#tripmate-text-size) option').evaluateAll(options=>options.map(option=>option.value));
        await page.locator('#tripmate-settings-toggle').click();await page.selectOption('#tripmate-language','de');assert.equal(await input.inputValue(),'example@example.invalid');
        assert.deepEqual(await page.locator('select:not(#tripmate-language):not(#tripmate-text-size) option').evaluateAll(options=>options.map(option=>option.value)),optionValues);
        // Newly inserted itinerary content must never be translated by the UI layer.
        await page.evaluate(()=>{const e=document.createElement('div');e.className='event';e.textContent='登录 保存';document.body.append(e);});await page.waitForTimeout(50);assert.equal(await page.locator('.event').last().textContent(),'登录 保存');
        await page.selectOption('#tripmate-language','zh-CN');await page.keyboard.press('Escape');
        await page.screenshot({path:path.join(output,`${region}-${width}-toolbar.png`),fullPage:true});
        assert.deepEqual(errors,[]);await context.close();
      }
    }
    console.log('PASS: 44 locales, RTL, visible site switch, settings open/close/Escape, preference persistence and safe transfer, preserved form enums/inputs/itinerary, domestic/global routes, isolated HTTP and mocked Worker download whitelist + no credential forwarding, desktop/mobile UI. Screenshots:',output);
  }finally{await browser.close();child.kill();globalServer.closeAllConnections();await new Promise(r=>globalServer.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
