import { NextResponse } from 'next/server';

const IS_PROD = process.env.NODE_ENV === 'production';
export const DEFAULT_TIMEOUT_MS = IS_PROD ? 20000 : 120000;

export const LIMITS = {
  IMAGE_MAX_BYTES: 20 * 1024 * 1024,   // 20MB
  VIDEO_MAX_BYTES: 50 * 1024 * 1024,   // 50MB
  SVGA_VAP_MAX_BYTES: 300 * 1024 * 1024, // 300MB
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
  return jsonError(
    'SERVER_ERROR',
    error?.message || 'Internal server error',
    500
  );
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
