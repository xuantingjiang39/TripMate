import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { diagnoseConnection, errorMessage } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Field, PrimaryButton, SecondaryButton } from '../components/UI';
import { usePalette } from '../theme';

export function AuthScreen() {
  const p = usePalette();
  const { login, register, sendCode, enterGuest, connectionMessage, refresh } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [diagnosing, setDiagnosing] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const explain = (caught: unknown) => setError(errorMessage(caught, '连接失败，请检查网络后重试。'));
  const diagnose = async () => {
    setDiagnosing(true); setError('');
    try { setError(await diagnoseConnection()); }
    finally { setDiagnosing(false); }
  };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register({ email: email.trim(), name: name.trim(), password, verificationCode: code.trim() });
    } catch (caught) { explain(caught); } finally { setBusy(false); }
  };
  const requestCode = async () => {
    setSending(true); setError('');
    try { setCountdown(await sendCode(email.trim())); }
    catch (caught) { explain(caught); } finally { setSending(false); }
  };
  const guest = async () => {
    setBusy(true); setError('');
    try { await enterGuest(); }
    catch (caught) { explain(caught); } finally { setBusy(false); }
  };

  return <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.brandRow}><View style={[styles.mark, { backgroundColor: p.primary }]}><Ionicons name="navigate" size={25} color={p.onPrimary} /></View><Text style={[styles.brand, { color: p.text }]}>旅伴 <Text style={{ color: p.primary }}>TripMate</Text></Text></View>
        <View style={styles.heading}><Text style={[styles.title, { color: p.text }]}>{mode === 'login' ? '欢迎回来' : '把完整行程带在身边'}</Text><Text style={[styles.subtitle, { color: p.muted }]}>{mode === 'login' ? '登录后同步你的攻略、订单和实时行程。' : '验证码只用于确认邮箱，120 秒内有效。'}</Text></View>
        <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: p.raised }]}>
          {(['login', 'register'] as const).map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: mode === item }} onPress={() => { setMode(item); setError(''); }} style={[styles.segmentItem, mode === item && { backgroundColor: p.surface }]}><Text style={[styles.segmentText, { color: mode === item ? p.primary : p.muted }]}>{item === 'login' ? '登录' : '注册'}</Text></Pressable>)}
        </View>
        <View style={styles.form}>
          {connectionMessage ? <><Text accessibilityRole="alert" style={[styles.alertText, { color: p.warning }]}>{connectionMessage}</Text><SecondaryButton label="重试登录验证" icon="refresh-outline" disabled={busy} onPress={() => void refresh()} /></> : null}
          {mode === 'register' ? <Field label="昵称" value={name} onChangeText={setName} autoComplete="name" placeholder="2—24 个字符" /> : null}
          <Field label="邮箱" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="name@example.com" />
          {mode === 'register' ? <View style={styles.codeRow}><View style={styles.codeField}><Field label="验证码" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="6 位数字" /></View><View style={styles.codeButton}><SecondaryButton label={countdown > 0 ? `${countdown} 秒` : '发送验证码'} onPress={requestCode} disabled={sending || countdown > 0 || !email.includes('@')} /></View></View> : null}
          <Field label="密码" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="至少 8 位" />
          {error ? <View accessibilityRole="alert" style={[styles.alert, { backgroundColor: p.raised }]}><Ionicons name="alert-circle-outline" size={20} color={p.error} /><Text style={[styles.alertText, { color: p.error }]}>{error}</Text></View> : null}
          <PrimaryButton label={mode === 'login' ? '登录 TripMate' : '注册并同步行程'} icon="arrow-forward" busy={busy} disabled={!email || password.length < 8 || (mode === 'register' && (!name || code.length !== 6))} onPress={submit} />
          <SecondaryButton label="先看看，游客体验一次" icon="eye-outline" disabled={busy} onPress={() => Alert.alert('游客模式', '游客可以免费生成一次，并查看第 1 天。注册后解锁完整行程。', [{ text: '取消', style: 'cancel' }, { text: '进入游客模式', onPress: guest }])} />
          <Pressable accessibilityRole="button" disabled={diagnosing} onPress={diagnose} style={styles.diagnosticButton}><Ionicons name="pulse-outline" size={17} color={p.primary} /><Text style={[styles.diagnosticText, { color: p.primary }]}>{diagnosing ? '正在检查服务器…' : '检查服务器连接'}</Text></Pressable>
        </View>
        <Text style={[styles.privacy, { color: p.muted }]}>登录凭证保存在手机系统的安全存储中。TripMate 不会在启动时索取定位权限。</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, scroll: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', justifyContent: 'center', padding: 24, gap: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 }, mark: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, brand: { fontSize: 22, fontWeight: '800' },
  heading: { gap: 7 }, title: { fontSize: 32, lineHeight: 39, fontWeight: '800', letterSpacing: -.7 }, subtitle: { fontSize: 16, lineHeight: 24 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4 }, segmentItem: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, segmentText: { fontSize: 15, fontWeight: '700' },
  form: { gap: 16 }, codeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' }, codeField: { flex: 1 }, codeButton: { minWidth: 116, paddingBottom: 0 },
  alert: { minHeight: 48, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 }, alertText: { flex: 1, fontSize: 14, lineHeight: 20 }, diagnosticButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, diagnosticText: { fontSize: 14, fontWeight: '700' }, privacy: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
