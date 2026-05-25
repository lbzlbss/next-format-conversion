/** 序列帧 ZIP / VAP 转换上传上限（与 next.config proxyClientMaxBodySize 对齐） */
import { detectArchiveKind, findZipMagicOffset, invalidZipUserMessage } from './zip-sniff.js';

export const ASSET_ZIP_MAX_BYTES = 600 * 1024 * 1024;

/** 超过此大小使用 Vercel Blob multipart 直传（官方建议 >100MB） */
export const BLOB_MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024;

const LOCAL_SNIFF_BYTES = 262144;

export function formatBytes(n) {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

/**
 * 浏览器端校验：扫描文件头，识别 ZIP / RAR / 7z 等
 * @param {File} file
 */
export async function assertLocalZipFile(file) {
  if (!file || file.size === 0) {
    throw new Error('文件为空，请选择包含序列帧的 .zip');
  }

  const probeLen = Math.min(file.size, LOCAL_SNIFF_BYTES);
  const chunk = await file.slice(0, probeLen).arrayBuffer();
  const bytes = new Uint8Array(chunk);

  if (findZipMagicOffset(bytes) >= 0) return;

  const kind = detectArchiveKind(bytes);
  throw new Error(invalidZipUserMessage(kind, file.name));
}

export function safeZipBlobPathname(originalName) {
  const stem = String(originalName || 'asset')
    .replace(/\.zip$/i, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 48);
  return `asset-seq/${Date.now()}-${stem || 'frames'}.zip`;
}
