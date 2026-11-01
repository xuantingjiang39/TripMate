'use strict';
const SERVER = 'https://111.230.133.155';
const SHELL = 'tripmate-desktop://app/';
function parseURL(value) {
  try { return new URL(value); } catch { return null; }
}
function isWorkspaceURL(value) {
  const url = parseURL(value);
  return Boolean(url && url.origin === SERVER && !url.username && !url.password);
}
function isShellURL(value) {
  const url = parseURL(value);
  return Boolean(url && url.protocol === 'tripmate-desktop:' && url.host === 'app' && url.pathname === '/index.html' && !url.username && !url.password);
}
function externalURL(value) {
  const url = parseURL(value);
  if (!url || url.username || url.password || String(value).length > 8192) return null;
  if (url.protocol === 'https:') return url.href;
  // Old travel links sometimes use HTTP. Open their HTTPS equivalent in the browser.
  if (url.protocol === 'http:') { url.protocol = 'https:'; return url.href; }
  return null;
}
function failureMessage(code) {
  if ([-200, -201, -202, -203, -204, -205, -206, -207, -208, -209, -210, -211, -212, -213, -214, -215, -216, -217, -218, -219, -220, -221].includes(code)) {
    return '服务器的安全证书未通过验证。请检查电脑日期和时间；若时间正确，请联系 TripMate 更新证书。';
  }
  if (code === -106) return '电脑当前没有联网。连接网络后，点击“重新连接”。';
  if (code === -7 || code === -118) return '连接服务器超时。请检查网络，稍后重新连接。';
  return '暂时无法连接 TripMate 服务器。请检查网络，或稍后重新连接。';
}
module.exports = { SERVER, SHELL, isWorkspaceURL, isShellURL, externalURL, failureMessage };
