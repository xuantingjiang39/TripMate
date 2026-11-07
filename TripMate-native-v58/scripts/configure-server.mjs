import { readFile, writeFile } from 'node:fs/promises';

const value = String(process.argv[2] || '').trim();
let address;
try { address = new URL(value); } catch { console.error('用法：npm run configure -- https://你的TripMate域名'); process.exit(1); }
if (address.protocol !== 'https:' || address.username || address.password || address.search || address.hash) {
  console.error('为了保护登录密码和位置数据，必须使用不带账号、参数或锚点的 HTTPS 地址。');
  process.exit(1);
}
address.pathname = address.pathname.replace(/\/+$/, '') || '/';
const path = new URL('../app.json', import.meta.url);
const config = JSON.parse(await readFile(path, 'utf8'));
config.expo.extra ||= {};
config.expo.extra.apiBaseUrl = address.toString().replace(/\/$/, '');
await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(`TripMate 原生 App 已绑定：${config.expo.extra.apiBaseUrl}`);
console.log('下一步：npm run prebuild:clean，然后用 Android Studio 或 Xcode 打开原生工程。');
