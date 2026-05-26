/** 序列帧 ZIP / VAP 转换上传上限（与 next.config proxyClientMaxBodySize 对齐） */
import { detectArchiveKind, findZipMagicOffset, invalidZipUserMessage } from './zip-sniff.js';

export const ASSET_ZIP_MAX_BYTES = 600 * 1024 * 1024;

/** Vercel Serverless 请求/响应体硬上限（无法通过 next.config 提高） */
export const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;

/** 超过此大小改走 Blob 直传 + JSON 调 API，避免 FUNCTION_PAYLOAD_TOO_LARGE */
export const BLOB_CLIENT_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;

/** 超过此大小使用 Vercel Blob multipart 直传（官方建议 >100MB） */
export const BLOB_MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024;

/** VAP / SVGA 工具经 Blob 临时上传上限 */
export const VAP_TOOL_MAX_BYTES = 200 * 1024 * 1024;
export const AUDIO_MAX_BYTES = 50 * 1024 * 1024;

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

export function safeVapBlobPathname(originalName) {
  const stem = String(originalName || 'asset')
    .replace(/\.(vap|mp4)$/i, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 48);
  return `asset-vap/${Date.now()}-${stem || 'vap'}.vap`;
}

export function safeSvgaBlobPathname(originalName) {
  const stem = String(originalName || 'asset')
    .replace(/\.svga$/i, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 48);
  return `asset-svga/${Date.now()}-${stem || 'anim'}.svga`;
}

export function safeAudioBlobPathname(originalName) {
  const stem = String(originalName || 'audio')
    .replace(/\.(mp3|m4a|aac|wav|ogg)$/i, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 48);
  return `asset-audio/${Date.now()}-${stem || 'audio'}.bin`;
}
