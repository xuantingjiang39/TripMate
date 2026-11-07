import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { SyncNotice } from '../components/TripControls';
import { EmptyState, Field, SectionTitle, StatusPill } from '../components/UI';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { formatMoney, planKey, savedTrips } from '../plan/domain';
import { usePlan } from '../plan/PlanContext';
import { usePalette } from '../theme';
import type { Plan } from '../types';

export function TripsScreen() {
  const p = usePalette();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { plan, state, loading, refresh, openPlan, saving } = usePlan();
  const [search, setSearch] = useState('');
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const archives = savedTrips(state);
  const currentKey = plan ? planKey(plan) : '';
  const items = [...(plan ? [{ id: 'current', plan, savedAt: '' }] : []), ...archives.filter(item => planKey(item.plan) !== currentKey)];
  const filtered = items.filter(item => `${item.plan.title} ${item.plan.days.map(day => day.city || '').join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
  const open = async (target: Plan) => {
    if (opening) return;
    setOpening(true); setError('');
    try { if (!plan || planKey(target) !== currentKey) await openPlan(target); navigation.navigate('TripDetail'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : '行程暂时无法打开。'); }
    finally { setOpening(false); }
  };
  return <Screen refreshing={loading} onRefresh={refresh}>
    <SyncNotice />
    <SectionTitle>你的旅行收藏</SectionTitle>
    {items.length ? <Field label="搜索行程" value={search} onChangeText={setSearch} placeholder="按名称或城市查找" autoCorrect={false} /> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
    {!filtered.length ? <EmptyState icon="albums-outline" title={items.length ? '没有匹配的行程' : '还没有保存的旅行'} detail={items.length ? '换个城市或行程名称再试试。' : '生成攻略后可保存到这里，已同步的攻略也能离线查看。'} /> : null}
    <View style={styles.list}>{filtered.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`打开${item.plan.title || '未命名行程'}`} disabled={opening || saving} onPress={() => void open(item.plan)} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? p.raised : p.surface, opacity: opening ? .65 : 1 }]}>
      <View style={[styles.icon, { backgroundColor: p.raised }]}><Ionicons name="map-outline" size={22} color={p.primary} /></View>
      <View style={styles.body}><Text numberOfLines={2} style={[styles.name, { color: p.text }]}>{item.plan.title || '未命名行程'}</Text><Text style={[styles.meta, { color: p.muted }]}>{item.plan.days.length} 天 · {formatMoney(item.plan.budget?.total, item.plan.budget?.currency)}</Text><Text numberOfLines={1} style={[styles.meta, { color: p.muted }]}>{[...new Set(item.plan.days.map(day => day.city).filter(Boolean))].join(' · ')}</Text></View>
      {item.id === 'current' ? <StatusPill label="当前" tone="route" /> : <Ionicons name="chevron-forward" size={20} color={p.muted} />}
    </Pressable>)}</View>
    {items.length ? <Text style={[styles.help, { color: p.muted }]}>打开已存行程不消耗 AI 额度。替换当前攻略时，会把原攻略一起保留。</Text> : null}
  </Screen>;
}
const styles = StyleSheet.create({ list: { gap: 10 }, row: { minHeight: 96, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, icon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, body: { flex: 1, minWidth: 0, gap: 5 }, name: { fontSize: 17, lineHeight: 23, fontWeight: '700' }, meta: { fontSize: 13, lineHeight: 19 }, help: { fontSize: 13, lineHeight: 20 } });
