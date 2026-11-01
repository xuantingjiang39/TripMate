import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const noOp = () => {};
function visibleText(renderer) {
  const walk = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(walk).join(' ') : node?.children ? walk(node.children) : '';
  return walk(renderer.toJSON());
}
const native = {
  Platform: { OS: 'android' }, StyleSheet: { create: value => value, hairlineWidth: 1 },
  useColorScheme: () => 'light', useWindowDimensions: () => ({ width: 390, height: 844 }),
  AppState: { currentState: 'active', addEventListener: () => ({ remove: noOp }) },
  Alert: { alert: noOp }, Share: { share: async () => ({}) },
  ...Object.fromEntries(['View', 'Text', 'Pressable', 'Image', 'TextInput', 'ScrollView', 'RefreshControl', 'ActivityIndicator', 'KeyboardAvoidingView'].map(name => [name, name])),
};

function loader(overrides = {}) {
  const cache = new Map();
  const mocks = { react: React, 'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@react-navigation/native': { useNavigation: () => ({ navigate: noOp }), useFocusEffect: noOp },
    'expo-linking': { openURL: async () => {}, openSettings: async () => {} },
    'expo-constants': { default: { expoConfig: { version: '1.1.0', extra: { apiBaseUrl: 'https://example.test' } } }, __esModule: true },
    ...overrides };
  function load(input) {
    const path = resolve(root, input);
    if (path in mocks) return mocks[path];
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} }; cache.set(path, module);
    const source = readFileSync(path, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = name => {
      if (name in mocks) return mocks[name];
      if (!name.startsWith('.')) return require(name);
      const base = resolve(dirname(path), name);
      const target = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
      if (!target) throw new Error(`Missing test dependency ${name}`);
      return load(target);
    };
    new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}

const simplePlan = (title, city = '杭州') => ({ title, days: [{ day: '第 1 天', city, date: '10月24日', events: [{ name: '09:00 西湖', note: '慢走' }] }, { day: '第 2 天', city, date: '10月25日', events: [{ name: '10:00 灵隐寺' }] }], budget: { currency: 'CNY', total: 5000 } });
const domain = loader()('src/plan/domain.ts');
let passed = 0;
async function test(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
await test('中文日期、ISO 日期、跨年与日期缺失', () => {
  const now = new Date(2026, 9, 25);
  assert.equal(domain.todayDayIndex(simplePlan('A').days, now), 1);
  assert.equal(domain.todayDayIndex([{ date: '2025-10-25' }, { date: '2026-10-25' }], now), 1);
  assert.equal(domain.todayDayIndex([{ date: '1月1日' }], new Date(2027, 0, 1)), 0);
  assert.equal(domain.todayDayIndex([{ date: '' }, { date: '第2天' }], now), 0);
});
await test('网页版包装与旧版原生行程都能读取', () => {
  const entries = domain.savedTrips({ 'tripmate.v1.trips': [{ id: 'web', savedAt: '2026-10-24', plan: simplePlan('Web') }, simplePlan('Legacy'), null, {}] });
  assert.deepEqual(entries.map(x => x.plan.title), ['Web', 'Legacy']);
});
await test('保存只合并行程，保留其他设备数据和原攻略，重复同步不重复收藏', () => {
  const remote = { 'tripmate.v1.draft': simplePlan('旧攻略'), 'tripmate.v1.orders': [{ id: '订单A' }], 'tripmate.v1.preferences': { quiet: true } };
  const operation = { kind: 'open', plan: simplePlan('新攻略'), id: 'op', savedAt: 'today' };
  const merged = domain.applyPlanOperation(remote, operation);
  assert.deepEqual(merged['tripmate.v1.orders'], remote['tripmate.v1.orders']);
  assert.equal(merged['tripmate.v1.preferences'].quiet, true);
  assert.equal(domain.savedTrips(merged)[0].plan.title, '旧攻略');
  assert.equal(domain.savedTrips(domain.applyPlanOperation(merged, operation)).length, 1);
});
await test('未知价格不当免费，网址不接受脚本或带密码链接', () => {
  assert.equal(domain.formatMoney(undefined), '待核实');
  assert.equal(domain.formatMoney(0), '¥0');
  assert.equal(domain.safeWebUrl('javascript:alert(1)'), '');
  assert.equal(domain.safeWebUrl('https://user:secret@example.test/'), '');
  assert.equal(domain.safeWebUrl('http://dpurl.cn/product'), 'http://dpurl.cn/product');
});

await test('请求头 ASCII、失败 JSON 检查、网络超时退出且不自动重试生成', async () => {
  const apiLoad = loader({ 'expo-constants': { default: { expoConfig: { extra: { apiBaseUrl: 'https://tripmate.test' } } }, __esModule: true } });
  const { api, ApiError } = apiLoad('src/api.ts');
  const previousFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (_url, options) => { calls++; assert.match(options.headers['x-tripmate-device'], /^[\x20-\x7E]+$/); return { ok: true, status: 200, text: async () => '{"ok":true}' }; };
    assert.equal((await api('/api/health')).ok, true);
    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => '<html>bad gateway</html>' });
    await assert.rejects(api('/api/health'), caught => caught instanceof ApiError && caught.status === 502);
    calls = 0;
    globalThis.fetch = (_url, options) => { calls++; return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))); };
    await assert.rejects(api('/api/plan', { method: 'POST', timeoutMs: 10 }), /超时/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = previousFetch; }
});

