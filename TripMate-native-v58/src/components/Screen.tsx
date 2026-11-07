import React from 'react';
import { RefreshControl, ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '../theme';

export function Screen({ children, refreshing, onRefresh, contentContainerStyle, ...props }: ScrollViewProps & {
  refreshing?: boolean; onRefresh?: () => void;
}) {
  const p = usePalette();
  return <SafeAreaView edges={['left', 'right']} style={[styles.safe, { backgroundColor: p.background }]}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={p.primary} /> : undefined}
      contentContainerStyle={[styles.content, contentContainerStyle]} {...props}>{children}</ScrollView>
  </SafeAreaView>;
}

export function ScreenCenter({ children }: { children: React.ReactNode }) {
  const p = usePalette();
  return <SafeAreaView style={[styles.safe, styles.center, { backgroundColor: p.background }]}><View>{children}</View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1 }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 18, paddingBottom: 42, gap: 20 }, center: { alignItems: 'center', justifyContent: 'center', padding: 24 } });
