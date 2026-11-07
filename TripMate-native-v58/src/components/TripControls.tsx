import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePlan } from '../plan/PlanContext';
import { usePalette } from '../theme';
import { SecondaryButton } from './UI';

export function DaySelector({ disabled = false }: { disabled?: boolean }) {
  const p = usePalette();
  const { plan, dayIndex, selectDay } = usePlan();
  const days = plan?.days || [];
  const day = days[dayIndex] || days[0];
  if (!day) return null;
  return <View style={[styles.day, { backgroundColor: p.surface }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="查看前一天行程" accessibilityState={{ disabled: disabled || dayIndex <= 0 }} disabled={disabled || dayIndex <= 0} onPress={() => selectDay(dayIndex - 1)} style={({ pressed }) => [styles.arrow, { backgroundColor: pressed ? p.raised : 'transparent', opacity: disabled || dayIndex <= 0 ? .3 : 1 }]}><Ionicons name="chevron-back" size={22} color={p.primary} /></Pressable>
    <View style={styles.dayBody} accessibilityLiveRegion="polite"><Text style={[styles.dayTitle, { color: p.text }]}>{day.day || `第 ${dayIndex + 1} 天`} / {days.length} 天</Text><Text style={[styles.dayDetail, { color: p.muted }]}>{[day.date, day.city].filter(Boolean).join(' · ') || '出行日期未指定'}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="查看后一天行程" accessibilityState={{ disabled: disabled || dayIndex >= days.length - 1 }} disabled={disabled || dayIndex >= days.length - 1} onPress={() => selectDay(dayIndex + 1)} style={({ pressed }) => [styles.arrow, { backgroundColor: pressed ? p.raised : 'transparent', opacity: disabled || dayIndex >= days.length - 1 ? .3 : 1 }]}><Ionicons name="chevron-forward" size={22} color={p.primary} /></Pressable>
  </View>;
}

export function SyncNotice() {
  const p = usePalette();
  const { syncMessage, offline, pendingCount, saving, refresh } = usePlan();
  if (!syncMessage && !offline && !pendingCount) return null;
  return <View style={[styles.notice, { backgroundColor: p.raised }]}>
    <View style={styles.noticeRow}><Ionicons name="cloud-offline-outline" size={21} color={p.warning} /><Text accessibilityLiveRegion="polite" style={[styles.noticeText, { color: p.text }]}>{syncMessage || (pendingCount ? `${pendingCount} 项行程更改待同步。` : '正在使用离线副本，联网后可更新。')}</Text></View>
    <SecondaryButton label={saving ? '正在同步' : '重试同步'} disabled={saving} icon="sync-outline" onPress={() => void refresh()} />
  </View>;
}

const styles = StyleSheet.create({
  day: { minHeight: 72, borderRadius: 14, paddingHorizontal: 6, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayBody: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3 }, dayTitle: { fontSize: 16, lineHeight: 23, fontWeight: '800', textAlign: 'center' }, dayDetail: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  notice: { borderRadius: 14, padding: 14, gap: 12 }, noticeRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' }, noticeText: { flex: 1, fontSize: 14, lineHeight: 21 },
});
