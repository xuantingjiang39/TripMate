import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View,
} from 'react-native';
import { Palette, usePalette } from '../theme';

export function PrimaryButton({ label, onPress, disabled, icon, busy, tone = 'primary' }: {
  label: string; onPress(): void; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap; busy?: boolean; tone?: 'primary' | 'route';
}) {
  const p = usePalette();
  const fill = tone === 'route' ? p.route : p.primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: fill, opacity: disabled || busy ? .45 : pressed ? .78 : 1 }]}>
    {busy ? <ActivityIndicator color={p.onPrimary} /> : icon ? <Ionicons name={icon} size={20} color={p.onPrimary} /> : null}
    <Text style={[styles.buttonText, { color: p.onPrimary }]}>{label}</Text>
  </Pressable>;
}

export function SecondaryButton({ label, onPress, icon, disabled }: {
  label: string; onPress(): void; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean;
}) {
  const p = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.secondary, { borderColor: p.border, backgroundColor: pressed ? p.raised : p.surface, opacity: disabled ? .45 : 1 }]}>
    {icon ? <Ionicons name={icon} size={19} color={p.primary} /> : null}
    <Text style={[styles.secondaryText, { color: p.text }]}>{label}</Text>
  </Pressable>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const p = usePalette();
  return <View style={styles.fieldWrap}>
    <Text style={[styles.label, { color: p.text }]}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={p.muted}
      style={[styles.field, { color: p.text, backgroundColor: p.input, borderColor: error ? p.error : p.border }, props.multiline && styles.multiline]}
      {...props} />
    {error ? <Text accessibilityRole="alert" style={[styles.error, { color: p.error }]}>{error}</Text> : null}
  </View>;
}

export function StatusPill({ label, icon, tone = 'neutral' }: {
  label: string; icon?: keyof typeof Ionicons.glyphMap; tone?: 'neutral' | 'route' | 'warning';
}) {
  const p = usePalette();
  const color = tone === 'route' ? p.route : tone === 'warning' ? p.warning : p.muted;
  return <View style={[styles.pill, { backgroundColor: p.raised }]}>
    {icon ? <Ionicons name={icon} size={14} color={color} /> : null}
    <Text style={[styles.pillText, { color }]}>{label}</Text>
  </View>;
}

export function EmptyState({ icon, title, detail, action }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; action?: React.ReactNode;
}) {
  const p = usePalette();
  return <View style={styles.empty}>
    <View style={[styles.emptyIcon, { backgroundColor: p.raised }]}><Ionicons name={icon} size={28} color={p.primary} /></View>
    <Text style={[styles.emptyTitle, { color: p.text }]}>{title}</Text>
    <Text style={[styles.emptyDetail, { color: p.muted }]}>{detail}</Text>
    {action}
  </View>;
}

export function SectionTitle({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  const p = usePalette();
  return <View style={styles.sectionHead}><Text style={[styles.sectionTitle, { color: p.text }]}>{children}</Text>{trailing}</View>;
}

export function Divider() { const p = usePalette(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border }} />; }

export function surfaceStyle(p: Palette) { return { backgroundColor: p.surface, borderColor: p.border }; }

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: 14, paddingHorizontal: 20, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, lineHeight: 22, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  secondary: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  fieldWrap: { gap: 7 }, label: { fontSize: 14, fontWeight: '600' },
  field: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16 },
  multiline: { minHeight: 132, textAlignVertical: 'top' }, error: { fontSize: 13, lineHeight: 18 },
  pill: { minHeight: 28, borderRadius: 99, paddingHorizontal: 10, flexDirection: 'row', gap: 5, alignItems: 'center', alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  empty: { paddingVertical: 44, paddingHorizontal: 24, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 20, lineHeight: 27, fontWeight: '700', textAlign: 'center' },
  emptyDetail: { fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 8 },
  sectionHead: { minHeight: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionTitle: { fontSize: 20, lineHeight: 27, fontWeight: '700' },
});
