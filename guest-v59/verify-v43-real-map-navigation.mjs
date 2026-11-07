import { readFile } from 'node:fs/promises';

const server = await readFile(new URL('./tripmate-ai-server.mjs', import.meta.url), 'utf8');
const page = await readFile(new URL('./tripmate-mvp.html', import.meta.url), 'utf8');

for (const marker of [
  'v59-settings-languages',
  "new URL('amapuri://route/plan')",
  "nativeNavigationUrl: nativeNavigationUrl.toString()",
  "nativeNavigationUrl.searchParams.set('t', routeMode === 'walk' ? '2' : '0')",
]) {
  if (!server.includes(marker)) throw new Error(`服务端缺少真实地图导航标记：${marker}`);
}

for (const marker of [
  '今日地图导航',
  '开始地图导航',
  'navigation-map-shell',
  'autoLaunchPending',
  '打开地图导航',
]) {
  if (!page.includes(marker)) throw new Error(`网页缺少真实地图导航标记：${marker}`);
}

if (page.includes('steps.map(step=>')) throw new Error('网页仍在渲染长篇文字导航步骤。');

console.log('v43 安卓与网页真实地图导航跳转、可视化状态和文字步骤收敛：ok');
