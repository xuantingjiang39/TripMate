import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { EmptyState, PrimaryButton, SectionTitle, StatusPill } from '../components/UI';
import { DaySelector, SyncNotice } from '../components/TripControls';
import { formatMoney } from '../plan/domain';
import { usePlan } from '../plan/PlanContext';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Disclosure } from '../components/Disclosure';

export function TodayScreen() {
  const p = usePalette();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { plan, loading, saving, refresh, dayIndex } = usePlan();
  if (loading) return <Screen contentContainerStyle={styles.loading}><ActivityIndicator color={p.primary} /><Text style={{ color: p.muted }}>正在同步你的行程…</Text></Screen>;
  if (!plan) return <Screen><SyncNotice /><EmptyState icon="map-outline" title="还没有当前行程" detail="告诉 TripMate 想去哪里、几天和预算，AI 会先排好每天，再补全交通和费用。" action={<PrimaryButton label="开始规划" icon="sparkles-outline" onPress={() => navigation.navigate('Main', { screen: 'Plan' })} />} /></Screen>;
  const day = plan.days?.[dayIndex] || plan.days?.[0];
  const next = day?.events?.[0];
  return <Screen refreshing={loading} onRefresh={refresh}>
    <SyncNotice />
    <View style={styles.intro}>
      <View style={styles.titleRow}><Text style={[styles.title, { color: p.text }]}>{plan.title || '我的旅行'}</Text>{saving ? <StatusPill label="同步中" icon="cloud-upload-outline" /> : <StatusPill label={plan.reviewed ? '已复核' : '可继续调整'} icon={plan.reviewed ? 'shield-checkmark-outline' : 'create-outline'} tone={plan.reviewed ? 'route' : 'neutral'} />}</View>
    </View>
    <DaySelector />
    <View style={[styles.next, { backgroundColor: p.surface }]}>
      <View style={[styles.routeBadge, { backgroundColor: p.route }]}><Ionicons name="navigate" size={22} color={p.onPrimary} /></View>
      <View style={styles.nextBody}><Text style={[styles.nextLabel, { color: p.route }]}>当天第一站</Text><Text style={[styles.nextName, { color: p.text }]}>{next?.name || '查看今天的安排'}</Text><Text style={[styles.nextDetail, { color: p.muted }]}>开始定位后，判断下一站与路线。</Text></View>
    </View>
    <PrimaryButton label="开始当天地图导航" icon="location-outline" tone="route" onPress={() => navigation.navigate('LiveNavigation')} />
    <SectionTitle>{day?.day || '第 1 天'} · {day?.city || '今日安排'}</SectionTitle>
    <View style={styles.timeline}>
      {(day?.events || []).map((event, index) => <View key={`${event.name}-${index}`} style={styles.event}>
        <View style={styles.lineCol}><View style={[styles.dot, { borderColor: index === 0 ? p.route : p.border, backgroundColor: p.background }]} />{index < (day?.events?.length || 0) - 1 ? <View style={[styles.line, { backgroundColor: p.border }]} /> : null}</View>
        <View style={styles.eventBody}><Text style={[styles.eventName, { color: p.text }]}>{event.name}</Text>{event.note ? <Disclosure title="查看安排详情"><Text style={[styles.eventNote, { color: p.muted }]}>{event.note}</Text></Disclosure> : null}</View>
      </View>)}
    </View>
    <Pressable accessibilityRole="button" onPress={() => navigation.navigate('TripDetail')} style={[styles.overview, { backgroundColor: p.surface }]}><View style={{ flex: 1, gap: 5 }}><Text style={[styles.eventName, { color: p.text }]}>查看完整攻略</Text><Text style={[styles.eventNote, { color: p.muted }]}>{plan.days.length} 天 · {formatMoney(plan.budget?.total, plan.budget?.currency)} · 交通 / 住宿 / 美食</Text></View><Ionicons name="chevron-forward" size={22} color={p.primary} /></Pressable>
    {plan.summary || plan.advice ? <Disclosure title="行程概况与出发提醒"><Text style={[styles.adviceText, { color: p.muted }]}>{[plan.summary, plan.advice].filter(Boolean).join('\n\n')}</Text></Disclosure> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  overview: { minHeight: 86, borderRadius: 14, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  loading: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }, intro: { gap: 8 }, titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, title: { flex: 1, fontSize: 28, lineHeight: 35, fontWeight: '800', letterSpacing: -.5 }, summary: { fontSize: 15, lineHeight: 23 },
  next: { minHeight: 126, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 }, routeBadge: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, nextBody: { flex: 1, gap: 3 }, nextLabel: { fontSize: 12, fontWeight: '800' }, nextName: { fontSize: 20, lineHeight: 27, fontWeight: '700' }, nextDetail: { fontSize: 14, lineHeight: 20 },
  timeline: { gap: 0 }, event: { flexDirection: 'row', minHeight: 78, gap: 14 }, lineCol: { width: 18, alignItems: 'center' }, dot: { width: 15, height: 15, borderRadius: 8, borderWidth: 4, marginTop: 4 }, line: { flex: 1, width: 2, marginVertical: 3 }, eventBody: { flex: 1, paddingBottom: 22, gap: 5 }, eventName: { fontSize: 17, lineHeight: 23, fontWeight: '700' }, eventNote: { fontSize: 14, lineHeight: 21 }, advice: { borderRadius: 14, padding: 15, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, adviceText: { flex: 1, fontSize: 14, lineHeight: 21 },
});
