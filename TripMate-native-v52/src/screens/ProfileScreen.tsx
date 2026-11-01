import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, diagnoseConnection } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Screen } from '../components/Screen';
import { Divider, SecondaryButton, SectionTitle, StatusPill } from '../components/UI';
import { usePalette } from '../theme';
import { SyncNotice } from '../components/TripControls';
import { usePlan } from '../plan/PlanContext';

export function ProfileScreen() {
  const p = usePalette();
  const { user, guest, token, logout } = useAuth();
  const { pendingCount } = usePlan();
  const [credits, setCredits] = useState<{ balance: number; unlimited: boolean } | null>(null);
  const [permission, setPermission] = useState<Location.PermissionStatus | null>(null);
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [creditError, setCreditError] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void Location.getForegroundPermissionsAsync().then(result => { if (active) setPermission(result.status); }).catch(() => null);
    if (user && token) void api<{ balance: number; unlimited: boolean }>('/api/credits', { token })
      .then(result => { if (active) { setCredits(result); setCreditError(false); } })
      .catch(() => { if (active) setCreditError(true); });
    return () => { active = false; };
  }, [token, user]));
  const diagnose = async () => { setChecking(true); try { setMessage(await diagnoseConnection()); } finally { setChecking(false); } };
  const signOut = () => Alert.alert('退出当前账号？', pendingCount ? `还有 ${pendingCount} 项更改未同步。本机副本会保留在当前账号下，重新登录后可继续同步。` : '保存在服务器上的行程不会被删除。', [{ text: '取消', style: 'cancel' }, { text: '退出', style: 'destructive', onPress: () => void logout().catch(() => setMessage('安全存储暂时无法清理，请重试退出。')) }]);
  return <Screen>
    <SyncNotice />
    <View style={styles.identity}><View style={[styles.avatar, { backgroundColor: p.primary }]}><Text style={[styles.avatarText, { color: p.onPrimary }]}>{(user?.name || guest?.name || '旅').slice(0, 1)}</Text></View><View style={styles.identityBody}><Text style={[styles.name, { color: p.text }]}>{user?.name || '游客'}</Text><Text style={[styles.email, { color: p.muted }]}>{user?.email || '游客预览模式'}</Text></View>{user?.role === 'admin' ? <StatusPill label="管理员" icon="shield-checkmark-outline" tone="route" /> : null}</View>
    <View style={[styles.balance, { backgroundColor: p.surface }]}><View><Text style={[styles.balanceLabel, { color: p.muted }]}>AI 额度{creditError && credits ? ' · 上次读取' : ''}</Text><Text style={[styles.balanceValue, { color: p.text }]}>{credits?.unlimited ? '无限' : credits ? `${credits.balance} 点` : guest ? `${guest.previewRemaining} 次预览` : creditError ? '暂时无法读取' : '读取中'}</Text></View><Ionicons name="flash-outline" size={28} color={p.warning} /></View>
    <SectionTitle>隐私与设备</SectionTitle>
    <View style={[styles.settings, { backgroundColor: p.surface }]}>
      <View style={styles.setting}><Ionicons name="location-outline" size={22} color={p.primary} /><View style={styles.settingBody}><Text style={[styles.settingTitle, { color: p.text }]}>位置权限</Text><Text style={[styles.settingDetail, { color: p.muted }]}>{permission === Location.PermissionStatus.GRANTED ? '已允许，仅在开启实时行程时读取' : permission === Location.PermissionStatus.DENIED ? '未允许，可在实时行程中改用手动位置' : '尚未询问，将在开启实时行程时询问'}</Text></View></View>
      <Divider />
      <View style={styles.setting}><Ionicons name="lock-closed-outline" size={22} color={p.primary} /><View style={styles.settingBody}><Text style={[styles.settingTitle, { color: p.text }]}>登录保护</Text><Text style={[styles.settingDetail, { color: p.muted }]}>登录凭证保存在 iOS 钥匙串或 Android 安全存储中。</Text></View></View>
    </View>
    <SecondaryButton label="管理定位权限" icon="location-outline" onPress={() => void Linking.openSettings().catch(() => setMessage('请在手机设置中打开 TripMate 的权限页面。'))} />
    <SecondaryButton label={checking ? '正在检查连接' : '检查服务器连接'} icon="pulse-outline" disabled={checking} onPress={() => void diagnose()} />
    {message ? <Text accessibilityLiveRegion="polite" style={[styles.settingDetail, { color: p.text }]}>{message}</Text> : null}
    <SecondaryButton label="退出当前账号" icon="log-out-outline" onPress={signOut} />
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('mailto:tripmate@yeah.net').catch(() => setMessage('手机未配置邮件应用。可复制邮箱 tripmate@yeah.net 联系我们。'))} style={styles.contact}><Text selectable style={[styles.contactText, { color: p.primary }]}>客服邮箱：tripmate@yeah.net</Text></Pressable>
    <Text style={[styles.settingDetail, { color: p.muted, textAlign: 'center' }]}>TripMate {Constants.expoConfig?.version || '1.1.0'} · 已同步行程支持离线查看</Text>
  </Screen>;
}

const styles = StyleSheet.create({ identity: { flexDirection: 'row', alignItems: 'center', gap: 13 }, avatar: { width: 58, height: 58, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 24, fontWeight: '800' }, identityBody: { flex: 1, gap: 3 }, name: { fontSize: 22, fontWeight: '800' }, email: { fontSize: 14 }, balance: { minHeight: 104, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, balanceLabel: { fontSize: 13, marginBottom: 5 }, balanceValue: { fontSize: 25, fontWeight: '800' }, settings: { borderRadius: 16, paddingHorizontal: 16 }, setting: { minHeight: 90, flexDirection: 'row', alignItems: 'center', gap: 13 }, settingBody: { flex: 1, gap: 4 }, settingTitle: { fontSize: 16, fontWeight: '700' }, settingDetail: { fontSize: 13, lineHeight: 19 }, contact: { minHeight: 48, justifyContent: 'center', alignItems: 'center' }, contactText: { fontSize: 14, fontWeight: '600' } });
