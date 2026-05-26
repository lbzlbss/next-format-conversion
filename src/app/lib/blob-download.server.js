import { ApiError } from '../api/_lib/guard.js';
import { detectArchiveKind, findZipMagicOffset, invalidZipUserMessage } from './zip-sniff.js';
import { validateZipBuffer } from './zip-extract.server.js';

const VERCEL_BLOB_HOST_RE = /(?:^|\.)((?:public\.)?blob\.vercel-storage\.com|vercel-storage\.com)$/i;

/** @param {number} status */
function blobFetchFailedError(status) {
  const hint =
    status === 404
      ? '临时 ZIP 不存在或已被清理。转换失败时 Blob 会保留可重试；若仍 404 请重新上传 ZIP'
      : `下载 Blob 失败 (${status})`;
  return new ApiError('BLOB_FETCH_FAILED', hint, 502, { status });
}

/**
 * Vercel Blob 的 url 可能是预览页；downloadUrl / ?download=1 才保证原始字节流
 * @param {string} blobUrl
 */
export function normalizeVercelBlobDownloadUrl(blobUrl) {
  const u = new URL(blobUrl);
  if (VERCEL_BLOB_HOST_RE.test(u.hostname) && !u.searchParams.has('download')) {
    u.searchParams.set('download', '1');
  }
  return u.toString();
}

async function readFirstBytes(url, n = 16) {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Range: `bytes=0-${n - 1}` },
    cache: 'no-store',
    redirect: 'follow',
  });

  if (res.status === 206 || res.ok) {
    const ab = await res.arrayBuffer();
    if (ab.byteLength > 0) return Buffer.from(ab);
  }

  const full = await fetch(url, { cache: 'no-store', redirect: 'follow' });
  if (!full.ok) {
    throw new ApiError('BLOB_FETCH_FAILED', `无法读取 Blob 内容 (${full.status})`, 502);
  }
  const slice = Buffer.from(await full.arrayBuffer()).subarray(0, n);
  return slice;
}

/**
 * 下载前探测是否为 ZIP（避免拉取 500MB 后才发现是 HTML）
 */
export async function assertRemoteZipProbe(blobUrl) {
  const downloadUrl = normalizeVercelBlobDownloadUrl(blobUrl);
  const head = await readFirstBytes(downloadUrl, 16);
  if (findZipMagicOffset(head) >= 0) return downloadUrl;

  const kind = detectArchiveKind(head);
  const message = invalidZipUserMessage(kind);
  const code = kind === 'HTML' || kind === 'JSON' ? 'BLOB_FETCH_FAILED' : 'INVALID_FORMAT';
  throw new ApiError(code, message, code === 'BLOB_FETCH_FAILED' ? 502 : 400, {
    sniff: Buffer.from(head).toString('hex').slice(0, 32),
  });
}

/**
 * @param {string} blobUrl
 * @param {number | null} expectedBytes
 * @param {(url: string, ms: number) => Promise<Response>} fetcher
 */
export async function downloadBlobZipBuffer(blobUrl, expectedBytes, fetcher) {
  const downloadUrl = await assertRemoteZipProbe(blobUrl);
  const timeoutMs =
    expectedBytes > 0
      ? Math.min(600_000, Math.max(120_000, Math.ceil((expectedBytes / (1024 * 1024)) * 3000)))
      : 120_000;

  const res = await fetcher(downloadUrl, timeoutMs);
  if (!res.ok) {
    throw blobFetchFailedError(res.status);
  }

  const ct = String(res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/json')) {
    throw new ApiError(
      'BLOB_FETCH_FAILED',
      'Blob 响应类型异常，未获取到二进制 ZIP。请重新上传。',
      502,
      { contentType: ct },
    );
  }

  const zipBuffer = Buffer.from(await res.arrayBuffer());
  validateZipBuffer(zipBuffer, expectedBytes || Number(res.headers.get('content-length') || 0) || null);
  return zipBuffer;
}

/**
 * 从 Blob 下载任意二进制（VAP/SVGA 等，不做 ZIP 校验）
 * @param {string} blobUrl
 * @param {number | null} expectedBytes
 * @param {(url: string, ms: number) => Promise<Response>} fetcher
 */
export async function downloadBlobBuffer(blobUrl, expectedBytes, fetcher) {
  const downloadUrl = normalizeVercelBlobDownloadUrl(blobUrl);
  const timeoutMs =
    expectedBytes > 0
      ? Math.min(600_000, Math.max(60_000, Math.ceil((expectedBytes / (1024 * 1024)) * 2000)))
      : 120_000;

  const res = await fetcher(downloadUrl, timeoutMs);
  if (!res.ok) {
    throw blobFetchFailedError(res.status);
  }

  const ct = String(res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/html')) {
    throw new ApiError('BLOB_FETCH_FAILED', 'Blob 响应为 HTML，未获取到文件内容', 502, { contentType: ct });
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (expectedBytes > 0 && buf.length !== expectedBytes) {
    throw new ApiError(
      'BLOB_FETCH_FAILED',
      `Blob 下载不完整：期望 ${expectedBytes} 字节，实际 ${buf.length} 字节`,
      502,
      { expectedBytes, actualBytes: buf.length },
    );
  }
  return buf;
}