await test('断网保留登录；401 才清理登录；缓存用户须与凭证匹配', async () => {
  const storage = new Map([['tripmate.native.session', 'token-a'], ['tripmate.native.user', JSON.stringify({ token: 'token-a', user: { id: 'A', name: 'Alice', role: 'user' } })]]);
  let status = 0;
  class FakeError extends Error { constructor(code) { super('offline'); this.status = code; } }
  const secure = { getItemAsync: async key => storage.get(key) || null, setItemAsync: async (key, value) => storage.set(key, value), deleteItemAsync: async key => storage.delete(key) };
  const authLoad = loader({ 'expo-secure-store': secure, [resolve(root, 'src/api.ts')]: { api: async () => { throw new FakeError(status); }, ApiError: FakeError } });
  const { AuthProvider, useAuth } = authLoad('src/auth/AuthContext.tsx');
  let current, renderer;
  function Probe() { current = useAuth(); return null; }
  await act(async () => { renderer = TestRenderer.create(React.createElement(AuthProvider, null, React.createElement(Probe))); });
  assert.equal(current.user.id, 'A'); assert.equal(storage.get('tripmate.native.session'), 'token-a');
  status = 401;
  await act(async () => { await current.refresh(); });
  assert.equal(current.user, null); assert.equal(storage.has('tripmate.native.session'), false);
  await act(async () => renderer.unmount());
  storage.set('tripmate.native.session', 'token-b');
  storage.set('tripmate.native.user', JSON.stringify({ token: 'token-a', user: { id: 'A' } }));
  status = 0;
  await act(async () => { renderer = TestRenderer.create(React.createElement(AuthProvider, null, React.createElement(Probe))); });
  assert.equal(current.user, null); assert.equal(storage.get('tripmate.native.session'), 'token-b');
  await act(async () => renderer.unmount());
});

await test('同步遇到409重新合并；断网生成保留本机，恢复后可同步', async () => {
  let remote = { 'tripmate.v1.draft': simplePlan('旧行程'), 'tripmate.v1.orders': [{ id: '订单原值' }] };
  let version = 1, conflict = true, offline = false, writes = 0;
  const cache = new Map();
  const auth = { user: { id: 'A' }, token: 'a', guest: null, guestToken: null };
  class FakeError extends Error { constructor(code) { super('network failure'); this.status = code; } }
  const api = async (path, options = {}) => {
    if (path === '/api/plan') return simplePlan(offline ? '断网前完成的攻略' : '新攻略');
    if (offline) throw new FakeError(0);
    if (options.method !== 'PUT') return { state: structuredClone(remote), stateVersion: version };
    if (conflict) { conflict = false; remote['tripmate.v1.orders'].push({ id: '其他设备订单' }); version++; throw new FakeError(409); }
    const body = JSON.parse(options.body); assert.equal(body.stateVersion, version);
    remote = body.state; writes++; return { stateVersion: ++version };
  };
  const contextLoad = loader({ [resolve(root, 'src/api.ts')]: { api, ApiError: FakeError, errorMessage: error => error.message }, [resolve(root, 'src/auth/AuthContext.tsx')]: { useAuth: () => auth },
    [resolve(root, 'src/plan/offline.ts')]: { readOffline: id => cache.get(id), writeOffline: value => { cache.set(value.owner, structuredClone(value)); return true; } } });
  const { PlanProvider, usePlan } = contextLoad('src/plan/PlanContext.tsx');
  let current, renderer;
  function Probe() { current = usePlan(); return null; }
  await act(async () => { renderer = TestRenderer.create(React.createElement(PlanProvider, null, React.createElement(Probe))); });
  await act(async () => { await current.generate('杭州三天'); });
  assert.equal(current.plan.title, '新攻略'); assert.equal(current.pendingCount, 0);
  assert.equal(remote['tripmate.v1.orders'].length, 2); assert.equal(writes, 1);
  assert.equal(cache.get('A').owner, 'A'); assert.equal(cache.has('B'), false);
  offline = true;
  await act(async () => { await current.generate('新需求'); });
  assert.equal(current.plan.title, '断网前完成的攻略'); assert.equal(current.pendingCount, 1);
  assert.equal(cache.get('A').pending.length, 1);
  offline = false;
  await act(async () => { await current.refresh(); });
  assert.equal(current.pendingCount, 0); assert.equal(remote['tripmate.v1.draft'].title, '断网前完成的攻略');
  await act(async () => renderer.unmount());
});

