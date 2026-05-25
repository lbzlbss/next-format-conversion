import { NextResponse } from 'next/server';

const IS_PROD = process.env.NODE_ENV === 'production';
export const DEFAULT_TIMEOUT_MS = IS_PROD ? 20000 : 120000;

export const LIMITS = {
  IMAGE_MAX_BYTES: 20 * 1024 * 1024,   // 20MB
  VIDEO_MAX_BYTES: 50 * 1024 * 1024,   // 50MB
  SVGA_VAP_MAX_BYTES: 600 * 1024 * 1024, // 600MB，序列帧 ZIP（与 Blob / proxy 上限一致）
  MAX_FRAMES: 1000,
};

export class ApiError extends Error {
  constructor(code, message, status = 400, detail = undefined) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export function jsonError(code, message, status = 400, detail = undefined) {
  return NextResponse.json(
    { code, message, detail: detail ?? null },
    { status }
  );
}

export function toErrorResponse(error) {
  if (error instanceof ApiError) {
    return jsonError(error.code, error.message, error.status, error.detail);
  }
  const raw = String(error?.message || error || '');
  if (/enospc|no space left on device/i.test(raw)) {
    return jsonError(
      'DISK_FULL',
      '服务端临时磁盘已满（平台 /tmp 约 512MB）。请减少序列帧数量、降低分辨率，或拆成多个较小的 ZIP 分批转换。',
      507,
      { hint: 'vercel_tmp_limit_mb: 512' },
    );
  }
  if (/function_payload_too_large|request entity too large|payload too large/i.test(raw)) {
    return jsonError(
      'PAYLOAD_TOO_LARGE',
      '请求体超过 Vercel 函数上限（约 4.5MB）。大 VAP/SVGA 请用页面上传（自动走 Blob 直传），勿用手写 curl multipart。',
      413,
      { hint: 'vercel_function_body_limit_mb: 4.5' },
    );
  }
  if (/unsupported image format|input buffer contains unsupported/i.test(raw)) {
    return jsonError(
      'INVALID_FORMAT',
      '压缩包内含无法识别的图片。请确认均为 PNG/JPEG/WebP/GIF 序列帧，并删除 macOS 产生的 __MACOSX、._ 附属文件后重新打包。',
      400,
    );
  }
  if (/storage quota exceeded|blob.*quota/i.test(raw)) {
    return jsonError(
      'BLOB_QUOTA_EXCEEDED',
      '云端 Blob 存储已满（Hobby 约 1GB）。站点会在转换后自动删除临时 ZIP；请稍后重试。若仍失败，请在 Vercel 控制台清理 Blob 或升级套餐。',
      507,
    );
  }
  return jsonError('SERVER_ERROR', raw || 'Internal server error', 500);
}

export function assertFile(file, { maxBytes, label = '文件' } = {}) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new ApiError('INVALID_FORMAT', `未提供有效的${label}`, 400);
  }
  if (file.size === 0) {
    throw new ApiError('INVALID_FORMAT', `${label}为空`, 400);
  }
  if (maxBytes && file.size > maxBytes) {
    throw new ApiError(
      'FILE_TOO_LARGE',
      `${label}过大，请上传小于 ${(maxBytes / 1024 / 1024).toFixed(0)}MB 的文件`,
      413,
      { maxBytes, actualBytes: file.size }
    );
  }
}

export function assertMaxFrames(value, max = LIMITS.MAX_FRAMES) {
  if (typeof value !== 'number' || Number.isNaN(value)) return;
  if (value > max) {
    throw new ApiError(
      'FRAME_LIMIT_EXCEEDED',
      `帧数过多，请设置不超过 ${max} 帧`,
      400,
      { max, actual: value }
    );
  }
}

export async function withTimeout(task, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let timer = null;
  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new ApiError('TIMEOUT', `处理超时（>${timeoutMs}ms）`, 408, { timeoutMs }));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
