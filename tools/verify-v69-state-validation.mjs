// Isolated local HTTP server, real Chromium UI and synthetic accounts only.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
const root = resolve(import.meta.dirname, '..'), source = process.argv[2] || 'guest-v69';
const dir = await mkdtemp(join(tmpdir(), 'tripmate-v69-state-validation-'));
const password = randomBytes(18).toString('hex'), salt = randomBytes(16).toString('hex');
const original = { 'tripmate.v1.orders': [{ id: 'original', name: '原有订单保留', type: '火车票', status: '待预订', amount: 150 }] };
const users = ['alpha', 'beta'].map(id => ({ id, email: id + '@example.invalid', name: id, role: 'user', passwordSalt: salt,
  passwordHash: scryptSync(password, salt, 64).toString('hex'), creditBalance: 73, creditTransactions: [], stateVersion: 5, state: original }));
await writeFile(join(dir, 'accounts.json'), JSON.stringify({ version: 2, users, sessions: [], guests: [] }));
const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r));
const port = probe.address().port; await new Promise(r => probe.close(r));
const child = spawn(process.execPath, [join(root, source, 'tripmate-ai-server.mjs')], {
  env: { ...process.env, PORT: String(port), TRIPMATE_DATA_DIR: dir }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
});
await new Promise((r, j) => { child.stdout.once('data', r); child.once('error', j); setTimeout(() => j(Error('startup timeout')), 10000).unref(); });
const base = 'http://127.0.0.1:' + port;
const call = async (path, token, method = 'GET', data) => {
  const response = await fetch(base + path, { method, headers: { 'x-tripmate-client': 'native', 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  return { status: response.status, data: await response.json() };
};
const backup = state => ({ format: 'tripmate-account-backup', version: 1, user: { email: users[0].email }, expectedStateVersion: 5, data: { state } });
let browser;
try {
  const token = (await call('/api/auth/login', '', 'POST', { email: users[0].email, password })).data.token;
  if (source === 'guest-v67') {
    const broken = { 'tripmate.v1.orders': [null] };
    assert.equal((await call('/api/account/import', token, 'POST', backup(broken))).status, 200);
    const html = await readFile(join(root, source, 'tripmate-mvp.html'), 'utf8');
    const start = html.indexOf('function renderOrders()'), end = html.indexOf("$('#order-form').onsubmit", start);
    const context = { readStore: () => [null], storeKeys: { orders: 'tripmate.v1.orders' }, $: () => ({}), yuan: String };
    vm.createContext(context); vm.runInContext(html.slice(start, end), context);
    assert.throws(() => vm.runInContext('renderOrders()', context), /amount/);
    console.log('REPRODUCED v67: malformed backup accepted and persisted; actual renderOrders throws on restored null record. Synthetic data only.');
  } else {
    const { default: schema } = await import(pathToFileURL(join(root, source, 'tripmate-state-schema.js')));
    const malformed = [
      ...['trips', 'orders', 'reminders', 'expenses', 'packing'].flatMap(name => [
        { ['tripmate.v1.' + name]: { length: 1 } }, { ['tripmate.v1.' + name]: [null] }, { ['tripmate.v1.' + name]: ['bad'] }
      ]),
      { 'tripmate.v1.trips': [{ plan: null }] }, { 'tripmate.v1.draft': [] },
      { 'tripmate.v1.draft': { days: {} } }, { 'tripmate.v1.draft': { days: [{ events: {} }] } },
      { 'tripmate.v1.draft': { days: [{}] } }, { 'tripmate.v1.draft': { days: [{ events: [null] }] } },
      { 'tripmate.v1.draft': { transportLegs: [null] } },
      { 'tripmate.v1.draft': { recommendations: { hotels: {} } } },
      { 'tripmate.v1.draft': { recommendations: { restaurants: [{ reviewReasons: {} }] } } },
      { 'tripmate.v1.draft': { budget: { lodging: { items: [null] } } } },
      { 'tripmate.v1.fun': { completed: [null] } }, { 'tripmate.v1.fun': [] },
      { 'tripmate.v1.preferences': 'bad' }, { 'tripmate.v1.emergency': [] }, { 'tripmate.v1.largeMode': 'false' }
    ];
    for (const state of malformed) {
      const snapshot = JSON.stringify(state);
      assert.throws(() => schema.assertState(state), error => error.code === 'STATE_INVALID');
      assert.equal(JSON.stringify(state), snapshot, 'Validation must not modify or repair the source');
      for (const [path, method, body] of [
        ['/api/account/import', 'POST', backup(state)], ['/api/account/state', 'PUT', { state, stateVersion: 5 }]
      ]) {
        const result = await call(path, token, method, body);
        assert.equal(result.status, 400); assert.equal(result.data.code, 'STATE_INVALID');
        const saved = (await call('/api/account/state', token)).data;
        assert.equal(saved.stateVersion, 5); assert.deepEqual(saved.state, original);
      }
    }
    // No business content or credentials are copied into validation errors.
    assert(!JSON.stringify((await call('/api/account/import', token, 'POST', backup({ 'tripmate.v1.orders': ['private-sentinel'] }))).data).includes('private-sentinel'));
    const oldPlan = { title: '旧版行程', days: [{ day: '第1天', events: [] }], budget: { transport: 100, lodging: 200, foodTickets: 50 }, customField: 'keep' };
    const compatible = { ...original, 'tripmate.v1.draft': oldPlan, 'tripmate.v1.trips': [{ id: 'old', plan: oldPlan }, oldPlan, { legacyMetadata: 'preserve' }], 'tripmate.v1.reminders': [{ id: 'old-reminder-1', text: '旧提醒未填日期' }, { id: 'old-reminder-2', text: '第二条旧提醒' }], 'tripmate.v1.preferences': null, 'tripmate.v1.fun': { completed: [] }, 'tripmate.v1.largeMode': false };
    assert.equal(schema.assertState(compatible), compatible);
    const browserSource = await readFile(join(root, source, 'tripmate-state-schema.js'), 'utf8'), context = {};
    vm.createContext(context); vm.runInContext(browserSource, context);
    for (const state of malformed) assert.throws(() => context.TripMateStateSchema.assertState(state));
    assert.equal(context.TripMateStateSchema.assertState(compatible), compatible);
    // Current Android plan operations preserve raw legacy plans and unknown archive metadata.
    const native = await import(pathToFileURL(join(root, 'TripMate-native-v58/src/plan/domain.ts')));
    const nativeState = native.applyPlanOperation(compatible, { kind: 'save', plan: { ...oldPlan, title: '安卓收藏操作' }, id: 'native-save', savedAt: '2026-11-12' });
    assert.equal(schema.assertState(nativeState), nativeState);
    assert.equal((await call('/api/account/state', token, 'PUT', { state: nativeState, stateVersion: 5 })).status, 200);
    assert.deepEqual((await call('/api/account/state', token)).data.state, nativeState);
    const { chromium } = await import(pathToFileURL(join(root, 'TripMate-desktop-v54/node_modules/playwright-core/index.mjs')));
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, acceptDownloads: true });
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(base); await page.fill('#login-email', users[0].email); await page.fill('#login-password', password);
      await page.locator('#login-form button[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('#auth-gate').hidden && !accountSyncInFlight && !syncTimer);
      await page.locator('#account-button').click();
      let imports = 0; page.on('request', r => { if (r.url().endsWith('/api/account/import')) imports++; });
      const before = (await call('/api/account/state', token)).data;
      // Delay the actual browser File.text while a newer selection finishes first.
      await page.evaluate(() => {
        const originalText = File.prototype.text, input = document.querySelector('#account-backup-file'), originalHandler = input.onchange;
        input.onchange = event => (window.latestReadTask = originalHandler(event));
        File.prototype.text = function () {
          if (this.name !== 'slow-old.json') return originalText.call(this);
          const file = this;
          return new Promise((resolve, reject) => { window.delayedRead = { resolve: () => originalText.call(file).then(resolve, reject), reject }; });
        };
      });
      for (const fail of [false, true]) {
        const old = backup({ ...compatible, 'tripmate.v1.draft': { ...oldPlan, title: '旧读取不得重新出现' } });
        await page.locator('#account-backup-file').setInputFiles({ name: 'slow-old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
        await page.evaluate(() => { window.oldReadTask = window.latestReadTask; });
        const selected = backup({ ...compatible, 'tripmate.v1.draft': { ...oldPlan, title: '最新选择应保留' } });
        await page.locator('#account-backup-file').setInputFiles({ name: 'new-selection.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(selected)) });
        await page.waitForFunction(() => document.querySelector('#restore-file-name').textContent === 'new-selection.json');
        await page.evaluate(async fail => { if (fail) window.delayedRead.reject(Error('synthetic-old-file-error')); else window.delayedRead.resolve(); await window.oldReadTask; }, fail);
        assert.equal(await page.evaluate(() => pendingAccountRestore.data.state['tripmate.v1.draft'].title), '最新选择应保留');
        assert.equal(await page.locator('#restore-file-name').textContent(), 'new-selection.json');
        assert((await page.locator('#profile-message').textContent()).includes('通过本机检查'));
        assert.equal(imports, 0); assert.deepEqual((await call('/api/account/state', token)).data, before);
      }
      await page.screenshot({ path: join(dir, `latest-file-preserved-${width}.png`), fullPage: false });
      for (const [label, state] of [['订单', { 'tripmate.v1.orders': [null] }], ['events', { 'tripmate.v1.draft': { days: [{ events: {} }] } }]]) {
        await page.locator('#account-backup-file').setInputFiles({ name: 'synthetic-broken.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup(state))) });
        await page.waitForFunction(() => document.querySelector('#profile-message').textContent.includes('旅行数据格式不正确'));
        assert((await page.locator('#profile-message').textContent()).includes(label));
        assert(await page.locator('#restore-preview').isHidden()); assert.equal(imports, 0);
        assert.deepEqual((await call('/api/account/state', token)).data, before);
      }
      await page.screenshot({ path: join(dir, `backup-rejected-${width}.png`), fullPage: true });
      // Real UI positive control: legacy-shaped valid backup still restores, edits and reloads.
      const valid = backup(compatible);
      await page.locator('#account-backup-file').setInputFiles({ name: 'synthetic-valid-v1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(valid)) });
      await page.waitForFunction(() => !document.querySelector('#restore-preview').hidden);
      await page.locator('#confirm-account-restore').click();
      await page.waitForFunction(() => document.querySelector('#profile-message').textContent.includes('恢复完成'));
      assert.equal(imports, 1);
      await page.reload(); await page.waitForFunction(() => document.querySelector('#auth-gate').hidden && !accountSyncInFlight && !syncTimer);
      await page.locator('#edit-plan').click(); assert(await page.locator('#plan-editor').isVisible()); await page.locator('#close-editor').click();
      await page.evaluate(() => { window.print = () => { window.syntheticPrintOpened = true; }; });
      await page.locator('#print-plan').click(); await page.waitForFunction(() => window.syntheticPrintOpened);
      assert((await page.locator('#print-sheet').textContent()).includes('旧版行程'));
      const pdf = await page.pdf({ path: join(dir, `synthetic-plan-${width}.pdf`), landscape: true, format: 'A4' });
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
      await page.evaluate(() => { switchAppPage('orders'); });
      assert((await page.locator('#orders-list').textContent()).includes('原有订单保留'));
      await page.screenshot({ path: join(dir, `orders-after-restore-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await context.close();
    }
    const stored = JSON.parse(await readFile(join(dir, 'accounts.json'), 'utf8'));
    assert.deepEqual(stored.users.find(u => u.id === 'beta').state, original);
    for (const user of stored.users) { assert.equal(user.creditBalance, 73); assert.equal(user.role, 'user'); }
    console.log(`PASS ${malformed.length} malformed structures rejected by shared browser/server checks and both write APIs without changing records/version; legacy backup restores in real 390/1280 Chromium UI; account/credit isolation. Screenshots: ${dir}`);
  }
} finally { if (browser) await browser.close(); child.kill(); }