await test('首页、详情、收藏组件可渲染，切换日期和打开历史攻略可交互', async () => {
  let selected = 1, opened = null;
  const plan = simplePlan('杭州亲子游');
  const value = { plan, dayIndex: selected, loading: false, saving: false, offline: false, syncMessage: '', pendingCount: 0,
    state: { 'tripmate.v1.trips': [{ id: 'web-id', plan: simplePlan('北京游', '北京') }] },
    selectDay: index => { selected = index; }, refresh: async () => {}, savePlan: async () => {}, openPlan: async item => { opened = item; } };
  const screenLoad = loader({ [resolve(root, 'src/plan/PlanContext.tsx')]: { usePlan: () => value }, [resolve(root, 'src/auth/AuthContext.tsx')]: { useAuth: () => ({ user: { id: 'A' } }) } });
  const { TodayScreen } = screenLoad('src/screens/TodayScreen.tsx');
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(TodayScreen)); });
  assert.match(visibleText(renderer), /灵隐寺/);
  await act(async () => renderer.root.findByProps({ accessibilityLabel: '查看前一天行程', accessibilityRole: 'button' }).props.onPress());
  assert.equal(selected, 0);
  await act(async () => renderer.unmount());
  const { TripsScreen } = screenLoad('src/screens/TripsScreen.tsx');
  await act(async () => { renderer = TestRenderer.create(React.createElement(TripsScreen)); });
  await act(async () => { await renderer.root.findByProps({ accessibilityLabel: '打开北京游', accessibilityRole: 'button' }).props.onPress(); });
  assert.equal(opened.title, '北京游');
  await act(async () => renderer.unmount());
  const { TripDetailScreen } = screenLoad('src/screens/TripDetailScreen.tsx');
  await act(async () => { renderer = TestRenderer.create(React.createElement(TripDetailScreen, { navigation: { navigate: noOp } })); });
  assert.match(visibleText(renderer), /灵隐寺/);
  await act(async () => renderer.root.findAllByProps({ accessibilityRole: 'tab' })[3].props.onPress());
  assert.match(visibleText(renderer), /5,000/);
  await act(async () => renderer.unmount());
});
await test('自动导航使用选中日期及最新进度，切换高德和退出后释放迟到监听', async () => {
  const value = { plan: simplePlan('导航测试'), dayIndex: 1, offline: false, pendingCount: 0 };
  let watchCallback, resolveWatcher, removed = 0, opened = '', requests = [];
  let onAppStateChange;
  const appState = { currentState: 'active', addEventListener: (_event, callback) => { onAppStateChange = callback; return { remove: noOp }; } };
  const location = {
    PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' }, Accuracy: { Balanced: 3 },
    hasServicesEnabledAsync: async () => true,
    getForegroundPermissionsAsync: async () => ({ status: 'granted', canAskAgain: true }),
    getCurrentPositionAsync: async () => ({ coords: { latitude: 30.25, longitude: 120.15, accuracy: 30 } }),
    watchPositionAsync: (_options, callback) => { watchCallback = callback; return new Promise(resolve => { resolveWatcher = resolve; }); },
  };
  const api = async (_path, options) => {
    requests.push(JSON.parse(options.body));
    return { completed: false, reachedIndex: requests.length - 1, totalStops: 2, routeMode: 'walk', nextStop: { name: '灵隐寺' }, distance: 1000, duration: 900,
      nativeNavigationUrl: 'androidamap://route?dlat=30.25&dlon=120.15&dname=灵隐寺' };
  };
  const navLoad = loader({
    'react-native': { ...native, AppState: appState },
    '@react-navigation/native': { useFocusEffect: callback => React.useEffect(callback, [callback]) },
    'expo-location': location, 'expo-linking': { openURL: async url => { opened = url; } },
    [resolve(root, 'src/plan/PlanContext.tsx')]: { usePlan: () => value },
    [resolve(root, 'src/auth/AuthContext.tsx')]: { useAuth: () => ({ token: 'A' }) },
    [resolve(root, 'src/api.ts')]: { api, ApiError: Error },
  });
  const { LiveNavigationScreen } = navLoad('src/screens/LiveNavigationScreen.tsx');
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(LiveNavigationScreen, { navigation: { goBack: noOp } })); });
  await act(async () => { await renderer.root.findByProps({ accessibilityLabel: '开始地图导航' }).props.onPress(); });
  assert.equal(requests[0].stops[0].name, '灵隐寺');
  assert.match(opened, /OnFootNavi/);
  const originalNow = Date.now;
  Date.now = () => originalNow() + 30_000;
  try { await act(async () => { watchCallback({ coords: { latitude: 30.26, longitude: 120.16, accuracy: 20 } }); }); }
  finally { Date.now = originalNow; }
  assert.equal(requests[1].completedIndex, 0);
  const originalWatcher = resolveWatcher;
  await act(async () => { appState.currentState = 'background'; onAppStateChange('background'); });
  await act(async () => { appState.currentState = 'active'; onAppStateChange('active'); });
  await act(async () => { originalWatcher({ remove: () => removed++ }); });
  assert.equal(removed, 1);
  await act(async () => renderer.unmount());
  await act(async () => { resolveWatcher({ remove: () => removed++ }); });
  assert.equal(removed, 2);
});

