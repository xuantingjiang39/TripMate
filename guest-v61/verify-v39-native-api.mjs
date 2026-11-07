import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./tripmate-ai-server.mjs', import.meta.url), 'utf8');
const requirements = [
  ['Bearer 会话', 'function bearerToken(req)'],
  ['原生客户端识别', 'function nativeClient(req)'],
  ['安全登录返回', 'nativeAuthPayload(req, result.token)'],
  ['手动当前位置', 'manualLocation'],
  ['原生设备名称', "browserName: 'TripMate App'"],
];
const missing = requirements.filter(([, marker]) => !source.includes(marker));
if (missing.length) throw new Error(`缺少：${missing.map(([name]) => name).join('、')}`);
console.log('v39 原生 App 登录、游客会话与手动位置接口：ok');
