import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Screen } from '../components/Screen';
import { Field, PrimaryButton, SecondaryButton, StatusPill } from '../components/UI';
import { DaySelector, SyncNotice } from '../components/TripControls';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { usePlan } from '../plan/PlanContext';
import { scheduleKey } from '../plan/domain';
import { usePalette } from '../theme';
import type { NavigationGuide, PlanDay } from '../types';

function timeFromName(name: string) { return name.match(/(?:^|\s)(\d{1,2}[:：]\d{2})/)?.[1]?.replace('：', ':') || ''; }
function stopName(name: string) { return name.replace(/(?:^|\s)\d{1,2}[:：]\d{2}(?:\s|$)/, ' ').trim(); }
function distance(value?: number) { if (value === undefined || !Number.isFinite(value)) return '待计算'; return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} 公里` : `${Math.max(0, Math.round(value))} 米`; }
function duration(value = 0) {
  if (!value) return '到达后计算';
  const minutes = Math.max(1, Math.round(value / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分` : `${minutes} 分钟`;
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function queryValue(url: string | undefined, name: string) {
  const match = String(url || '').match(new RegExp(`[?&]${name}=([^&#]*)`, 'i'));
  if (!match?.[1]) return '';
  try { return decodeURIComponent(match[1].replace(/\+/g, ' ')); } catch { return match[1]; }
}

function mapLinks(target: NavigationGuide) {
  const routeUrl = target.nativeNavigationUrl || '';
  let latitude = queryValue(routeUrl, 'dlat');
  let longitude = queryValue(routeUrl, 'dlon');
  let name = queryValue(routeUrl, 'dname') || target.nextStop?.name || '下一站';
  if ((!latitude || !longitude) && target.navigationUrl) {
    const destination = queryValue(target.navigationUrl, 'to').split(',');
    longitude = destination[0] || longitude;
    latitude = destination[1] || latitude;
    name = destination.slice(2).join(',') || name;
  }
  const hasDestination = /^-?\d+(?:\.\d+)?$/.test(latitude) && /^-?\d+(?:\.\d+)?$/.test(longitude);
  const encodedName = encodeURIComponent(name);
  const directAmap = !hasDestination ? '' : target.routeMode === 'walk'
    ? `amapuri://openFeature?featureName=OnFootNavi&sourceApplication=TripMate&lat=${latitude}&lon=${longitude}&dev=0`
    : target.routeMode === 'car'
      ? `androidamap://navi?sourceApplication=TripMate&poiname=${encodedName}&lat=${latitude}&lon=${longitude}&dev=0&style=2`
      : '';
  const systemMap = hasDestination
    ? `geo:0,0?q=${encodeURIComponent(`${latitude},${longitude}(${name})`)}`
    : '';
  return {
    amap: [directAmap, routeUrl, target.navigationUrl].filter(Boolean) as string[],
    system: [systemMap, target.navigationUrl].filter(Boolean) as string[],
  };
}

