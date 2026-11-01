import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../api';
import { Screen } from '../components/Screen';
import { Field, PrimaryButton, StatusPill } from '../components/UI';
import type { MainTabParamList } from '../navigation/RootNavigator';
import { usePlan } from '../plan/PlanContext';
import { usePalette } from '../theme';
import { SyncNotice } from '../components/TripControls';

const templates = [
  '从广州出发，带妈妈去杭州轻松游 3 天，预算 5000 元，少走路并安排午休。',
  '周末两天亲子旅行，孩子 7 岁，喜欢动物和自然，行程不要太赶。',
  '规划 10 天游欧洲多国路线，交通写清起点终点、购票渠道和费用。',
];

export function PlanScreen({ navigation }: BottomTabScreenProps<MainTabParamList, 'Plan'>) {
  const p = usePalette();
  const { generate, estimate } = usePlan();
  const [request, setRequest] = useState(templates[0]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [quote, setQuote] = useState<{ cost: number; balance: number; unlimited?: boolean } | null>(null);
  const [quotedRequest, setQuotedRequest] = useState('');
  const inFlight = useRef(false);
  const updateRequest = (value: string) => { if (!inFlight.current) { setRequest(value); setQuote(null); setQuotedRequest(''); setMessage(''); } };
  const create = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (!quote || quotedRequest !== request) {
        setMessage('正在理解需求并评估额度…');
        const estimated = await estimate(request);
        if (!estimated.enough) throw new ApiError(`AI 额度不足，本次预计需要 ${estimated.cost} 点。`);
        setQuote(estimated); setQuotedRequest(request);
        setMessage('额度已评估。确认下方费用后，再点一次开始生成。');
        return;
      }
      setMessage('正在生成每日安排、交通和费用，通常需要 1—2 分钟…');
      await generate(request);
      setMessage('行程已生成。');
      navigation.navigate('Today');
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : '生成失败，请稍后重试。'); }
    finally { setBusy(false); inFlight.current = false; }
  };
  return <Screen>
    <SyncNotice />
    <View style={styles.header}><Text style={[styles.title, { color: p.text }]}>这次想怎么走？</Text><Text style={[styles.detail, { color: p.muted }]}>自然描述就可以。写清出发地、目的地、天数、人数、预算和同行人，会更准确。</Text></View>
    <Field label="旅行需求" value={request} editable={!busy} onChangeText={updateRequest} multiline maxLength={1200} placeholder="例如：从广州出发，带父母去杭州 3 天…" />
    <View style={styles.templates}>{templates.map((item, index) => <Pressable key={index} accessibilityRole="button" disabled={busy} onPress={() => updateRequest(item)} style={({ pressed }) => [styles.template, { backgroundColor: pressed ? p.raised : p.surface }]}><Ionicons name={index === 0 ? 'accessibility-outline' : index === 1 ? 'happy-outline' : 'earth-outline'} size={20} color={p.primary} /><Text style={[styles.templateText, { color: p.text }]} numberOfLines={2}>{index === 0 ? '长辈轻松游' : index === 1 ? '周末亲子游' : '多国长线'}</Text></Pressable>)}</View>
    {quote ? <View style={styles.quote}><StatusPill label={quote.unlimited ? '管理员无限额度' : `预计 ${quote.cost} 点 · 余额 ${quote.balance}`} icon="flash-outline" tone="warning" /></View> : null}
    {message ? <View accessibilityLiveRegion="polite" style={[styles.message, { backgroundColor: p.raised }]}><Ionicons name={busy ? 'hourglass-outline' : 'information-circle-outline'} size={20} color={p.primary} /><Text style={[styles.messageText, { color: p.text }]}>{message}</Text></View> : null}
    <PrimaryButton label={busy ? '正在处理，请稍候' : quote && quotedRequest === request ? `确认并生成${quote.unlimited ? '' : ` · ${quote.cost} 点`}` : '先评估本次额度'} icon="sparkles-outline" busy={busy} disabled={request.trim().length < 10} onPress={create} />
    <Text style={[styles.note, { color: p.muted }]}>服务端生成失败会退回预留额度。网络中断后请先刷新行程与余额，避免重复生成。实时价格与营业时间请打开来源复核。</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  header: { gap: 7 }, title: { fontSize: 28, lineHeight: 35, fontWeight: '800', letterSpacing: -.5 }, detail: { fontSize: 15, lineHeight: 23 },
  templates: { flexDirection: 'row', gap: 9 }, template: { flex: 1, minHeight: 76, borderRadius: 14, padding: 11, justifyContent: 'space-between' }, templateText: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  quote: { alignItems: 'flex-start' }, message: { borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, messageText: { flex: 1, fontSize: 14, lineHeight: 21 }, note: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
