import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { DaySelector, SyncNotice } from '../components/TripControls';
import { EmptyState, PrimaryButton, SecondaryButton, SectionTitle } from '../components/UI';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { formatMoney, planText, safeWebUrl } from '../plan/domain';
import { usePlan } from '../plan/PlanContext';
import { useAuth } from '../auth/AuthContext';
import { usePalette } from '../theme';
import type { Recommendation } from '../types';

function Place({ item, type }: { item: Recommendation; type: string }) {
  const p = usePalette();
  const [imageFailed, setImageFailed] = useState(false);
  const [error, setError] = useState('');
  const image = safeWebUrl(item.imageUrl);
  const link = safeWebUrl(item.bookingUrl) || safeWebUrl(item.sourceUrl);
  const open = async () => { try { await Linking.openURL(link); } catch { setError('暂时无法打开来源，请联网后重试。'); } };
  return <View style={[styles.place, { backgroundColor: p.surface }]}>
    {image && !imageFailed ? <Image accessibilityLabel={`${item.name}的来源图片`} source={{ uri: image }} onError={() => setImageFailed(true)} style={styles.photo} /> : null}
    <View style={styles.placeBody}>
      <Text style={[styles.meta, { color: p.muted }]}>{type} · {item.sourceName || '以来源页为准'}</Text>
      <Text style={[styles.placeName, { color: p.text }]}>{item.name}</Text>
      {item.area ? <Text selectable style={[styles.body, { color: p.muted }]}>{item.area}</Text> : null}
      {item.rating !== undefined && item.rating !== '' ? <Text style={[styles.body, { color: p.text }]}>来源评分：{item.rating}</Text> : null}
      <Text style={[styles.body, { color: p.text }]}>{item.costDetail || `参考费用：${formatMoney(item.estimatedCost)}，以预订页面为准。`}</Text>
      {item.booking ? <Text selectable style={[styles.body, { color: p.muted }]}>{item.booking}</Text> : null}
      {link ? <SecondaryButton label={item.bookingUrl ? '查看商品与预订' : '打开来源核实'} icon="open-outline" onPress={() => void open()} /> : <Text style={[styles.meta, { color: p.muted }]}>未提供可核验链接，请到官方渠道确认。</Text>}
      {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
    </View>
  </View>;
}

const tabs = ['安排', '交通', '住与吃', '费用'] as const;
export function TripDetailScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'TripDetail'>) {
  const p = usePalette();
  const { user } = useAuth();
  const { plan, dayIndex, savePlan, saving, pendingCount } = usePlan();
  const [tab, setTab] = useState<typeof tabs[number]>('安排');
  const [message, setMessage] = useState('');
  const day = plan?.days[dayIndex] || plan?.days[0];
  if (!plan) return <Screen><EmptyState icon="map-outline" title="还没有可查看的攻略" detail="先打开或生成一份行程。" /></Screen>;
  const save = async () => { try { await savePlan(); setMessage('已加入旅行收藏，可在“行程”中打开。'); } catch { setMessage('收藏暂时未完成，请重试。'); } };
  const share = async () => { try { await Share.share({ title: plan.title, message: planText(plan) }); } catch { setMessage('暂时无法打开分享，请重试。'); } };
  const legs = plan.transportLegs || [];
  const places = [...(plan.recommendations?.hotels || []).map(item => ({ item, type: '住宿' })), ...(plan.recommendations?.restaurants || []).map(item => ({ item, type: '餐厅' }))];
  return <Screen>
    <SyncNotice />
    <Text selectable style={[styles.title, { color: p.text }]}>{plan.title}</Text>
    {plan.summary ? <Text selectable style={[styles.body, { color: p.muted }]}>{plan.summary}</Text> : null}
    {plan.reviewWarning ? <Text style={[styles.body, { color: p.warning }]}>{plan.reviewWarning}</Text> : null}
    <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: p.raised }]}>{tabs.map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: item === tab }} onPress={() => setTab(item)} style={[styles.tab, item === tab && { backgroundColor: p.surface }]}><Text style={[styles.tabText, { color: item === tab ? p.primary : p.muted }]}>{item}</Text></Pressable>)}</View>
    {tab === '安排' ? <>
      <DaySelector />
      <PrimaryButton label="导航这一天" tone="route" icon="navigate" onPress={() => navigation.navigate('LiveNavigation')} />
      {(day?.events || []).map((event, index) => <View key={`${event.name}-${index}`} style={styles.event}><View style={[styles.eventDot, { backgroundColor: p.route }]} /><View style={styles.eventBody}><Text selectable style={[styles.eventTitle, { color: p.text }]}>{event.name}</Text>{event.note ? <Text selectable style={[styles.body, { color: p.muted }]}>{event.note}</Text> : null}</View></View>)}
      {day?.stayArea ? <Text selectable style={[styles.body, { color: p.text }]}>住宿区域：{day.stayArea}</Text> : null}
      {plan.advice ? <><SectionTitle>出发前记住</SectionTitle><Text selectable style={[styles.body, { color: p.muted }]}>{plan.advice}</Text></> : null}
    </> : null}
    {tab === '交通' ? <>
      {!legs.length ? <EmptyState icon="train-outline" title="暂未取得交通明细" detail="可先从当天安排打开地图确认路线。" /> : null}
      {legs.map((leg, index) => <View key={index} style={[styles.leg, { backgroundColor: p.surface }]}><Text style={[styles.meta, { color: p.primary }]}>{[leg.day, leg.time, leg.mode].filter(Boolean).join(' · ')}</Text><Text selectable style={[styles.eventTitle, { color: p.text }]}>{leg.from || '出发点'} → {leg.to || '目的地'}</Text>{leg.route ? <Text selectable style={[styles.body, { color: p.muted }]}>{leg.route}</Text> : null}<Text style={[styles.body, { color: p.text }]}>{leg.duration ? `${leg.duration} · ` : ''}{formatMoney(leg.cost, plan.budget?.currency)}</Text>{leg.costDetail ? <Text selectable style={[styles.body, { color: p.muted }]}>{leg.costDetail}</Text> : null}{leg.booking ? <Text selectable style={[styles.body, { color: p.muted }]}>购票参考：{leg.booking}</Text> : null}</View>)}
    </> : null}
    {tab === '住与吃' ? <>
      <Text style={[styles.body, { color: p.muted }]}>保留来源原始评分。房价、库存和营业时间请在来源页确认。</Text>
      {!places.length ? <EmptyState icon="bed-outline" title="暂未取得可核验推荐" detail="攻略中的住宿区域仍可参考；取得来源数据后才会显示具体商品。" /> : null}
      {places.map(({ item, type }, index) => <Place key={`${item.name}-${index}`} item={item} type={type} />)}
    </> : null}
    {tab === '费用' ? <>
      <SectionTitle>费用分布</SectionTitle>
      {[['全程合计', plan.budget?.total], ['交通', plan.budget?.transport?.total], ['住宿', plan.budget?.lodging?.total], ['餐饮与门票', plan.budget?.foodTickets?.total]].map(([label, value]) => <View key={String(label)} style={[styles.budgetRow, { borderBottomColor: p.border }]}><Text style={[styles.body, { color: p.muted }]}>{label}</Text><Text style={[styles.price, { color: p.text }]}>{formatMoney(value, plan.budget?.currency)}</Text></View>)}
      <Text style={[styles.meta, { color: p.muted }]}>以上为行程估算；未提供金额时标记为“待核实”，不按免费处理。</Text>
    </> : null}
    {user ? <SecondaryButton label={saving ? '正在保存' : '收藏完整行程'} icon="bookmark-outline" disabled={saving} onPress={() => void save()} /> : <Text style={[styles.body, { color: p.warning }]}>当前为游客预览，注册后可查看完整行程并收藏。</Text>}
    <SecondaryButton label="分享攻略给家人" icon="share-outline" onPress={() => void share()} />
    {message ? <Text accessibilityLiveRegion="polite" style={[styles.body, { color: p.primary }]}>{pendingCount ? '已保留本机副本，联网后可重试同步。' : message}</Text> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -.5 }, body: { fontSize: 16, lineHeight: 25 }, meta: { fontSize: 13, lineHeight: 20 },
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 }, tab: { flex: 1, minHeight: 48, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }, tabText: { fontSize: 14, fontWeight: '700' },
  event: { flexDirection: 'row', gap: 12 }, eventDot: { height: 10, width: 10, borderRadius: 5, marginTop: 8 }, eventBody: { flex: 1, gap: 6 }, eventTitle: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  leg: { borderRadius: 14, padding: 16, gap: 8 }, place: { borderRadius: 14, overflow: 'hidden' }, photo: { width: '100%', height: 180 }, placeBody: { padding: 16, gap: 10 }, placeName: { fontSize: 21, lineHeight: 28, fontWeight: '700' },
  budgetRow: { minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }, price: { fontSize: 19, lineHeight: 27, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
