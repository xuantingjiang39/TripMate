import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const API_BASE_URL = String(Constants.expoConfig?.extra?.apiBaseUrl || '').replace(/\/+$/, '');
export const serverConfigured = /^https:\/\//.test(API_BASE_URL) && !/example\.com/i.test(API_BASE_URL);

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status = 0, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
    this.status = status;
    this.data = data;
  }
}

export function errorMessage(caught: unknown, fallback = '发生未知错误。') {
  const message = caught instanceof Error && caught.message
    ? caught.message
    : caught && typeof caught === 'object' && 'message' in caught
      ? String((caught as { message?: unknown }).message || fallback)
      : typeof caught === 'string' && caught
        ? caught
        : fallback;
  if (/Unexpected char|NativeRequest\.start|IllegalArgumentException/i.test(message)) {
    return '请求格式异常，请更新 TripMate 后重试。';
  }
  return message;
}

export async function diagnoseConnection(): Promise<string> {
  if (!serverConfigured) return `配置错误：没有可用的 HTTPS 服务器地址（${API_BASE_URL || '空'}）。`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  const started = Date.now();
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'x-tripmate-client': 'native',
        'x-tripmate-platform': Platform.OS,
      },
    });
    const elapsed = Date.now() - started;
    if (response.status === 404) return `HTTPS 已连接（${elapsed} 毫秒），但服务器版本过旧，需安装 TripMate v41 服务端。`;
    if (!response.ok) return `HTTPS 已连接（${elapsed} 毫秒），服务器健康检查返回 HTTP ${response.status}。`;
    const data = await response.json().catch(() => ({})) as { ok?: boolean; version?: string };
    return data.ok
      ? `连接正常：${data.version || 'TripMate 服务'}，耗时 ${elapsed} 毫秒。`
      : `HTTPS 已连接（${elapsed} 毫秒），但服务器健康状态异常。`;
  } catch (caught) {
    const detail = errorMessage(caught, '没有返回详细原因');
    return `HTTPS 连接失败：${detail}\n服务器：${API_BASE_URL}\n请确认手机日期时间为自动，并先用手机浏览器打开该地址。`;
  } finally {
    clearTimeout(timer);
  }
}

type RequestOptions = RequestInit & { token?: string | null; guestToken?: string | null; timeoutMs?: number };

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!serverConfigured) throw new ApiError('TripMate App 尚未绑定正式 HTTPS 服务器。');
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-tripmate-client': 'native',
    'x-tripmate-platform': Platform.OS,
    // HTTP header values must stay ASCII-safe on Android's native networking stack.
    'x-tripmate-device': Platform.OS === 'ios' ? 'iphone-ipad' : 'android-phone-tablet',
    ...((options.headers || {}) as Record<string, string>),
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.guestToken) headers['x-tripmate-guest-token'] = options.guestToken;
  const { token: _token, guestToken: _guestToken, timeoutMs = path === '/api/plan' ? 240_000 : 25_000, signal, ...fetchOptions } = options;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...fetchOptions, signal: controller.signal, headers });
    const raw = await response.text();
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw); }
    catch { throw new ApiError('服务器没有返回完整数据，请稍后重试。', response.ok ? 502 : response.status); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError('服务器返回的数据格式不正确。', 502);
    if (!response.ok) throw new ApiError(String(data.error || `请求失败（${response.status}）`), response.status, data);
    return data as T;
  } catch (caught) {
    if (caught instanceof ApiError) throw caught;
    if (controller.signal.aborted) throw new ApiError(path === '/api/plan'
      ? '本次等待已超时。请先刷新行程和额度，确认服务器结果后再生成，避免重复请求。'
      : '连接超时，请检查网络后重试。');
    const detail = errorMessage(caught, '');
    if (detail.includes('请求格式异常')) throw new ApiError(detail);
    throw new ApiError(`暂时无法连接 TripMate。请检查网络后重试${detail ? `（${detail}）` : '。'}`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
