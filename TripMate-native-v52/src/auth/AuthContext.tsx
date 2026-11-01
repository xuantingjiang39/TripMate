import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import type { Guest, User } from '../types';

const SESSION_KEY = 'tripmate.native.session';
const GUEST_KEY = 'tripmate.native.guest';
const USER_KEY = 'tripmate.native.user';

async function credentialBatch(tasks: Promise<unknown>[]) {
  // Do not release the write queue on the first failed key while another
  // native write from this batch is still running.
  const results = await Promise.allSettled(tasks);
  const failure = results.find(result => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}

type AuthValue = {
  loading: boolean;
  user: User | null;
  guest: Guest | null;
  token: string | null;
  guestToken: string | null;
  connectionMessage: string;
  login(email: string, password: string): Promise<void>;
  sendCode(email: string): Promise<number>;
  register(input: { email: string; name: string; password: string; verificationCode: string }): Promise<void>;
  enterGuest(): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState('');
  const operation = useRef(0);
  const credentialWrites = useRef<Promise<void>>(Promise.resolve());
  const isCurrent = useCallback((id: number) => id === operation.current, []);

  // A write already started by the OS cannot be cancelled. Queue all credential
  // writes so a newer login always commits after older in-flight writes finish.
  const writeCredentials = useCallback((id: number, update: () => Promise<unknown>) => {
    const task = credentialWrites.current.then(async () => {
      if (!isCurrent(id)) return false;
      await update();
      return isCurrent(id);
    });
    credentialWrites.current = task.then(() => undefined, () => undefined);
    return task;
  }, [isCurrent]);

  const clear = useCallback(async (id: number) => {
    const applied = await writeCredentials(id, () => credentialBatch([SecureStore.deleteItemAsync(SESSION_KEY), SecureStore.deleteItemAsync(GUEST_KEY), SecureStore.deleteItemAsync(USER_KEY)]));
    if (!applied) return false;
    setToken(null); setGuestToken(null); setUser(null); setGuest(null);
    setConnectionMessage('');
    return true;
  }, [writeCredentials]);

  const refresh = useCallback(async () => {
    const id = ++operation.current;
    try {
      await credentialWrites.current;
      if (!isCurrent(id)) return;
      const [storedToken, storedGuest, cached] = await Promise.all([
        SecureStore.getItemAsync(SESSION_KEY), SecureStore.getItemAsync(GUEST_KEY), SecureStore.getItemAsync(USER_KEY),
      ]);
      if (!isCurrent(id)) return;
      if (storedToken) {
        try {
          const result = await api<{ user: User }>('/api/auth/me', { token: storedToken, timeoutMs: 10_000 });
          if (!isCurrent(id)) return;
          if (!result.user?.id) throw new ApiError('账号信息未完整返回，请稍后重试。', 502);
          if (!await writeCredentials(id, () => SecureStore.setItemAsync(USER_KEY, JSON.stringify({ token: storedToken, user: result.user })))) return;
          setToken(storedToken); setUser(result.user); setGuest(null); setGuestToken(null); setConnectionMessage('');
        } catch (caught) {
          if (!isCurrent(id)) return;
          if (caught instanceof ApiError && caught.status === 401) {
            if (await clear(id)) setConnectionMessage('登录已过期，请重新登录。');
          } else {
            let profile: { token?: string; user?: User } | null = null;
            try { profile = cached ? JSON.parse(cached) : null; } catch {}
            if (profile?.token === storedToken && profile.user?.id) {
              setToken(storedToken); setUser(profile.user); setGuest(null); setGuestToken(null);
              setConnectionMessage('当前网络不可用，已保留登录并打开本机保存的行程。');
            } else setConnectionMessage('暂时无法验证登录，请恢复网络后重试。手机中的登录凭证已保留。');
          }
        }
        return;
      }
      if (storedGuest) {
        const result = await api<Guest>('/api/auth/guest', { guestToken: storedGuest });
        if (!isCurrent(id)) return;
        setGuestToken(storedGuest); setGuest(result); setUser(null); setToken(null);
        return;
      }
    } catch {
      if (isCurrent(id)) setConnectionMessage('暂时无法读取账号，请检查网络后重试。');
    } finally {
      if (isCurrent(id)) setLoading(false);
    }
  }, [clear, isCurrent, writeCredentials]);

  useEffect(() => { void refresh(); return () => { operation.current += 1; }; }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const id = ++operation.current;
    try {
    const result = await api<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    if (!isCurrent(id)) return;
    if (!result.token || !result.user?.id) throw new ApiError('登录结果不完整，请稍后重试。', 502);
    if (!await writeCredentials(id, () => credentialBatch([SecureStore.setItemAsync(SESSION_KEY, result.token), SecureStore.setItemAsync(USER_KEY, JSON.stringify({ token: result.token, user: result.user })), SecureStore.deleteItemAsync(GUEST_KEY)]))) return;
    setConnectionMessage('');
    setToken(result.token); setUser(result.user); setGuest(null); setGuestToken(null);
    } catch (caught) { if (isCurrent(id)) throw caught; }
    finally { if (isCurrent(id)) setLoading(false); }
  }, [isCurrent, writeCredentials]);

  const sendCode = useCallback(async (email: string) => {
    const result = await api<{ expiresIn: number }>('/api/auth/send-code', {
      method: 'POST', body: JSON.stringify({ email }),
    });
    return result.expiresIn;
  }, []);

  const register = useCallback(async (input: { email: string; name: string; password: string; verificationCode: string }) => {
    const id = ++operation.current;
    try {
    const result = await api<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST', guestToken, body: JSON.stringify(input),
    });
    if (!isCurrent(id)) return;
    if (!result.token || !result.user?.id) throw new ApiError('注册结果不完整，请稍后重试。', 502);
    if (!await writeCredentials(id, () => credentialBatch([SecureStore.setItemAsync(SESSION_KEY, result.token), SecureStore.setItemAsync(USER_KEY, JSON.stringify({ token: result.token, user: result.user })), SecureStore.deleteItemAsync(GUEST_KEY)]))) return;
    setConnectionMessage('');
    setToken(result.token); setUser(result.user); setGuest(null); setGuestToken(null);
    } catch (caught) { if (isCurrent(id)) throw caught; }
    finally { if (isCurrent(id)) setLoading(false); }
  }, [guestToken, isCurrent, writeCredentials]);

  const enterGuest = useCallback(async () => {
    const id = ++operation.current;
    try {
    await credentialWrites.current;
    if (!isCurrent(id)) return;
    const savedToken = await SecureStore.getItemAsync(GUEST_KEY);
    if (!isCurrent(id)) return;
    const result = await api<Guest & { token?: string }>('/api/auth/guest', { method: savedToken ? 'GET' : 'POST', guestToken: savedToken, ...(savedToken ? {} : { body: '{}' }) });
    const nextToken = result.token || savedToken;
    if (!isCurrent(id)) return;
    if (!nextToken) throw new Error('游客凭证未返回，请稍后重试。');
    if (!await writeCredentials(id, () => credentialBatch([SecureStore.setItemAsync(GUEST_KEY, nextToken), SecureStore.deleteItemAsync(SESSION_KEY), SecureStore.deleteItemAsync(USER_KEY)]))) return;
    setConnectionMessage('');
    setGuestToken(nextToken); setGuest(result); setToken(null); setUser(null);
    } catch (caught) { if (isCurrent(id)) throw caught; }
    finally { if (isCurrent(id)) setLoading(false); }
  }, [isCurrent, writeCredentials]);

  const logout = useCallback(async () => {
    const id = ++operation.current;
    // Immediately invalidate in-flight validation/login responses and clear the
    // local identity before waiting for network revocation of the old token.
    const oldToken = token;
    if (!await clear(id)) return;
    if (isCurrent(id)) setLoading(false);
    try {
      if (oldToken) await api('/api/auth/logout', { method: 'POST', body: '{}', token: oldToken, timeoutMs: 10_000 });
    } catch {
      // Local sign-out must still finish when the network is unavailable.
    }
  }, [clear, isCurrent, token]);

  const value = useMemo(() => ({ loading, user, guest, token, guestToken, connectionMessage, login, sendCode, register, enterGuest, logout, refresh }),
    [loading, user, guest, token, guestToken, connectionMessage, login, sendCode, register, enterGuest, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
