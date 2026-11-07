import { access, readFile } from 'node:fs/promises';

const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
const url = String(app?.expo?.extra?.apiBaseUrl || '');
if (!url.startsWith('https://')) throw new Error('服务器必须使用 HTTPS。');
if (/example\.com/i.test(url)) console.warn('提醒：当前仍是示例服务器地址，正式打包前必须运行 npm run configure。');
if (app.expo.orientation === 'portrait') throw new Error('不应通过锁定竖屏逃避横屏和平板适配。');
const plugins = JSON.stringify(app.expo.plugins || []);
if (!plugins.includes('expo-location') || !plugins.includes('locationWhenInUsePermission')) throw new Error('缺少前台定位权限说明。');
if (!plugins.includes('expo-secure-store')) throw new Error('缺少系统安全存储。');
for (const target of ['../src/screens/LiveNavigationScreen.tsx', '../src/auth/AuthContext.tsx', '../src/navigation/RootNavigator.tsx']) await access(new URL(target, import.meta.url));
const live = await readFile(new URL('../src/screens/LiveNavigationScreen.tsx', import.meta.url), 'utf8');
if (!live.includes('requestForegroundPermissionsAsync') || !live.includes('manualLocation')) throw new Error('定位询问或手动位置兜底缺失。');
if (!live.includes('hasServicesEnabledAsync') || !live.includes('getLastKnownPositionAsync') || !live.includes('LOCATION_SOURCE_SETTINGS')) {
  throw new Error('缺少定位开关检查、最近位置兜底或系统设置恢复入口。');
}
const domain = await readFile(new URL('../src/plan/domain.ts', import.meta.url), 'utf8');
const controls = await readFile(new URL('../src/components/TripControls.tsx', import.meta.url), 'utf8');
if (!domain.includes('todayDayIndex') || !controls.includes('selectDay') || !controls.includes('查看后一天行程') || !live.includes('DaySelector')) {
  throw new Error('缺少多日行程的当天匹配或手动切换能力。');
}
const api = await readFile(new URL('../src/api.ts', import.meta.url), 'utf8');
const deviceHeader = api.match(/'x-tripmate-device':\s*Platform\.OS === 'ios' \? '([^']+)' : '([^']+)'/);
if (!deviceHeader || deviceHeader.slice(1).some(value => !/^[\x20-\x7E]+$/.test(value))) {
  throw new Error('x-tripmate-device 请求头必须仅包含 ASCII 字符。');
}
if (!live.includes('androidamap://navi') || !live.includes('OnFootNavi') || !live.includes('geo:0,0?q=')) {
  throw new Error('缺少高德驾车、步行导航或其他手机地图兜底。');
}
console.log('原生界面、多日当天导航、稳健自动定位、安全存储、ASCII 请求头和真实地图导航兜底：ok');
