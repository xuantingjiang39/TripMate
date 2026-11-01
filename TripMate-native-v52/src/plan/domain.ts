import type { AccountState, Plan, PlanDay, SavedTrip } from '../types';

export function isPlan(value: unknown): value is Plan {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as Plan).days));
}

export function decodeAccountSnapshot(value: unknown): { state: AccountState; stateVersion: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('服务器同步数据不完整，当前行程未更改。');
  const result = value as Record<string, unknown>;
  const state = result.state;
  const version = result.stateVersion;
  if (!state || typeof state !== 'object' || Array.isArray(state) || result.ok === false
    || typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
    throw new Error('服务器同步数据不完整，当前行程未更改。');
  }
  // A genuinely empty state is valid; an omitted state is not an empty account.
  return { state: state as AccountState, stateVersion: version };
}

export function decodeWriteReceipt(value: unknown, previousVersion: number): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('服务器未确认保存版本，更改仍保留为待同步。');
  const result = value as Record<string, unknown>;
  const version = result.stateVersion;
  if (result.ok === false || typeof version !== 'number' || !Number.isSafeInteger(version) || version !== previousVersion + 1) {
    throw new Error('服务器未确认保存版本，更改仍保留为待同步。');
  }
  return version;
}

function stableJson(value: unknown) {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
  });
}

export function planKey(plan: Plan) {
  // Compare the full saved content, including recommendations, booking links,
  // transport and advice. A billing balance is not a change to the trip itself.
  const { billing: _billing, ...content } = plan;
  return stableJson(content);
}

export function scheduleKey(plan: Plan) {
  // Hotel/advice changes should not reset the selected day or live navigation.
  return stableJson(plan.days);
}

export function savedTrips(state: AccountState): SavedTrip[] {
  const raw = state['tripmate.v1.trips'];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index) => {
    if (isPlan(item)) return [{ id: `legacy-${index}`, savedAt: '', plan: item }];
    if (item && typeof item === 'object' && isPlan((item as SavedTrip).plan)) {
      const entry = item as SavedTrip;
      return [{ ...entry, id: String(entry.id || `saved-${index}`) }];
    }
    return [];
  });
}

export type PlanOperation = { kind: 'open' | 'save'; plan: Plan; id: string; savedAt: string };

// Merge only the user's plan action into the newest account snapshot.
// Keep web orders, preferences, credits and unknown archive entries intact.
export function applyPlanOperation(state: AccountState, operation: PlanOperation): AccountState {
  const next = { ...state };
  const archives: unknown[] = Array.isArray(state['tripmate.v1.trips']) ? [...state['tripmate.v1.trips']] : [];
  const add = (plan: Plan, suffix: string) => {
    if (!savedTrips({ 'tripmate.v1.trips': archives }).some(item => planKey(item.plan) === planKey(plan))) {
      archives.unshift({ id: `${operation.id}${suffix}`, savedAt: operation.savedAt, plan });
    }
  };
  if (operation.kind === 'open') {
    const previous = state['tripmate.v1.draft'];
    if (isPlan(previous) && planKey(previous) !== planKey(operation.plan)) add(previous, '-previous');
    next['tripmate.v1.draft'] = operation.plan;
  } else add(operation.plan, '');
  if (archives.length) next['tripmate.v1.trips'] = archives;
  return next;
}

export function todayDayIndex(days: PlanDay[], now = new Date()) {
  const found = days.findIndex(item => {
    const text = item.date || '';
    const full = text.match(/(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})(?:日)?/);
    const short = text.match(/(?:^|\s)(\d{1,2})[-/月.](\d{1,2})(?:日)?/);
    if (!full && !short) return false;
    const year = full ? Number(full[1]) : now.getFullYear();
    const month = Number(full ? full[2] : short?.[1]);
    const date = Number(full ? full[3] : short?.[2]);
    return year === now.getFullYear() && month === now.getMonth() + 1 && date === now.getDate();
  });
  return found < 0 ? 0 : found;
}

export function safeWebUrl(value?: string) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return /^https?:$/.test(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : '';
  } catch { return ''; }
}

export function formatMoney(value: unknown, currency = 'CNY') {
  if (value === undefined || value === null || value === '' || !Number.isFinite(Number(value))) return '待核实';
  const symbol = /^(CNY|RMB|人民币|元|¥)$/i.test(currency) ? '¥' : `${currency} `;
  return `${symbol}${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

export function planText(plan: Plan) {
  const lines = [plan.title, plan.summary || ''];
  for (const day of plan.days) {
    lines.push('', [day.day, day.date, day.city].filter(Boolean).join(' · '));
    for (const event of day.events || []) lines.push(event.name, event.note || '');
    if (day.stayArea) lines.push(`住宿区域：${day.stayArea}`);
  }
  for (const leg of plan.transportLegs || []) lines.push(`${leg.day || ''} ${leg.from || ''} → ${leg.to || ''} · ${leg.mode || ''}`, leg.route || '', leg.costDetail || '', leg.booking || '');
  for (const item of [...(plan.recommendations?.hotels || []), ...(plan.recommendations?.restaurants || [])]) {
    lines.push('', item.name, item.area || '', item.costDetail || '', item.sourceName || '', safeWebUrl(item.sourceUrl));
  }
  lines.push('', `预算：${formatMoney(plan.budget?.total, plan.budget?.currency)}`, plan.advice || '');
  return lines.filter(Boolean).join('\n');
}