await test('先展示价格再生成，修改需求后报价失效', async () => {
  let estimates = 0, generations = 0;
  const value = { offline: false, pendingCount: 0, estimate: async () => { estimates++; return { cost: 3, balance: 10, enough: true }; }, generate: async () => { generations++; return simplePlan('测试'); } };
  const screenLoad = loader({ [resolve(root, 'src/plan/PlanContext.tsx')]: { usePlan: () => value }, [resolve(root, 'src/api.ts')]: { ApiError: Error } });
  const { PlanScreen } = screenLoad('src/screens/PlanScreen.tsx');
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(PlanScreen, { navigation: { navigate: noOp } })); });
  await act(async () => { await renderer.root.findByProps({ accessibilityLabel: '先评估本次额度' }).props.onPress(); });
  assert.equal(estimates, 1); assert.equal(generations, 0);
  await act(async () => { await renderer.root.findByProps({ accessibilityLabel: '确认并生成 · 3 点' }).props.onPress(); });
  assert.equal(generations, 1);
  await act(async () => { renderer.root.findByType('TextInput').props.onChangeText('换个目的地，带爸妈到北京玩三天'); });
  assert.equal(renderer.root.findByProps({ accessibilityLabel: '先评估本次额度' }).props.disabled, false);
  await act(async () => renderer.unmount());
});
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function authHarness(storage, api, secureOverrides = {}) {
  class AuthError extends Error { constructor(status) { super('auth failure'); this.status = status; } }
  const secure = { getItemAsync: async key => storage.get(key) || null, setItemAsync: async (key, value) => storage.set(key, value), deleteItemAsync: async key => storage.delete(key), ...secureOverrides };
  const authLoad = loader({ 'expo-secure-store': secure, [resolve(root, 'src/api.ts')]: { api: (...args) => api(AuthError, ...args), ApiError: AuthError } });
  const { AuthProvider, useAuth } = authLoad('src/auth/AuthContext.tsx');
  let current, renderer;
  function Probe() { current = useAuth(); return null; }
  return {
    get current() { return current; },
    async mount() { await act(async () => { renderer = TestRenderer.create(React.createElement(AuthProvider, null, React.createElement(Probe))); }); },
    async unmount() { await act(async () => renderer.unmount()); },
  };
}
await test('账号A的迟到验证成功或401均不能覆盖账号B的新登录', async () => {
  for (const lateStatus of ['success', '401']) {
    const storage = new Map([['tripmate.native.session', 'token-a']]);
    const late = deferred();
    let checks = 0;
    const harness = authHarness(storage, async (AuthError, path) => {
      if (path === '/api/auth/me') { if (++checks === 1) throw new AuthError(0); const result = await late.promise; if (result === '401') throw new AuthError(401); return { user: { id: 'A' } }; }
      if (path === '/api/auth/login') return { token: 'token-b', user: { id: 'B', name: 'Bob' } };
      throw new Error(`Unexpected endpoint ${path}`);
    });
    await harness.mount();
    let verification;
    await act(async () => { verification = harness.current.refresh(); });
    await act(async () => { await harness.current.login('b@example.test', 'test-password'); });
    await act(async () => { late.resolve(lateStatus); await verification; });
    assert.equal(harness.current.user.id, 'B');
    assert.equal(storage.get('tripmate.native.session'), 'token-b');
    assert.equal(JSON.parse(storage.get('tripmate.native.user')).user.id, 'B');
    await harness.unmount();
  }
});
await test('退出后晚到的登录响应不能恢复账号', async () => {
  const storage = new Map();
  const late = deferred();
  const harness = authHarness(storage, async (_AuthError, path) => path === '/api/auth/login' ? late.promise : {});
  await harness.mount();
  let signIn;
  await act(async () => { signIn = harness.current.login('a@example.test', 'test-password'); });
  await act(async () => { await harness.current.logout(); });
  await act(async () => { late.resolve({ token: 'token-a', user: { id: 'A' } }); await signIn; });
  assert.equal(harness.current.user, null); assert.equal(harness.current.token, null);
  assert.equal(storage.has('tripmate.native.session'), false);
  await harness.unmount();
});
await test('慢安全存储写入不会把新账号凭证换成旧账号', async () => {
  const storage = new Map();
  const blocked = deferred();
  const started = deferred();
  const harness = authHarness(storage, async (_AuthError, path, options) => {
    const { email } = JSON.parse(options.body);
    return { token: email.startsWith('a') ? 'token-a' : 'token-b', user: { id: email.startsWith('a') ? 'A' : 'B' } };
  }, { setItemAsync: async (key, value) => {
    if (key === 'tripmate.native.session' && value === 'token-a') { started.resolve(); await blocked.promise; }
    storage.set(key, value);
  } });
  await harness.mount();
  let signInA, signInB;
  await act(async () => { signInA = harness.current.login('a@example.test', 'test-password'); await started.promise; });
  await act(async () => { signInB = harness.current.login('b@example.test', 'test-password'); });
  await act(async () => { blocked.resolve(); await Promise.all([signInA, signInB]); });
  assert.equal(harness.current.user.id, 'B'); assert.equal(harness.current.token, 'token-b');
  assert.equal(storage.get('tripmate.native.session'), 'token-b');
  assert.equal(JSON.parse(storage.get('tripmate.native.user')).user.id, 'B');
  await harness.unmount();
});
await test('单个存储键失败时仍等待同批慢写入，不污染后续账号', async () => {
  const storage = new Map();
  const blocked = deferred(), started = deferred();
  const harness = authHarness(storage, async (_AuthError, _path, options) => {
    const id = JSON.parse(options.body).email.startsWith('a') ? 'A' : 'B';
    return { token: `token-${id.toLowerCase()}`, user: { id } };
  }, { setItemAsync: async (key, value) => {
    if (key === 'tripmate.native.session' && value === 'token-a') { started.resolve(); await blocked.promise; }
    if (key === 'tripmate.native.user' && JSON.parse(value).user.id === 'A') throw new Error('Simulated key failure');
    storage.set(key, value);
  } });
  await harness.mount();
  let first, second;
  await act(async () => { first = harness.current.login('a@example.test', 'test-password').catch(noOp); await started.promise; });
  await act(async () => { second = harness.current.login('b@example.test', 'test-password'); });
  await act(async () => { blocked.resolve(); await Promise.all([first, second]); });
  assert.equal(harness.current.user.id, 'B'); assert.equal(storage.get('tripmate.native.session'), 'token-b');
  assert.equal(JSON.parse(storage.get('tripmate.native.user')).user.id, 'B');
  await harness.unmount();
});
await test('认证组件卸载后的旧登录响应不写入本机凭证', async () => {
  const storage = new Map();
  const late = deferred();
  const harness = authHarness(storage, async () => late.promise);
  await harness.mount();
  let signIn;
  await act(async () => { signIn = harness.current.login('a@example.test', 'test-password'); });
  await harness.unmount();
  await act(async () => { late.resolve({ token: 'token-a', user: { id: 'A' } }); await signIn; });
  assert.equal(storage.size, 0);
});
function offlineHarness() {
  const disk = new Map();
  let failure = '';
  class Directory {
    constructor(parent, name) { this.uri = `${parent}/${name}`; }
    create() {}
  }
  class File {
    constructor(directory, name) { this.uri = `${directory.uri}/${name}`; }
    get exists() { return disk.has(this.uri); }
    create() { disk.set(this.uri, ''); }
    textSync() { if (!this.exists) throw new Error('No file'); return disk.get(this.uri); }
    writeSync(value) {
      disk.set(this.uri, failure ? value.slice(0, 12) : value);
      if (failure === 'throw') throw new Error('Disk full');
    }
    delete() { disk.delete(this.uri); }
  }
  const offline = loader({ 'expo-file-system': { Directory, File, Paths: { document: 'private' } } })('src/plan/offline.ts');
  return { offline, disk, fail(mode) { failure = mode; } };
}
const offlineSnapshot = (title, owner = 'A') => ({ owner, state: { 'tripmate.v1.draft': simplePlan(title) }, version: 7, pending: [], savedAt: '2026-10-30T10:00:00.000Z' });
await test('磁盘空间不足、写入中断后仍能读取上一份完整攻略', () => {
  const harness = offlineHarness();
  assert.equal(harness.offline.writeOffline(offlineSnapshot('原攻略')), true);
  harness.fail('throw');
  assert.equal(harness.offline.writeOffline(offlineSnapshot('新攻略')), false);
  assert.equal(harness.offline.readOffline('A')?.state['tripmate.v1.draft'].title, '原攻略');
});
await test('文件系统未抛错但只写入部分内容时，不误报离线保存成功', () => {
  const harness = offlineHarness();
  assert.equal(harness.offline.writeOffline(offlineSnapshot('原攻略')), true);
  harness.fail('short');
  assert.equal(harness.offline.writeOffline(offlineSnapshot('未写完整的新攻略')), false);
  assert.equal(harness.offline.readOffline('A')?.state['tripmate.v1.draft'].title, '原攻略');
});
await test('兼容单文件旧副本；同版本连续保存及最新文件损坏时正确恢复', () => {
  const harness = offlineHarness();
  harness.disk.set('private/tripmate-offline/A.json', JSON.stringify(offlineSnapshot('旧格式')));
  assert.equal(harness.offline.readOffline('A').state['tripmate.v1.draft'].title, '旧格式');
  assert.equal(harness.offline.writeOffline(offlineSnapshot('第二份')), true);
  const next = offlineSnapshot('第三份');
  next.savedAt = '2020-01-01T00:00:00.000Z'; // Device clock moving back must not choose an older write.
  next.pending = [{ kind: 'open', plan: simplePlan('未同步'), id: 'pending-1', savedAt: next.savedAt }];
  assert.equal(harness.offline.writeOffline(next), true);
  assert.equal(harness.offline.readOffline('A').state['tripmate.v1.draft'].title, '第三份');
  assert.equal(harness.offline.readOffline('A').pending[0].id, 'pending-1');
  const [latestPath] = [...harness.disk.entries()].find(([, text]) => text.includes('第三份'));
  harness.disk.set(latestPath, '{broken');
  assert.equal(harness.offline.readOffline('A').state['tripmate.v1.draft'].title, '第二份');
  assert.equal(harness.offline.writeOffline(offlineSnapshot('恢复后的新攻略')), true);
  assert.equal(harness.offline.readOffline('A').state['tripmate.v1.draft'].title, '恢复后的新攻略');
});
await test('双副本按账号隔离，删除指定账号副本不会影响另一账号', () => {
  const harness = offlineHarness();
  harness.offline.writeOffline(offlineSnapshot('A攻略'));
  harness.offline.writeOffline(offlineSnapshot('A新攻略'));
  harness.offline.writeOffline(offlineSnapshot('B攻略', 'B'));
  assert.equal(harness.offline.readOffline('B').state['tripmate.v1.draft'].title, 'B攻略');
  assert.equal(harness.offline.readOffline('C'), null);
  harness.offline.clearOffline('A');
  assert.equal(harness.offline.readOffline('A'), null);
  assert.equal(harness.offline.readOffline('B').state['tripmate.v1.draft'].title, 'B攻略');
});
await test('离线写入失败的界面提示持续显示，真正写入成功后才清除', async () => {
  let writable = false;
  const auth = { user: { id: 'A' }, token: 'token-a', guest: null, guestToken: null };
  const contextLoad = loader({
    [resolve(root, 'src/auth/AuthContext.tsx')]: { useAuth: () => auth },
    [resolve(root, 'src/api.ts')]: { api: async () => ({ state: { 'tripmate.v1.draft': simplePlan('已同步') }, stateVersion: 3 }), ApiError: Error, errorMessage: error => error.message },
    [resolve(root, 'src/plan/offline.ts')]: { readOffline: () => null, writeOffline: () => writable },
  });
  const { PlanProvider, usePlan } = contextLoad('src/plan/PlanContext.tsx');
  const { SyncNotice } = contextLoad('src/components/TripControls.tsx');
  let current, renderer;
  function Probe() { current = usePlan(); return React.createElement(SyncNotice); }
  await act(async () => { renderer = TestRenderer.create(React.createElement(PlanProvider, null, React.createElement(Probe))); });
  assert.equal(current.offline, false);
  assert.match(current.syncMessage, /离线保存未完成/);
  assert.match(visibleText(renderer), /联网同步后再退出/);
  writable = true;
  await act(async () => { await current.refresh(); });
  assert.equal(current.syncMessage, '');
  assert.equal(renderer.toJSON(), null);
  await act(async () => renderer.unmount());
});
await test('每日安排及预算相同但酒店、餐厅、交通或提醒改变时，收藏保留两个版本', () => {
  const original = { ...simplePlan('杭州三天'), advice: '原提醒', transportLegs: [{ from: '机场', to: '酒店', booking: '原购票说明' }], recommendations: { hotels: [{ name: '原酒店', sourceUrl: 'https://hotel.example/old' }], restaurants: [{ name: '原餐厅' }] } };
  for (const patch of [
    { advice: '更新后的预约提醒' },
    { transportLegs: [{ from: '机场', to: '酒店', booking: '新的购票说明' }] },
    { recommendations: { ...original.recommendations, hotels: [{ name: '新酒店', sourceUrl: 'https://hotel.example/new' }] } },
    { recommendations: { ...original.recommendations, restaurants: [{ name: '新餐厅' }] } },
  ]) {
    const first = domain.applyPlanOperation({}, { kind: 'save', plan: original, id: 'first', savedAt: 'before' });
    const changed = { ...original, ...patch };
    const after = domain.applyPlanOperation(first, { kind: 'save', plan: changed, id: 'second', savedAt: 'after' });
    const archives = domain.savedTrips(after);
    assert.equal(archives.length, 2);
    assert.deepEqual(archives[0].plan, changed);
    assert.deepEqual(archives[1].plan, original);
  }
});
await test('仅推荐详情不同的攻略切换时，原稿和其他账号字段完整保留', () => {
  const original = { ...simplePlan('同一旅行'), recommendations: { hotels: [{ name: '原酒店', sourceUrl: 'https://hotel.example/original' }] } };
  const changed = { ...original, recommendations: { hotels: [{ name: '新酒店', sourceUrl: 'https://hotel.example/updated' }] } };
  const before = { 'tripmate.v1.draft': original, 'tripmate.v1.orders': [{ id: 'keep-order' }], 'tripmate.v1.preferences': { walking: 'low' } };
  const after = domain.applyPlanOperation(before, { kind: 'open', plan: changed, id: 'open-details', savedAt: 'today' });
  assert.deepEqual(after['tripmate.v1.draft'], changed);
  assert.deepEqual(domain.savedTrips(after)[0].plan, original);
  assert.deepEqual(after['tripmate.v1.orders'], before['tripmate.v1.orders']);
  assert.deepEqual(after['tripmate.v1.preferences'], before['tripmate.v1.preferences']);
});
await test('字段顺序或计费余额变化不重复收藏，未知的行程内容字段也会保留', () => {
  const first = { ...simplePlan('不重复'), advice: '同一提醒', billing: { cost: 3, balance: 10 }, futureTripNotes: { text: '原备注' } };
  const reordered = { ...Object.fromEntries(Object.entries(first).reverse()),
    days: first.days.map(day => Object.fromEntries(Object.entries(day).reverse())), billing: { cost: 3, balance: 99 } };
  assert.equal(domain.planKey(first), domain.planKey(reordered));
  const operation = { kind: 'save', plan: first, id: 'stable', savedAt: 'today' };
  const initial = domain.applyPlanOperation({}, operation);
  assert.equal(domain.savedTrips(domain.applyPlanOperation(initial, { ...operation, plan: reordered })).length, 1);
  const changed = { ...first, futureTripNotes: { text: '新的有效备注' } };
  assert.notEqual(domain.planKey(first), domain.planKey(changed));
  const next = domain.applyPlanOperation(initial, { ...operation, id: 'changed', plan: changed });
  assert.equal(domain.savedTrips(next).length, 2);
});
await test('同名但推荐不同的旧收藏仍可从界面打开', async () => {
  const original = { ...simplePlan('同名攻略'), advice: '旧版提醒' };
  const changed = { ...original, advice: '新版提醒' };
  let opened = null, renderer;
  const value = { plan: changed, state: { 'tripmate.v1.trips': [{ id: 'old-copy', plan: original }] }, loading: false, saving: false,
    offline: false, syncMessage: '', pendingCount: 0, refresh: async () => {}, openPlan: async target => { opened = target; } };
  const screenLoad = loader({ [resolve(root, 'src/plan/PlanContext.tsx')]: { usePlan: () => value } });
  const { TripsScreen } = screenLoad('src/screens/TripsScreen.tsx');
  await act(async () => { renderer = TestRenderer.create(React.createElement(TripsScreen)); });
  const actions = renderer.root.findAllByProps({ accessibilityLabel: '打开同名攻略', accessibilityRole: 'button' });
  assert.equal(actions.length, 2);
  await act(async () => { await actions[1].props.onPress(); });
  assert.equal(opened.advice, '旧版提醒');
  await act(async () => renderer.unmount());
});
await test('推荐和提醒更新不重置手选日期，日程真正改变时重新判断日期', async () => {
  let remote = { ...simplePlan('保持当天'), advice: '原提醒' };
  remote.days = remote.days.map((day, index) => ({ ...day, date: `2099-01-0${index + 1}` }));
  const auth = { user: { id: 'A' }, token: 'a', guest: null, guestToken: null };
  const contextLoad = loader({ [resolve(root, 'src/auth/AuthContext.tsx')]: { useAuth: () => auth },
    [resolve(root, 'src/api.ts')]: { api: async () => ({ state: { 'tripmate.v1.draft': structuredClone(remote) }, stateVersion: 1 }), ApiError: Error, errorMessage: error => error.message },
    [resolve(root, 'src/plan/offline.ts')]: { readOffline: () => null, writeOffline: () => true } });
  const { PlanProvider, usePlan } = contextLoad('src/plan/PlanContext.tsx');
  let current, renderer;
  function Probe() { current = usePlan(); return null; }
  await act(async () => { renderer = TestRenderer.create(React.createElement(PlanProvider, null, React.createElement(Probe))); });
  await act(async () => { current.selectDay(1); });
  const previousSchedule = domain.scheduleKey(remote);
  remote = { ...remote, advice: '更新提醒', recommendations: { hotels: [{ name: '新酒店' }] } };
  assert.equal(domain.scheduleKey(remote), previousSchedule);
  await act(async () => { await current.refresh(); });
  assert.equal(current.dayIndex, 1);
  remote.days[0].events = [{ name: '改为新目的地' }];
  assert.notEqual(domain.scheduleKey(remote), previousSchedule);
  await act(async () => { await current.refresh(); });
  assert.equal(current.dayIndex, 0);
  await act(async () => renderer.unmount());
});
await test('同步接口返回不完整对象时，不把本机攻略与离线副本替换为空', async () => {
  const original = simplePlan('应当保留的攻略');
  let cached = { owner: 'A', state: { 'tripmate.v1.draft': original, 'tripmate.v1.orders': [{ id: 'order-a' }] }, version: 7, pending: [], savedAt: '2026-11-01T00:00:00Z' };
  const auth = { user: { id: 'A' }, token: 'token-a', guest: null, guestToken: null };
  let response = {}, puts = 0;
  const contextLoad = loader({ [resolve(root, 'src/auth/AuthContext.tsx')]: { useAuth: () => auth },
    [resolve(root, 'src/api.ts')]: { api: async (_path, options = {}) => { if (options.method === 'PUT') puts++; return response; }, ApiError: Error, errorMessage: error => error.message },
    [resolve(root, 'src/plan/offline.ts')]: { readOffline: owner => owner === 'A' ? cached : null, writeOffline: value => { cached = structuredClone(value); return true; } } });
  const { PlanProvider, usePlan } = contextLoad('src/plan/PlanContext.tsx');
  const { SyncNotice } = contextLoad('src/components/TripControls.tsx');
  let current, renderer;
  function Probe() { current = usePlan(); return React.createElement(SyncNotice); }
  await act(async () => { renderer = TestRenderer.create(React.createElement(PlanProvider, null, React.createElement(Probe))); });
  assert.equal(current.plan?.title, original.title);
  assert.equal(cached.state['tripmate.v1.draft'].title, original.title);
  assert.equal(current.offline, true); assert.equal(puts, 0);
  assert.match(visibleText(renderer), /同步|数据/);
  response = { state: { 'tripmate.v1.draft': simplePlan('恢复网络后的攻略') }, stateVersion: 8 };
  await act(async () => { await current.refresh(); });
  assert.equal(current.plan.title, '恢复网络后的攻略'); assert.equal(current.offline, false);
  await act(async () => renderer.unmount());
});
await test('同步数据与版本号校验允许真正的空账号，拒绝缺失、数组和非法版本', () => {
  assert.deepEqual(domain.decodeAccountSnapshot({ state: {}, stateVersion: 0 }), { state: {}, stateVersion: 0 });
  for (const bad of [null, [], {}, { stateVersion: 3 }, { state: [], stateVersion: 3 }, { state: null, stateVersion: 3 },
    { state: {}, stateVersion: '3' }, { state: {}, stateVersion: -1 }, { state: {}, stateVersion: 1.5 }, { state: {}, stateVersion: NaN }, { state: {}, stateVersion: Number.MAX_SAFE_INTEGER + 1 }, { ok: false, state: {}, stateVersion: 3 }]) {
    assert.throws(() => domain.decodeAccountSnapshot(bad), /同步数据不完整/);
  }
  assert.equal(domain.decodeWriteReceipt({ ok: true, stateVersion: 4 }, 3), 4);
  for (const bad of [null, [], {}, { stateVersion: '4' }, { stateVersion: 3 }, { stateVersion: 5 }, { stateVersion: 4.5 }, { ok: false, stateVersion: 4 }]) {
    assert.throws(() => domain.decodeWriteReceipt(bad, 3), /未确认保存版本/);
  }
});
await test('保存确认缺版本号时保留待同步更改，恢复后合并重试且不重复收藏', async () => {
  const auth = { user: { id: 'A' }, token: 'a', guest: null, guestToken: null };
  let remote = { 'tripmate.v1.draft': simplePlan('旧稿'), 'tripmate.v1.orders': [{ id: 'kept' }] };
  let version = 4, receiptsValid = false, cached = null;
  const contextLoad = loader({ [resolve(root, 'src/auth/AuthContext.tsx')]: { useAuth: () => auth },
    [resolve(root, 'src/api.ts')]: { api: async (_path, options = {}) => {
      if (options.method !== 'PUT') return { state: structuredClone(remote), stateVersion: version };
      const body = JSON.parse(options.body); assert.equal(body.stateVersion, version);
      remote = body.state; version++;
      return receiptsValid ? { ok: true, stateVersion: version } : { ok: true };
    }, ApiError: Error, errorMessage: error => error.message },
    [resolve(root, 'src/plan/offline.ts')]: { readOffline: () => null, writeOffline: value => { cached = structuredClone(value); return true; } } });
  const { PlanProvider, usePlan } = contextLoad('src/plan/PlanContext.tsx');
  let current, renderer;
  function Probe() { current = usePlan(); return null; }
  await act(async () => { renderer = TestRenderer.create(React.createElement(PlanProvider, null, React.createElement(Probe))); });
  await act(async () => { await current.openPlan(simplePlan('新稿')); });
  assert.equal(current.plan.title, '新稿'); assert.equal(current.pendingCount, 1);
  assert.equal(cached.pending.length, 1); assert.equal(current.offline, true);
  assert.equal(cached.owner, 'A');
  receiptsValid = true;
  await act(async () => { await current.refresh(); });
  assert.equal(current.pendingCount, 0); assert.equal(current.offline, false);
  assert.equal(domain.savedTrips(current.state).length, 1);
  assert.equal(remote['tripmate.v1.orders'][0].id, 'kept');
  await act(async () => renderer.unmount());
});
await test('冲突后的重新读取若损坏，停止写入；恢复后保留另一设备的新订单', async () => {
  const auth = { user: { id: 'A' }, token: 'a', guest: null, guestToken: null };
  let remote = { 'tripmate.v1.draft': simplePlan('原行程'), 'tripmate.v1.orders': [{ id: 'old-order' }] };
  let version = 5, conflict = true, reads = 0, puts = 0, corrupted = true;
  class Conflict extends Error { constructor() { super('conflict'); this.status = 409; } }
  const contextLoad = loader({ [resolve(root, 'src/auth/AuthContext.tsx')]: { useAuth: () => auth },
    [resolve(root, 'src/api.ts')]: { api: async (_path, options = {}) => {
      if (options.method !== 'PUT') { reads++; return corrupted && reads >= 3 ? {} : { state: structuredClone(remote), stateVersion: version }; }
      puts++;
      if (conflict) { conflict = false; remote['tripmate.v1.orders'].push({ id: 'other-device-order' }); version++; throw new Conflict(); }
      const body = JSON.parse(options.body); assert.equal(body.stateVersion, version);
      remote = body.state; return { stateVersion: ++version };
    }, ApiError: Conflict, errorMessage: error => error.message },
    [resolve(root, 'src/plan/offline.ts')]: { readOffline: () => null, writeOffline: () => true } });
  const { PlanProvider, usePlan } = contextLoad('src/plan/PlanContext.tsx');
  let current, renderer;
  function Probe() { current = usePlan(); return null; }
  await act(async () => { renderer = TestRenderer.create(React.createElement(PlanProvider, null, React.createElement(Probe))); });
  await act(async () => { await current.openPlan(simplePlan('本机新攻略')); });
  assert.equal(puts, 1); assert.equal(current.pendingCount, 1); assert.equal(current.plan.title, '本机新攻略');
  assert.equal(remote['tripmate.v1.draft'].title, '原行程');
  corrupted = false;
  await act(async () => { await current.refresh(); });
  assert.equal(puts, 2); assert.equal(current.pendingCount, 0);
  assert.equal(current.state['tripmate.v1.orders'].length, 2);
  await act(async () => renderer.unmount());
});
console.log(`通过 ${passed} 组行为回归。组件测试使用 React Native 桩；未替代安卓真机定位及地图唤起测试。`);
