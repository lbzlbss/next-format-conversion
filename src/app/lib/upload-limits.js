/** 序列帧 ZIP / VAP 转换上传上限（与 next.config proxyClientMaxBodySize 对齐） */
export const ASSET_ZIP_MAX_BYTES = 600 * 1024 * 1024;

/** 超过此大小使用 Vercel Blob multipart 直传（官方建议 >100MB） */
export const BLOB_MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024;

export function formatBytes(n) {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

/** 避免中文/特殊字符 pathname 导致 Blob PUT 异常 */
/** 浏览器端快速校验 ZIP 魔数 */
export async function assertLocalZipFile(file) {
  const head = await file.slice(0, 4).arrayBuffer();
  const b = new Uint8Array(head);
  if (b[0] === 0x50 && b[1] === 0x4b) return;
  throw new Error('所选文件不是有效的 ZIP（缺少 PK 文件头），请用 .zip 重新打包序列帧');
}

export function safeZipBlobPathname(originalName) {
  const stem = String(originalName || 'asset')
    .replace(/\.zip$/i, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 48);
  return `asset-seq/${Date.now()}-${stem || 'frames'}.zip`;
}
