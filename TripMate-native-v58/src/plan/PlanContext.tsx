import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, errorMessage } from '../api';
import { useAuth } from '../auth/AuthContext';
import type { AccountState, Plan } from '../types';
import { applyPlanOperation, decodeAccountSnapshot, decodeWriteReceipt, isPlan, scheduleKey, todayDayIndex, type PlanOperation } from './domain';
import { readOffline, writeOffline } from './offline';

type PlanValue = {
  loading: boolean; saving: boolean; generating: boolean; offline: boolean;
  syncMessage: string; pendingCount: number; plan: Plan | null; state: AccountState;
  dayIndex: number; selectDay(index: number): void;
  refresh(): Promise<void>;
  openPlan(plan: Plan): Promise<void>;
  savePlan(): Promise<void>;
  generate(request: string): Promise<Plan>;
  estimate(request: string): Promise<{ cost: number; balance: number; enough: boolean; unlimited?: boolean }>;
};
const PlanContext = createContext<PlanValue | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { user, guest, token, guestToken } = useAuth();
  const owner = user?.id || (guestToken ? `guest:${guestToken}` : '');
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  useEffect(() => () => { ownerRef.current = ''; }, []);
  const snapshot = useRef<{ state: AccountState; version: number; pending: PlanOperation[] }>({ state: {}, version: 0, pending: [] });
  const [state, setState] = useState<AccountState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [offline, setOffline] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [cacheWarning, setCacheWarning] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);
  const syncLock = useRef(false);
  const generationLock = useRef(false);
  const plan = isPlan(state['tripmate.v1.draft']) ? state['tripmate.v1.draft'] : null;
  const key = plan ? scheduleKey(plan) : '';
  useEffect(() => { setDayIndex(todayDayIndex(plan?.days || [])); }, [key]);

  const publish = useCallback((next: typeof snapshot.current, expectedOwner: string) => {
    if (ownerRef.current !== expectedOwner) return;
    snapshot.current = next;
    setState(next.state); setPendingCount(next.pending.length);
    if (user?.id) {
      const saved = writeOffline({ owner: user.id, ...next, savedAt: new Date().toISOString() });
      setCacheWarning(saved ? '' : '离线保存未完成，请检查手机存储空间后重试同步。未同步的更改请保持当前页面，联网同步后再退出。');
    }
  }, [user?.id]);

  const refresh = useCallback(async () => {
    if (syncLock.current) return;
    const expectedOwner = owner;
    syncLock.current = true; setSaving(true);
    try {
      if (user && token) {
        let remote = decodeAccountSnapshot(await api<unknown>('/api/account/state', { token }));
        if (ownerRef.current !== expectedOwner) return;
        while (snapshot.current.pending.length) {
          const operation = snapshot.current.pending[0];
          let next = applyPlanOperation(remote.state || {}, operation);
          try {
            const result = await api<unknown>('/api/account/state', {
              method: 'PUT', token, body: JSON.stringify({ state: next, stateVersion: remote.stateVersion }),
            });
            if (ownerRef.current !== expectedOwner) return;
            remote = { state: next, stateVersion: decodeWriteReceipt(result, remote.stateVersion) };
          } catch (caught) {
            if (!(caught instanceof ApiError) || caught.status !== 409) throw caught;
            remote = decodeAccountSnapshot(await api<unknown>('/api/account/state', { token }));
            if (ownerRef.current !== expectedOwner) return;
            next = applyPlanOperation(remote.state || {}, operation);
            const retried = await api<unknown>('/api/account/state', {
              method: 'PUT', token, body: JSON.stringify({ state: next, stateVersion: remote.stateVersion }),
            });
            if (ownerRef.current !== expectedOwner) return;
            remote = { state: next, stateVersion: decodeWriteReceipt(retried, remote.stateVersion) };
          }
          const pending = snapshot.current.pending.slice(1);
          const visible = pending.reduce(applyPlanOperation, remote.state);
          publish({ state: visible, version: remote.stateVersion, pending }, expectedOwner);
        }
        publish({ state: remote.state || {}, version: remote.stateVersion || 0, pending: [] }, expectedOwner);
        setOffline(false); setSyncMessage('');
      } else if (guest && guestToken) {
        const result = await api<{ preview?: Plan | null }>('/api/auth/guest', { guestToken });
        if (ownerRef.current !== expectedOwner) return;
        if (result.preview) publish({ state: { 'tripmate.v1.draft': result.preview }, version: 0, pending: [] }, expectedOwner);
      }
    } catch (caught) {
      if (ownerRef.current !== expectedOwner) return;
      setOffline(true);
      setSyncMessage(snapshot.current.pending.length
        ? '当前页面仍保留行程，尚未同步。恢复网络后点“重试同步”，无需重新生成。'
        : `${errorMessage(caught, '暂时无法同步。')} 已加载的行程仍可继续查看。`);
    } finally {
      syncLock.current = false;
      if (ownerRef.current === expectedOwner) { setLoading(false); setSaving(false); }
    }
  }, [owner, guest, guestToken, publish, token, user]);

  useEffect(() => {
    snapshot.current = { state: {}, version: 0, pending: [] };
    setState({}); setPendingCount(0); setLoading(true); setSyncMessage(''); setCacheWarning(''); setDayIndex(0);
    const cached = user?.id ? readOffline(user.id) : null;
    if (cached) {
      publish(cached, owner); setLoading(false); setOffline(true);
    } else if (guest?.preview) {
      publish({ state: { 'tripmate.v1.draft': guest.preview }, version: 0, pending: [] }, owner);
    }
    void refresh();
  }, [owner, publish, refresh]);

  const queuePlan = useCallback(async (value: Plan, kind: PlanOperation['kind']) => {
    if (!isPlan(value)) throw new Error('行程数据不完整，未更改当前行程。');
    const operation: PlanOperation = { kind, plan: value, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, savedAt: new Date().toISOString() };
    if (!user) {
      publish({ ...snapshot.current, state: { 'tripmate.v1.draft': value } }, owner);
      return;
    }
    publish({ ...snapshot.current, state: applyPlanOperation(snapshot.current.state, operation), pending: [...snapshot.current.pending, operation] }, owner);
    await refresh();
  }, [owner, publish, refresh, user]);

  const generate = useCallback(async (request: string) => {
    if (generationLock.current) throw new Error('已有一次行程正在生成，请等待完成。');
    generationLock.current = true; setGenerating(true);
    const expectedOwner = owner;
    try {
      const result = await api<Plan>('/api/plan', { method: 'POST', token, guestToken, body: JSON.stringify({ request }) });
      if (ownerRef.current !== expectedOwner) throw new Error('账号已经切换，请回到原账号查看生成结果。');
      if (!isPlan(result) || !result.days.length) throw new Error('未取得完整行程，原行程已保留。');
      await queuePlan(result, 'open');
      return result;
    } finally { generationLock.current = false; setGenerating(false); }
  }, [owner, token, guestToken, queuePlan]);
  const estimate = useCallback((request: string) => api<{ cost: number; balance: number; enough: boolean; unlimited?: boolean }>('/api/credits/estimate', {
    method: 'POST', token, guestToken, body: JSON.stringify({ request }),
  }), [token, guestToken]);
  const openPlan = useCallback((value: Plan) => queuePlan(value, 'open'), [queuePlan]);
  const savePlan = useCallback(async () => { if (plan) await queuePlan(plan, 'save'); }, [plan, queuePlan]);
  const selectDay = useCallback((index: number) => { if (plan && index >= 0 && index < plan.days.length) setDayIndex(index); }, [plan]);
  const value = useMemo(() => ({ loading, saving, generating, offline, syncMessage: [cacheWarning, syncMessage].filter(Boolean).join('\n'), pendingCount, plan, state, dayIndex, selectDay, refresh, generate, estimate, openPlan, savePlan }),
    [loading, saving, generating, offline, cacheWarning, syncMessage, pendingCount, plan, state, dayIndex, selectDay, refresh, generate, estimate, openPlan, savePlan]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const value = useContext(PlanContext);
  if (!value) throw new Error('usePlan must be used inside PlanProvider');
  return value;
}
