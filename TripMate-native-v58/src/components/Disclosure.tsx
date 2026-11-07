import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePalette } from '../theme';

export function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const p = usePalette();
  const [expanded, setExpanded] = useState(false);
  return <View style={[styles.section, { borderColor: p.border }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.trigger}>
      <Text style={[styles.title, { color: p.text }]}>{title}</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={p.muted} />
    </Pressable>
    {expanded ? <View style={styles.content}>{children}</View> : null}
  </View>;
}
const styles = StyleSheet.create({ section: { borderTopWidth: StyleSheet.hairlineWidth }, trigger: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { flex: 1, fontSize: 15, fontWeight: '600' }, content: { paddingBottom: 14, gap: 12 } });
