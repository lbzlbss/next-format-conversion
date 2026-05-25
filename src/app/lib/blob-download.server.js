import { ApiError } from '../api/_lib/guard.js';
import { validateZipBuffer } from './zip-extract.server.js';

const VERCEL_BLOB_HOST_RE = /(?:^|\.)((?:public\.)?blob\.vercel-storage\.com|vercel-storage\.com)$/i;

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

function detectNonZipKind(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0x52 && buf[1] === 0x61 && buf[2] === 0x72 && buf[3] === 0x21) return 'RAR';
  if (buf[0] === 0x37 && buf[1] === 0x7a && buf[2] === 0xbc && buf[3] === 0xaf) return '7Z';
  if (buf[0] === 0x1f && buf[1] === 0x8b) return 'GZIP';
  const text = buf.slice(0, 80).toString('utf8');
  if (text.trimStart().startsWith('{') || text.trimStart().startsWith('[')) return 'JSON';
  if (text.trimStart().startsWith('<')) return 'HTML';
  return null;
}

async function readFirstBytes(url, n = 4) {
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
  const isPk = head[0] === 0x50 && head[1] === 0x4b;
  if (isPk) return downloadUrl;

  const kind = detectNonZipKind(head);
  if (kind === 'HTML' || kind === 'JSON') {
    throw new ApiError(
      'BLOB_FETCH_FAILED',
      'Blob 链接返回的是网页/JSON 而非 ZIP 文件。请重新上传，或等待部署更新后重试。',
      502,
      { sniff: head.toString('hex').slice(0, 32) },
    );
  }
  if (kind) {
    throw new ApiError(
      'INVALID_FORMAT',
      `文件格式为 ${kind}，请上传标准 .zip 压缩包（非分卷、非 RAR/7z）`,
      400,
    );
  }
  throw new ApiError(
    'INVALID_FORMAT',
    '不是有效的 ZIP 文件（缺少 PK 文件头）。请确认上传完成且文件未损坏。',
    400,
    { sniff: head.toString('hex').slice(0, 32) },
  );
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
    throw new ApiError('BLOB_FETCH_FAILED', `下载 Blob 失败 (${res.status})`, 502);
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
