import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenCenter } from '../components/Screen';
import { API_BASE_URL } from '../api';
import { usePalette } from '../theme';

export function SetupScreen() {
  const p = usePalette();
  return <ScreenCenter><View style={styles.wrap}><View style={[styles.icon, { backgroundColor: p.raised }]}><Ionicons name="server-outline" size={32} color={p.primary} /></View><Text style={[styles.title, { color: p.text }]}>App 已完成，等待绑定服务器</Text><Text style={[styles.detail, { color: p.muted }]}>为了保护账号密码和定位数据，TripMate 原生 App 只连接 HTTPS。请在项目目录运行：</Text><View style={[styles.command, { backgroundColor: p.surface }]}><Text selectable style={[styles.commandText, { color: p.text }]}>npm run configure -- https://你的域名</Text></View><Text style={[styles.current, { color: p.muted }]}>当前地址：{API_BASE_URL || '未配置'}</Text></View></ScreenCenter>;
}

const styles = StyleSheet.create({ wrap: { width: '100%', maxWidth: 480, alignItems: 'center', gap: 14 }, icon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 24, lineHeight: 31, fontWeight: '800', textAlign: 'center' }, detail: { fontSize: 15, lineHeight: 23, textAlign: 'center' }, command: { width: '100%', borderRadius: 14, padding: 16 }, commandText: { fontSize: 14, lineHeight: 21 }, current: { fontSize: 12, textAlign: 'center' } });
