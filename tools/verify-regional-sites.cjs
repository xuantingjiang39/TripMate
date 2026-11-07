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
  const worker=(await import(pathToFileURL(path.join(root,'overseas-v58-source/.sites-checkout/dist/server/index.js')))).default;
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
  const child=spawn(process.execPath,[path.join(root,'guest-v58/tripmate-ai-server.mjs')],{env:{...process.env,PORT:String(domesticPort),TRIPMATE_DATA_DIR:path.join(output,'data')},windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    for(const [region,port] of [['domestic',domesticPort],['overseas',globalServer.address().port]]){
      const base=`http://127.0.0.1:${port}`;
      for(const width of [390,1280]){
        const context=await browser.newContext({viewport:{width,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.goto(base+'/download');
        await page.locator('#tripmate-region').waitFor();assert.equal(await page.locator('#tripmate-region').inputValue(),region);
        await page.selectOption('#tripmate-language','en');
        assert.equal(await page.locator('html').getAttribute('lang'),'en');
        assert.match(await page.locator('h1').textContent(),/travel plans/);
        assert.match(await page.locator('#download-android').textContent(),/Download Android/);
        assert.equal(new URL(await page.locator('#download-android').getAttribute('href'),base).origin,base);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.screenshot({path:path.join(output,`${region}-${width}-english.png`),fullPage:true});
        await page.selectOption('#tripmate-language','ja');assert.match(await page.locator('h1').textContent(),/旅の計画/);
        await page.reload();assert.equal(await page.locator('#tripmate-language').inputValue(),'ja');
        await page.route('https://111.230.133.155/**',route=>route.fulfill({body:'<html>route selected</html>',contentType:'text/html'}));
        await page.route('https://tripmate-travel-planner.xuantingjiang39.chatgpt.site/**',route=>route.fulfill({body:'<html>route selected</html>',contentType:'text/html'}));
        await page.selectOption('#tripmate-region',region==='domestic'?'overseas':'domestic');await page.waitForURL(/https:\/\//);
        assert.equal(new URL(page.url()).hostname,region==='domestic'?'tripmate-travel-planner.xuantingjiang39.chatgpt.site':'111.230.133.155');assert.equal(new URL(page.url()).searchParams.get('lang'),'ja');
        await page.goto(base+'/?lang=zh-CN');await page.locator('#tripmate-language').waitFor();
        const optionValues=await page.locator('select:not(#tripmate-region):not(#tripmate-language) option').evaluateAll(options=>options.map(option=>option.value));
        const input=page.locator('input[type="email"]').first();await input.fill('example@example.invalid');
        await page.selectOption('#tripmate-language','en');assert.equal(await input.inputValue(),'example@example.invalid');
        assert.deepEqual(await page.locator('select:not(#tripmate-region):not(#tripmate-language) option').evaluateAll(options=>options.map(option=>option.value)),optionValues);
        await page.screenshot({path:path.join(output,`${region}-${width}-login.png`),fullPage:true});
        assert.deepEqual(errors,[]);await context.close();
      }
    }
    for(const theme of ['light','dark'])for(const screen of ['Today','Plan','TripDetail','Profile']){
      const page=await browser.newPage({viewport:{width:390,height:844}});
      await page.goto(pathToFileURL(path.join(root,`TripMate-native-v58/.build-check/ui-preview/${theme}-${screen}.html`)).href);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(output,`native-component-${theme}-${screen}.png`),fullPage:true});await page.close();
    }
    console.log('PASS: domestic/global routes, English/Japanese/persistence, preserved input, Worker download whitelist + no credential forwarding, desktop/mobile UI, native component layout preview (not hardware). Screenshots:',output);
  }finally{await browser.close();child.kill();globalServer.closeAllConnections();await new Promise(r=>globalServer.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
