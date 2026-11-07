'use strict';
// Local HTTP + browser checks. Uses an isolated empty data directory and no paid services.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = require(path.join(root, 'PROJECT.json')).components.server;
const {chromium} = require(path.join(root, 'TripMate-desktop-v54/node_modules/playwright-core'));
async function main() {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'tripmate-downloads-'));
  const probe = net.createServer();
  await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port;
  await new Promise(r => probe.close(r));
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(root, source.source, 'tripmate-ai-server.mjs')], {env: {...process.env, PORT: String(port), TRIPMATE_DATA_DIR: data}, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
  let browser;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Local server startup timed out')), 10000);
      child.once('error', reject);
      child.stdout.once('data', () => {clearTimeout(timer);resolve();});
      child.once('exit', code => {clearTimeout(timer);reject(Error(`Server exited ${code}`));});
    });
    for (const route of ['/download', '/download/', '/download.html']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('set-cookie'), null);
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      const body = await response.text();
      assert.match(body, /下载安卓 APK/);
      assert.match(body, /下载 Windows 版/);
      const head = await fetch(base + route, {method:'HEAD'});
      assert.equal(head.status, 200);
      assert.equal(await head.text(), '');
      assert.equal(Number(head.headers.get('content-length')), Buffer.byteLength(body));
    }
    const icon = await fetch(base + '/tripmate-icon.png');
    assert.equal(icon.headers.get('content-type'), 'image/png');
    assert.equal(Buffer.from(await icon.arrayBuffer()).subarray(0,8).toString('hex'), '89504e470d0a1a0a');
    for (const route of ['/api/auth/me','/api/account/state','/api/account/export']) {
      assert.equal((await fetch(base + route)).status, 401, route);
    }
    assert.equal((await fetch(base + '/download/config.json')).status, 404);
    assert.equal((await fetch(base + '/download', {method:'POST'})).status, 404);
    assert.deepEqual(await fs.readdir(data), [], 'Public routes must not create account databases');
    assert.equal((await (await fetch(base+'/api/health')).json()).version, source.version);
    browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
    const variants = [
      {name:'desktop',viewport:{width:1280,height:900},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0',recommended:'windows'},
      {name:'android',viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (Linux; Android 10; HUAWEI Mate 30) Chrome/120.0 Mobile Safari/537.36',recommended:'android'},
      {name:'iphone',viewport:{width:375,height:812},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',recommended:null}
    ];
    for (const variant of variants) {
      const context = await browser.newContext({viewport:variant.viewport,userAgent:variant.userAgent});
      await context.addCookies([{name:'legacy',value:'%',url:base}]);
      const page = await context.newPage();
      const errors=[];page.on('pageerror', e=>errors.push(e.message));
      await page.goto(base);
      await page.locator('.auth-download-link').waitFor({state:'visible'});
      assert.equal(await page.locator('.auth-download-link').getAttribute('href'), '/download');
      await page.screenshot({path:path.join(data,`${variant.name}-login.png`),fullPage:true});
      const popupPromise = page.waitForEvent('popup');
      await page.locator('.auth-download-link').click();
      const downloadPage = await popupPromise;
      await downloadPage.waitForLoadState();
      assert.equal(new URL(downloadPage.url()).pathname, '/download');
      if (variant.recommended) assert.equal(await downloadPage.locator('.recommended').getAttribute('id'),variant.recommended);
      else assert.match(await downloadPage.locator('#device-hint').textContent(), /目前请使用网页版/);
      assert(await downloadPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      for (const platform of ['android','windows']) {
        const link=downloadPage.locator(`#download-${platform}`);
        const href=await link.getAttribute('href');
        const target=new URL(href,base);
        assert.equal(target.origin,base);
        assert.match(target.pathname,/^\/downloads\/TripMate-v\d+-.+\.(apk|exe)$/);
        const response=await fetch(target,{method:'HEAD'});
        assert.equal(response.status,200);
        assert.equal(response.headers.get('accept-ranges'),'bytes');
        assert((await link.boundingBox()).height>=44);
      }
      await downloadPage.locator('#download-android').focus();
      assert.equal(await downloadPage.locator('#download-android').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
      await downloadPage.screenshot({path:path.join(data,`${variant.name}-downloads.png`),fullPage:true});
      await downloadPage.close();
      await page.locator('#continue-as-guest').click();
      await page.waitForFunction(()=>document.getElementById('auth-gate').hidden);
      assert(await page.locator('.app-download-link').isVisible());
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.deepEqual(errors,[], 'No JS errors');
      await context.close();
    }
    const noJs=await browser.newContext({javaScriptEnabled:false});
    const page=await noJs.newPage();await page.goto(base+'/download');
    assert(await page.locator('#download-android').isVisible());
    assert(await page.locator('#download-windows').isVisible());
    console.log(`PASS: public HTTP routes, HEAD, icon, auth isolation, desktop/Android/iPhone UI, guest entry, no-JS links. Screenshots: ${data}`);
  } finally {if(browser)await browser.close();child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
