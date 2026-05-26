import { ApiError, LIMITS } from '../api/_lib/guard.js';
import { resolveRightSmallLayout } from './vap-pack.js';

/** Vercel 函数 /tmp 上限（留余量） */
export const VERCEL_TMP_BUDGET_BYTES = 480 * 1024 * 1024;

/** 与 route maxDuration / vercel.json 对齐（留 20s 余量） */
export const CONVERT_DURATION_BUDGET_MS = 280_000;

/** 编码结果主要进内存时的软上限（Hobby 函数约 1GB） */
export const VAP_MEMORY_BUDGET_BYTES = 820 * 1024 * 1024;

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
 * 管道 → 内存：/tmp 仅可能写入小包音频 + ffmpeg 零星缓冲
 */
export function estimateVapTmpBytes(_frameCount, _padW, _padH, _pack, hasAudio = false) {
  return (hasAudio ? 20 : 4) * 1024 * 1024 + 48 * 1024 * 1024;
}

/**
 * 成品 MP4 在内存中的体积估算
 */
export function estimateVapMemoryBytes(frameCount, padW, padH, pack) {
  const { bytes: mp4Est } = estimateVapPackedVideoSize(frameCount, padW, padH, pack);
  return mp4Est + 64 * 1024 * 1024;
}

/**
 * 按分辨率估算 VAP 可支持的最大帧数
 */
export function computeMaxVapFrames(padW, padH, pack) {
  const per = estimateVapPackedVideoSize(1, padW, padH, pack).bytes;
  const perFrameCost = Math.max(per * 1.25, padW * padH * 0.35);
  const byMem = Math.floor(VAP_MEMORY_BUDGET_BYTES / perFrameCost);
  return Math.min(LIMITS.MAX_FRAMES, Math.max(24, byMem));
}

/**
 * @param {number} frameCount
 * @param {number} padW
 * @param {number} padH
 * @param {string} pack
 */
export function assertVapFrameCount(frameCount, padW, padH, pack) {
  const maxFrames = computeMaxVapFrames(padW, padH, pack);
  if (frameCount <= maxFrames) return maxFrames;
  throw new ApiError(
    'DISK_FULL',
    `当前输出尺寸（约 ${padW}×${padH}）建议最多 ${maxFrames} 帧，压缩包内有 ${frameCount} 帧。请减帧、降低宽高或拆成多个 ZIP。`,
    507,
    { maxFrames, frameCount, padW, padH, pack, vercel_tmp_limit_mb: 512 },
  );
}

/**
 * @param {number} estimatedBytes
 * @param {Record<string, unknown>} [detail]
 */
/**
 * @param {number} estimatedBytes
 * @param {number} [zipBytes]
 */
export function effectiveVapMemoryBudget(zipBytes = 0) {
  const zipMb = zipBytes / (1024 * 1024);
  if (zipMb >= 100) return 520 * 1024 * 1024;
  if (zipMb >= 70) return 620 * 1024 * 1024;
  return VAP_MEMORY_BUDGET_BYTES;
}

/**
 * @param {number} estimatedBytes
 * @param {Record<string, unknown>} [detail]
 * @param {number} [zipBytes]
 */
export function assertVapMemoryBudget(estimatedBytes, detail = {}, zipBytes = 0) {
  const limit = effectiveVapMemoryBudget(zipBytes);
  const total = estimatedBytes + Math.max(0, zipBytes);
  if (total <= limit) return;
  const needMb = (total / 1024 / 1024).toFixed(0);
  const zipMb = (zipBytes / 1024 / 1024).toFixed(0);
  throw new ApiError(
    'FILE_TOO_LARGE',
    `预计内存占用约 ${needMb}MB（含 ZIP ${zipMb}MB），超过单次转换上限。请减少帧数、在页面填写更小的宽/高，或拆成多个 ZIP。`,
    413,
    { ...detail, zipBytes, memoryLimitBytes: limit },
  );
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
/**
 * 大任务在 300s 上限下易 FUNCTION_INVOCATION_TIMEOUT，转换前粗算耗时
 */
export function assertConvertDurationBudget(frameCount, padW, padH, zipBytes = 0) {
  const zipMb = zipBytes / (1024 * 1024);
  const downloadMs = zipMb > 0 ? Math.min(120_000, Math.ceil(zipMb * 2500)) : 30_000;
  const perFrameMs = Math.max(60, Math.floor((padW * padH) / 12000));
  const totalMs = downloadMs + frameCount * perFrameMs + 40_000;
  if (totalMs <= CONVERT_DURATION_BUDGET_MS) return totalMs;
  const sec = Math.ceil(totalMs / 1000);
  const limitSec = Math.floor(CONVERT_DURATION_BUDGET_MS / 1000);
  throw new ApiError(
    'TIMEOUT',
    `预计处理约 ${sec} 秒，超过单次上限（约 ${limitSec} 秒）。请减少帧数、填写更小宽/高（如 720）、降低 fps，或拆成多个 ZIP。`,
    408,
    { frameCount, padW, padH, zipBytes, estimatedSec: sec, limitSec },
  );
}

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
