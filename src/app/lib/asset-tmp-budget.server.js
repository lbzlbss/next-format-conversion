import { ApiError } from '../api/_lib/guard.js';
import { resolveRightSmallLayout } from './vap-pack.js';

/** Vercel 函数 /tmp 上限（留余量） */
export const VERCEL_TMP_BUDGET_BYTES = 480 * 1024 * 1024;

/**
 * @param {number} frameCount
 * @param {number} padW
 * @param {number} padH
 * @param {string} pack
 */
export function estimateVapPackedVideoSize(frameCount, padW, padH, pack) {
  let videoW = padW * 2;
  let videoH = padH;
  if (pack === 'bottom') {
    videoW = padW;
    videoH = padH * 2;
  } else if (pack === 'right-small') {
    const rs = resolveRightSmallLayout({ pack, padW, padH, encH: padH });
    if (rs) {
      videoW = rs.videoW;
      videoH = rs.videoH;
    }
  }
  return { videoW, videoH, bytes: Math.ceil(frameCount * videoW * videoH * 0.12) };
}

/**
 * 管道编码时 /tmp 仅输出 mp4 + 少量 ffmpeg 缓冲
 */
export function estimateVapTmpBytes(frameCount, padW, padH, pack) {
  const { bytes: mp4Est } = estimateVapPackedVideoSize(frameCount, padW, padH, pack);
  return mp4Est + 40 * 1024 * 1024;
}

/**
 * SVGA 不落盘，但 ZIP 生成阶段会占用内存
 */
export function estimateSvgaMemoryBytes(frameCount, padW, padH) {
  return Math.ceil(frameCount * padW * padH * 0.85);
}

/**
 * 旧方案：每帧 PNG 落盘（用于错误提示对比）
 */
export function estimateFramesOnDiskBytes(frameCount, padW, padH) {
  return Math.ceil(frameCount * padW * padH * 1.1);
}

/**
 * @param {number} estimatedBytes
 * @param {Record<string, unknown>} [detail]
 */
export function assertVercelTmpBudget(estimatedBytes, detail = {}) {
  if (estimatedBytes <= VERCEL_TMP_BUDGET_BYTES) return;
  const needMb = (estimatedBytes / 1024 / 1024).toFixed(0);
  const framesDiskMb =
    detail.framesOnDiskBytes != null
      ? (Number(detail.framesOnDiskBytes) / 1024 / 1024).toFixed(0)
      : null;
  let hint = '请减少序列帧数量、降低输出宽高，或拆成多个较小的 ZIP 分批转换。';
  if (framesDiskMb) {
    hint += `（若将全部帧写入临时目录约需 ${framesDiskMb}MB，已超过平台 /tmp 约 512MB 上限；当前已改为管道编码以降低占用。）`;
  }
  throw new ApiError(
    'DISK_FULL',
    `预计临时空间约 ${needMb}MB，超过平台 /tmp 上限（约 512MB）。${hint}`,
    507,
    { ...detail, vercel_tmp_limit_mb: 512, estimated_mb: Number(needMb) },
  );
}

/**
 * @param {number} estimatedBytes
 * @param {Record<string, unknown>} [detail]
 */
export function assertSvgaMemoryBudget(estimatedBytes, detail = {}) {
  const limit = 700 * 1024 * 1024;
  if (estimatedBytes <= limit) return;
  const needMb = (estimatedBytes / 1024 / 1024).toFixed(0);
  throw new ApiError(
    'FILE_TOO_LARGE',
    `预计内存占用约 ${needMb}MB，帧数或分辨率过高。请减少帧数、降低宽高，或改用 VAP 输出。`,
    413,
    detail,
  );
}
