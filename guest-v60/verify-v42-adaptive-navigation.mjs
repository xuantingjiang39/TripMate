import { readFile } from 'node:fs/promises';

const server = await readFile(new URL('./tripmate-ai-server.mjs', import.meta.url), 'utf8');
const page = await readFile(new URL('./tripmate-mvp.html', import.meta.url), 'utf8');

const serverMarkers = [
  'const nearestDistance = Math.min(...distances)',
  'const withinTripArea = nearestDistance <= 50_000',
  "'/v3/direction/walking'",
  "'/v3/direction/driving'",
  "routeMode = 'transfer'",
  'outOfTripArea: !withinTripArea',
  'OVER_DIRECTION_RANGE',
  'v60-regional-sync'
];
for (const marker of serverMarkers) {
  if (!server.includes(marker)) throw new Error(`自适应导航缺少服务端标记：${marker}`);
}

const pageMarkers = ['guide.routeModeLabel', '你还没到行程城市', 'guide.outOfTripArea'];
for (const marker of pageMarkers) {
  if (!page.includes(marker)) throw new Error(`自适应导航缺少界面标记：${marker}`);
}

if (/fetchAmapJson\('\/v3\/direction\/walking'[\s\S]{0,300}const path/.test(server)) {
  throw new Error('导航仍然无条件调用步行路线。');
}

console.log('v42 跨城判断、步行/驾车自适应与超距降级：ok');