export function LiveNavigationScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'LiveNavigation'>) {
  const p = usePalette();
  const { plan, dayIndex } = usePlan();
  const { token, guestToken } = useAuth();
  const days = plan?.days || [];
  const [guide, setGuide] = useState<NavigationGuide | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [settingsTarget, setSettingsTarget] = useState<'permission' | 'services' | null>(null);
  const [manual, setManual] = useState(false);
  const [manualLocation, setManualLocation] = useState('');
  const [completedIndex, setCompletedIndex] = useState(-1);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const watchGeneration = useRef(0);
  const lastFetch = useRef(0);
  const epoch = useRef(0);
  const completedRef = useRef(-1);
  const requestLock = useRef(false);
  const navigationEnabled = useRef(false);
  const resume = useRef<() => void>(() => {});
  const requestLatest = useRef<(input: { latitude: number; longitude: number; accuracy?: number }) => void>(() => {});
  const day: PlanDay | undefined = days[dayIndex] || days[0];
  const planIdentity = plan ? scheduleKey(plan) : '';

  useFocusEffect(useCallback(() => () => {
    navigationEnabled.current = false;
    epoch.current += 1;
    watcher.current?.remove(); watcher.current = null;
    requestLock.current = false; setBusy(false); setLocating(false);
  }, []));
  useEffect(() => {
    navigationEnabled.current = false;
    epoch.current += 1;
    watcher.current?.remove(); watcher.current = null;
    completedRef.current = -1;
    requestLock.current = false;
    setGuide(null); setCompletedIndex(-1); setBusy(false); setLocating(false);
    setManual(false); setManualLocation(''); setError(''); setLocationNote(''); setSettingsTarget(null);
  }, [dayIndex, planIdentity]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { watchGeneration.current += 1; watcher.current?.remove(); watcher.current = null; }
      else if (navigationEnabled.current) resume.current();
    });
    return () => subscription.remove();
  }, []);
  const stops = (day?.events || []).map(event => ({ name: stopName(event.name), time: timeFromName(event.name), from: '', mode: '步行' })).filter(item => item.name);

  const requestGuide = async (input: { latitude?: number; longitude?: number; accuracy?: number; manualLocation?: string }) => {
    if (!stops.length) { setError('今天的行程里还没有可识别的目的地。'); return null; }
    if (requestLock.current) return null;
    const startedEpoch = epoch.current;
    requestLock.current = true;
    setBusy(true); setError('');
    try {
      const now = new Date();
      const result = await api<NavigationGuide>('/api/navigation/guide', {
        method: 'POST', token, guestToken,
        body: JSON.stringify({ ...input, city: day?.city || '', stops, completedIndex: completedRef.current, nowMinutes: now.getHours() * 60 + now.getMinutes() }),
      });
      if (startedEpoch !== epoch.current) return null;
      completedRef.current = result.reachedIndex;
      setGuide(result); setCompletedIndex(result.reachedIndex); lastFetch.current = Date.now();
      return result;
    } catch (caught) {
      if (startedEpoch === epoch.current) setError(caught instanceof ApiError ? caught.message : '路线获取失败，请稍后重试。');
      return null;
    } finally { if (startedEpoch === epoch.current) { requestLock.current = false; setBusy(false); } }
  };
  requestLatest.current = input => { void requestGuide(input); };

  const openMapNavigation = async (target: NavigationGuide | null, choice: 'amap' | 'system' = 'amap') => {
    if (!target || target.completed) return;
    const links = mapLinks(target);
    const urls = Platform.OS === 'android' ? links[choice] : links.system;
    setLaunching(true); setError('');
    for (const url of urls) {
      try {
        await Linking.openURL(url);
        setLaunching(false);
        return;
      } catch {}
    }
    setLaunching(false);
    setError(choice === 'amap'
      ? '没能打开高德地图。请确认已安装高德地图，或点“使用其他手机地图”。'
      : '手机上没有找到可打开的地图应用，请先安装高德地图。');
  };

  const beginWatching = async () => {
    const startedEpoch = epoch.current;
    const generation = ++watchGeneration.current;
    watcher.current?.remove();
    watcher.current = null;
    try {
      const subscription = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10_000,
        distanceInterval: 15,
      }, position => {
        if (startedEpoch === epoch.current && generation === watchGeneration.current && navigationEnabled.current && AppState.currentState === 'active' && Date.now() - lastFetch.current >= 20_000) {
          requestLatest.current({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy ?? undefined });
        }
      });
      if (startedEpoch !== epoch.current || generation !== watchGeneration.current || !navigationEnabled.current || AppState.currentState !== 'active') subscription.remove();
      else watcher.current = subscription;
    } catch {
      if (startedEpoch === epoch.current && generation === watchGeneration.current) setLocationNote('地图导航已打开；返回 TripMate 后如未自动更新进度，请点“重新判断”。');
    }
  };

  const getReliablePosition = async () => {
    let servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled && Platform.OS === 'android') {
      try {
        await Location.enableNetworkProviderAsync();
        servicesEnabled = await Location.hasServicesEnabledAsync();
      } catch {}
    }
    if (!servicesEnabled) {
      setManual(true);
      setSettingsTarget('services');
      setError('手机定位开关没有开启。请打开系统定位后重试，或手动填写当前位置。');
      return null;
    }

    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      setManual(true);
      setSettingsTarget(permission.canAskAgain ? null : 'permission');
      setError(permission.canAskAgain
        ? '需要允许定位才能自动判断当前位置。你也可以手动填写当前位置。'
        : 'TripMate 的定位权限已被关闭。请在系统设置中允许“使用应用时定位”，然后重试。');
      return null;
    }

    try {
      const current = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        12_000,
      );
      return current;
    } catch {
      const recent = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000, requiredAccuracy: 1500 });
      if (recent) {
        setLocationNote('实时定位暂时较慢，已使用手机最近 10 分钟内的位置打开路线。');
        return recent;
      }
      setManual(true);
      setError('暂时取不到手机位置。请走到窗边或室外后重试，也可以手动填写当前位置。');
      return null;
    }
  };

  const startLocation = async () => {
    if (locating || busy || launching) return;
    setLocating(true);
    setError('');
    setLocationNote('');
    setSettingsTarget(null);
    const startedEpoch = epoch.current;
    try {
      const first = await getReliablePosition();
      if (!first || startedEpoch !== epoch.current) return;
      const result = await requestGuide({ latitude: first.coords.latitude, longitude: first.coords.longitude, accuracy: first.coords.accuracy ?? undefined });
      if (!result || startedEpoch !== epoch.current) return;
      navigationEnabled.current = true;
      void beginWatching();
      await openMapNavigation(result);
    } catch {
      setManual(true);
      setError('自动定位没有完成。请检查手机定位开关与权限后重试，或手动填写当前位置。');
    } finally {
      setLocating(false);
    }
  };
  resume.current = () => {
    const startedEpoch = epoch.current;
    void withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 12_000)
      .then(position => {
        if (startedEpoch !== epoch.current || !navigationEnabled.current) return;
        requestLatest.current({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy ?? undefined });
        void beginWatching();
      }).catch(() => { if (startedEpoch === epoch.current) setLocationNote('返回后暂时未取得新位置，请点“重新判断”更新路线。'); });
  };

  const openLocationSettings = async () => {
    try {
      if (settingsTarget === 'services' && Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      } else {
        await Linking.openSettings();
      }
    } catch {
      setError('无法自动打开系统设置。请在手机设置中搜索“定位”或“TripMate 权限”。');
    }
  };

  const startManualRoute = async () => {
    if (locating || busy || launching) return;
    navigationEnabled.current = false;
    watcher.current?.remove(); watcher.current = null;
    setSettingsTarget(null);
    setLocationNote('');
    const result = await requestGuide({ manualLocation: manualLocation.trim() });
    await openMapNavigation(result);
  };

  const stopNavigation = () => {
    navigationEnabled.current = false;
    epoch.current += 1;
    requestLock.current = false;
    completedRef.current = -1;
    watcher.current?.remove();
    watcher.current = null;
    setGuide(null);
    setCompletedIndex(-1);
    setManual(false);
    setError('');
    setLocationNote('');
    setSettingsTarget(null);
    setBusy(false); setLocating(false);
  };

  if (!plan || !day) return <Screen><View style={styles.center}><Ionicons name="map-outline" size={36} color={p.primary} /><Text style={[styles.emptyTitle, { color: p.text }]}>没有可导航的行程</Text><Text style={[styles.emptyDetail, { color: p.muted }]}>先生成或打开一份行程，再回来开启地图导航。</Text><SecondaryButton label="返回" onPress={() => navigation.goBack()} /></View></Screen>;

  return <Screen contentContainerStyle={styles.screen}>
    <SyncNotice />
    <DaySelector disabled={locating || busy || launching} />
    {!guide ? <>
      <View style={styles.header}>
        {days.length === 1 ? <StatusPill label={`${day.day || '第 1 天'} · ${day.city || '当前城市'}`} icon="calendar-outline" /> : null}
        <Text style={[styles.title, { color: p.text }]}>打开地图，沿着路线走</Text>
        <Text style={[styles.detail, { color: p.muted }]}>TripMate 先判断你该去哪里，再直接进入高德的地图导航。返回 TripMate 后，会继续判断下一站。</Text>
      </View>
      <View style={[styles.launchPanel, { backgroundColor: p.surface }]}>
        <View style={styles.launchVisual} accessible accessibilityLabel="从当前位置导航到行程下一站">
          <View style={[styles.locationDot, { borderColor: p.primary }]}><View style={[styles.locationDotCore, { backgroundColor: p.primary }]} /></View>
          <View style={[styles.routeLine, { backgroundColor: p.route }]} />
          <View style={[styles.destinationPin, { backgroundColor: p.route }]}><Ionicons name="flag" size={21} color={p.onPrimary} /></View>
        </View>
        <Text style={[styles.permissionTitle, { color: p.text }]}>一键进入真实地图导航</Text>
        <Text style={[styles.permissionText, { color: p.muted }]}>只在你点击开始后读取当前位置；停止或退出页面后结束，不保存位置轨迹。</Text>
        <PrimaryButton label={locating ? '正在获取手机位置' : '开始地图导航'} icon="navigate" tone="route" busy={locating || busy || launching} onPress={startLocation} />
        <SecondaryButton label="无法定位？手动填写" icon="create-outline" onPress={() => setManual(true)} />
      </View>
    </> : null}

    {manual ? <View style={styles.manual}><Field label="我现在在" value={manualLocation} onChangeText={setManualLocation} placeholder="例如：杭州东站到达层" /><PrimaryButton label="打开这条地图路线" icon="navigate" tone="route" busy={busy || launching} disabled={manualLocation.trim().length < 2} onPress={startManualRoute} /></View> : null}
    {error ? <View accessibilityRole="alert" style={[styles.error, { backgroundColor: p.raised }]}><Ionicons name="alert-circle-outline" size={21} color={p.error} /><Text style={[styles.errorText, { color: p.error }]}>{error}</Text></View> : null}
    {settingsTarget ? <SecondaryButton label={settingsTarget === 'services' ? '打开手机定位设置' : '打开 TripMate 权限设置'} icon="settings-outline" onPress={openLocationSettings} /> : null}
    {locationNote ? <View accessibilityRole="text" style={[styles.notice, { backgroundColor: p.raised }]}><Ionicons name="locate-outline" size={21} color={p.primary} /><Text style={[styles.noticeText, { color: p.text }]}>{locationNote}</Text></View> : null}

    {guide ? <>
      <View style={[styles.navStatus, { backgroundColor: p.surface }]}>
        <View style={[styles.directionIcon, { backgroundColor: p.route }]}>
          <Ionicons name={guide.completed ? 'checkmark' : guide.routeMode === 'walk' ? 'walk' : guide.routeMode === 'transfer' ? 'train' : 'navigate'} size={31} color={p.onPrimary} />
        </View>
        <View style={styles.navHeading}>
          <Text style={[styles.navLabel, { color: p.route }]}>{guide.completed ? '今天的导航完成' : `下一站 · ${guide.routeModeLabel || '地图导航'}`}</Text>
          <Text numberOfLines={2} style={[styles.navDestination, { color: p.text }]}>{guide.completed ? guide.currentStop?.name || '全部完成' : guide.nextStop?.name || '下一站'}</Text>
        </View>
      </View>

      {!guide.completed ? <View style={styles.progressRoute} accessible accessibilityLabel={`距离下一站 ${distance(guide.distance)}，预计 ${duration(guide.duration)}`}>
        <View style={[styles.progressOrigin, { borderColor: p.primary }]} />
        <View style={[styles.progressTrack, { backgroundColor: p.border }]}><View style={[styles.progressFill, { backgroundColor: p.route, width: `${Math.min(100, Math.max(0, ((completedIndex + 1) / Math.max(1, guide.totalStops)) * 100))}%` }]} /></View>
        <Ionicons name="location" size={32} color={p.route} />
      </View> : null}

      {!guide.completed ? <View style={styles.metrics}>
        <View style={styles.metric}><Text style={[styles.metricValue, { color: p.text }]}>{distance(guide.distance)}</Text><Text style={[styles.metricLabel, { color: p.muted }]}>剩余距离</Text></View>
        <View style={[styles.metricDivider, { backgroundColor: p.border }]} />
        <View style={styles.metric}><Text style={[styles.metricValue, { color: p.text }]}>{duration(guide.duration)}</Text><Text style={[styles.metricLabel, { color: p.muted }]}>预计用时</Text></View>
        <View style={[styles.metricDivider, { backgroundColor: p.border }]} />
        <View style={styles.metric}><Text style={[styles.metricValue, { color: p.text }]}>{Math.min(guide.totalStops, Math.max(1, guide.reachedIndex + 2))}/{guide.totalStops}</Text><Text style={[styles.metricLabel, { color: p.muted }]}>行程进度</Text></View>
      </View> : null}

      {guide.outOfTripArea ? <View style={[styles.notice, { backgroundColor: p.raised }]}><Ionicons name="train-outline" size={21} color={p.warning} /><Text style={[styles.noticeText, { color: p.text }]}>你还没到行程城市。地图会先显示前往目的地的路线，到达当地后再重新判断景点顺序。</Text></View> : null}

      {!guide.completed ? <>
        <PrimaryButton label="继续高德导航" icon="navigate" tone="route" busy={launching} onPress={() => openMapNavigation(guide, 'amap')} />
        <SecondaryButton label="使用其他手机地图" icon="map-outline" disabled={launching} onPress={() => openMapNavigation(guide, 'system')} />
      </> : null}
      <View style={styles.actions}>
        <View style={styles.action}><SecondaryButton label="重新判断" icon="locate-outline" disabled={locating || busy || launching} onPress={startLocation} /></View>
        <View style={styles.action}><Pressable accessibilityRole="button" onPress={stopNavigation} style={({ pressed }) => [styles.stopButton, { borderColor: p.border, backgroundColor: pressed ? p.raised : p.surface }]}><Ionicons name="stop-circle-outline" size={20} color={p.error} /><Text style={[styles.stopText, { color: p.error }]}>停止导航</Text></Pressable></View>
      </View>
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { gap: 18 },
  daySwitch: { minHeight: 66, borderRadius: 16, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayArrow: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayCopy: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  dayTitle: { maxWidth: '100%', fontSize: 17, lineHeight: 23, fontWeight: '800' },
  dayDetail: { maxWidth: '100%', fontSize: 13, lineHeight: 18 },
  header: { gap: 9 },
  title: { fontSize: 30, lineHeight: 37, fontWeight: '800', letterSpacing: -.6 },
  detail: { fontSize: 15, lineHeight: 23 },
  launchPanel: { borderRadius: 16, padding: 20, gap: 14 },
  launchVisual: { height: 108, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  locationDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  locationDotCore: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { height: 5, flex: 1, maxWidth: 190, marginHorizontal: 8, borderRadius: 3 },
  destinationPin: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  permissionTitle: { fontSize: 22, lineHeight: 29, fontWeight: '800', textAlign: 'center' },
  permissionText: { fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 2 },
  manual: { gap: 13 },
  error: { borderRadius: 14, padding: 14, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  errorText: { flex: 1, fontSize: 14, lineHeight: 20 },
  navStatus: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  directionIcon: { width: 62, height: 62, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  navHeading: { flex: 1, gap: 4 },
  navLabel: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  navDestination: { fontSize: 25, lineHeight: 32, fontWeight: '800' },
  progressRoute: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  progressOrigin: { width: 18, height: 18, borderRadius: 9, borderWidth: 5 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, marginHorizontal: 8, overflow: 'hidden' },
  progressFill: { width: '38%', height: '100%', borderRadius: 3 },
  metrics: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  metric: { flex: 1, alignItems: 'center', gap: 4 },
  metricValue: { fontSize: 18, lineHeight: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 12, lineHeight: 17 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 42 },
  notice: { borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 9 },
  action: { flex: 1 },
  stopButton: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  stopText: { fontSize: 15, fontWeight: '700' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyTitle: { fontSize: 21, fontWeight: '800' },
  emptyDetail: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 8 },
});
