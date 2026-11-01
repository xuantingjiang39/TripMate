import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { serverConfigured } from './src/api';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { ScreenCenter } from './src/components/Screen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { PlanProvider } from './src/plan/PlanContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { usePalette } from './src/theme';

function AppGate() {
  const p = usePalette();
  const { loading, user, guest } = useAuth();
  if (!serverConfigured) return <SetupScreen />;
  if (loading) return <ScreenCenter><ActivityIndicator size="large" color={p.primary} /><Text style={[styles.loading, { color: p.muted }]}>正在安全登录…</Text></ScreenCenter>;
  if (!user && !guest) return <AuthScreen />;
  const base = p.dark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: p.primary, background: p.background, card: p.surface, text: p.text, border: p.border, notification: p.error } };
  return <PlanProvider key={user?.id || 'guest'}><NavigationContainer theme={theme}><RootNavigator /></NavigationContainer></PlanProvider>;
}

export default function App() {
  return <SafeAreaProvider><AuthProvider><StatusBar style="auto" /><AppGate /></AuthProvider></SafeAreaProvider>;
}

const styles = StyleSheet.create({ loading: { marginTop: 12, fontSize: 14 } });
