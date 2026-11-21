import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

// Only these public, versioned installers are exposed. No directory listing or user files.
export const installers = new Map([
  ['TripMate-v58-android-v1.1.5.apk', {size: 40748734, sha256: '69a3a085d9382a5f474fa20aa2b7c6199043042fee348aa97b081295c9a48ee8', type: 'application/vnd.android.package-archive'}],
  ['TripMate-v54-Windows-1.0.1-Setup.exe', {size: 123905803, sha256: '6a56e6d98b490e692d30b9dcba647e10542de06b485159f07be1948eda595178', type: 'application/octet-stream'}]
]);

export async function serveInstaller(req, res, requestPath, directory) {
  if (!requestPath.startsWith('/downloads/')) return false;
  const name = requestPath.slice('/downloads/'.length);
  const entry = installers.get(name);
  const reply = (status, text, headers = {}) => {
    res.writeHead(status, {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers});
    res.end(req.method === 'HEAD' ? '' : text);
    return true;
  };
  if (!entry) return reply(404, '没有这个安装文件。');
  if (!['GET', 'HEAD'].includes(req.method)) return reply(405, '请使用下载链接访问。', {allow: 'GET, HEAD'});
  let file;
  try {
    file = await open(join(directory, name), 'r');
    const info = await file.stat();
    if (!info.isFile() || info.size !== entry.size) throw new Error('Incomplete installer');
  } catch {
    await file?.close();
    return reply(503, '安装包暂未准备好，请稍后重试或联系管理员。', {'retry-after': '60'});
  }
  try {
    const etag = `"${entry.sha256}"`;
    let start = 0, end = entry.size - 1, partial = false;
    const range = req.headers.range;
    if (range && (!req.headers['if-range'] || req.headers['if-range'] === etag)) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match && (match[1] || match[2])) {
        if (match[1]) {
          start = Number(match[1]);
          end = match[2] ? Math.min(Number(match[2]), entry.size - 1) : entry.size - 1;
        } else {
          const suffix = Number(match[2]);
          start = Math.max(0, entry.size - suffix);
        }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= entry.size) {
          return reply(416, '下载范围无效，请重新开始下载。', {'content-range': `bytes */${entry.size}`});
        }
        partial = true;
      }
      // Unsupported or malformed range syntax is ignored; a full download remains valid.
    }
    res.writeHead(partial ? 206 : 200, {
      'content-type': entry.type,
      'content-disposition': `attachment; filename="${name}"`,
      'content-length': end - start + 1,
      'accept-ranges': 'bytes',
      'etag': etag,
      'cache-control': 'public, max-age=86400, immutable',
      'x-content-type-options': 'nosniff',
      ...(partial ? {'content-range': `bytes ${start}-${end}/${entry.size}`} : {})
    });
    if (req.method === 'HEAD') { res.end(); return true; }
    await pipeline(file.createReadStream({start, end}), res);
    return true;
  } finally {
    await file.close();
  }
}
