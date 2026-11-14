// Real local HTTP requests; synthetic accounts only. No production data or paid APIs.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDirectory = await mkdtemp(join(tmpdir(), 'tripmate-request-isolation-'));
const accountFile = join(dataDirectory, 'accounts.json');
const password = randomBytes(18).toString('hex');
const seed = {version: 2, users: ['alpha', 'beta'].map((id, i) => {
  const salt = randomBytes(16).toString('hex');
  return {id, email: `${id}@example.invalid`, name: `合成测试用户 ${i + 1}`, role: 'user',
    passwordSalt: salt, passwordHash: scryptSync(password, salt, 64).toString('hex'),
    creditBalance: 37 + i, creditTransactions: [], stateVersion: 0,
    state: {'tripmate.v1.trips': [{id: `${id}-private-trip`, title: `测试行程 ${i + 1}`}],
      'tripmate.v1.orders': [{id: `${id}-order`}], 'tripmate.v1.preferences': {pace: 'relaxed'}}};
}), sessions: [], guests: []};
await writeFile(accountFile, JSON.stringify(seed));
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const child = spawn(process.execPath, [fileURLToPath(new URL('./tripmate-ai-server.mjs', import.meta.url))], {
  env: {...process.env, PORT: String(port), TRIPMATE_DATA_DIR: dataDirectory},
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
});
let stderr = '';
child.stderr.on('data', value => {stderr += value.toString();});

function call(path, {method = 'GET', headers = {}, body} = {}) {
  return new Promise((resolve, reject) => {
    const req = request({hostname: '127.0.0.1', port, path, method,
      headers: {...(body === undefined ? {} : {'content-type': 'application/json'}), ...headers}}, res => {
      let text = '';res.setEncoding('utf8');res.on('data', chunk => {text += chunk;});
      res.on('end', () => {let json;try {json = JSON.parse(text);} catch {} resolve({status: res.statusCode, headers: res.headers, text, json});});
    });
    req.setTimeout(8000, () => req.destroy(Error('Local HTTP timeout')));
    req.on('error', reject);req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Startup timeout')), 10000);
    child.once('error', reject);
    child.once('exit', () => {clearTimeout(timer);reject(Error('Unexpected startup exit'));});
    child.stdout.once('data', () => {clearTimeout(timer);resolve();});
  });
  const accountBytes = await readFile(accountFile, 'utf8');
  for (const cookie of ['legacy=%', 'legacy=%E0%A4%A', 'tripmate_session=%', 'tripmate_guest=%', 'empty; legacy=%FF']) {
    for (const path of ['/api/auth/me', '/api/account/state', '/api/account/export', '/api/auth/guest']) {
      assert.equal((await call(path, {headers: {cookie}})).status, 401, path);
      assert.equal((await call('/api/health')).status, 200);
    }
  }
  assert.equal(await readFile(accountFile, 'utf8'), accountBytes, 'Malformed anonymous requests must not alter accounts');
  const invalidAddress = await call('http://[');
  assert.equal(invalidAddress.status, 400);
  assert.equal(invalidAddress.json.code, 'INVALID_REQUEST_URL');
  assert.equal((await call('/api/health')).status, 200);

  const sessions = {};
  for (const user of seed.users) {
    const login = await call('/api/auth/login', {method:'POST', body: {email:user.email, password}, headers:{'x-forwarded-proto':'https'}});
    assert.equal(login.status, 200);
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    assert.match(login.headers['set-cookie'][0], /HttpOnly; SameSite=Lax/);
    assert.match(login.headers['set-cookie'][0], /Secure/);
    sessions[user.id] = cookie;
    const result = await call('/api/account/state', {headers:{cookie: `legacy=%; ${cookie}; another=%FF`}});
    assert.equal(result.status, 200);
    assert.deepEqual(result.json.state, user.state, 'Valid session survives unrelated malformed cookie');
  }
  const alphaCookie = sessions.alpha;
  const token = decodeURIComponent(alphaCookie.split('=')[1]);
  const native = await call('/api/auth/me', {headers:{authorization:`Bearer ${token}`,cookie:'legacy=%','x-tripmate-client':'native'}});
  assert.equal(native.json.user.id, 'alpha');
  const nextState = {...seed.users[0].state, 'tripmate.v1.reminders': [{id:'alpha-reminder', title:'测试提醒'}]};
  const saved = await call('/api/account/state', {method:'PUT',headers:{cookie:`legacy=%; ${alphaCookie}`},body:{state:nextState,stateVersion:0}});
  assert.equal(saved.status, 200);
  assert.equal(saved.json.stateVersion, 1);
  assert.equal((await call('/api/account/state', {method:'PUT',headers:{cookie:alphaCookie},body:{state:seed.users[0].state,stateVersion:0}})).status, 409);
  assert.deepEqual((await call('/api/account/state', {headers:{cookie:sessions.beta}})).json.state, seed.users[1].state);
  const exported = await call('/api/account/export', {headers:{cookie:`bad=%; ${alphaCookie}`}});
  assert.equal(exported.status, 200);
  assert.deepEqual(exported.json.data.state, nextState);
  assert.equal(exported.json.user.creditBalance, 37);
  assert(!exported.text.includes('beta-private-trip'));
  assert(!exported.text.includes('passwordHash'));

  // Force an uncaught storage error in this isolated test directory, then restore the same bytes.
  const goodBytes = await readFile(accountFile);
  await writeFile(accountFile, '{INVALID_SYNTHETIC_DATABASE');
  const failed = await call('/api/auth/me', {headers:{cookie:alphaCookie}});
  assert.equal(failed.status, 500);
  assert.equal(failed.json.code, 'REQUEST_FAILED');
  assert(!failed.text.includes('INVALID_SYNTHETIC_DATABASE'));
  assert(!failed.text.includes(dataDirectory));
  assert.equal((await call('/download')).status, 200, 'Public page survives account storage failure');
  assert.equal((await call('/api/health')).status, 200);
  assert.equal((await readFile(accountFile, 'utf8')), '{INVALID_SYNTHETIC_DATABASE', 'No silent database reset');
  await writeFile(accountFile, goodBytes);
  assert.deepEqual((await call('/api/account/state', {headers:{cookie:alphaCookie}})).json.state, nextState);
  assert.equal((await call('/api/auth/logout', {method:'POST',headers:{cookie:alphaCookie}})).status, 200);
  assert.equal((await call('/api/auth/me', {headers:{cookie:alphaCookie}})).status, 401);
  assert.equal((await call('/api/auth/me', {headers:{cookie:sessions.beta}})).status, 200);
  const finalData = JSON.parse(await readFile(accountFile, 'utf8'));
  for (const user of seed.users) {
    const finalUser = finalData.users.find(item => item.id === user.id);
    assert.equal(finalUser.creditBalance, user.creditBalance);
    assert.equal(finalUser.passwordHash, user.passwordHash);
    assert.deepEqual(finalUser.state['tripmate.v1.orders'], user.state['tripmate.v1.orders']);
  }
  assert.equal(child.exitCode, null);
  assert.equal(stderr, '');
  console.log('PASS v56: malformed cookies/URLs, HTTP login + native token, save/conflict/export/logout, two-account isolation, credit/order preservation, storage-error recovery. Synthetic accounts; no paid APIs.');
} finally {
  child.kill();
}
