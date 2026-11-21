import { isIP } from 'node:net';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// Nginx overwrites X-Real-IP with $remote_addr. Trust it only on the local
// proxy connection; direct requests must use their actual TCP peer address.
export function clientAddress(req) {
  const peer = String(req?.socket?.remoteAddress || '').trim();
  if (LOOPBACK.has(peer)) {
    const proxyAddress = String(req?.headers?.['x-real-ip'] || '').trim();
    if (isIP(proxyAddress)) return proxyAddress;
  }
  return peer || 'unknown';
}
