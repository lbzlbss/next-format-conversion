import { NextResponse } from 'next/server';

import { ApiError, jsonError, toErrorResponse } from '../../_lib/guard.js';
import { purgeAssetBlobs } from '../../../lib/blob-cleanup.server.js';

function assertCleanupAuth(request) {
  const secret = process.env.CRON_SECRET || process.env.BLOB_CLEANUP_SECRET;
  if (!secret) {
    throw new ApiError('INVALID_CONFIG', '未配置 CRON_SECRET / BLOB_CLEANUP_SECRET', 500);
  }
  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) {
    throw new ApiError('UNAUTHORIZED', '未授权', 401);
  }
}

/**
 * 清理 asset-seq/ 临时 ZIP。Vercel Cron 或管理员手动调用。
 * GET/POST ?maxAgeHours=24 （0 = 清空该前缀下全部）
 */
export async function GET(request) {
  return runCleanup(request);
}

export async function POST(request) {
  return runCleanup(request);
}

async function runCleanup(request) {
  try {
    assertCleanupAuth(request);
    const { searchParams } = new URL(request.url);
    const maxAgeHours = Number(searchParams.get('maxAgeHours') ?? '24');
    const maxAgeMs =
      Number.isFinite(maxAgeHours) && maxAgeHours >= 0 ? maxAgeHours * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    const result = await purgeAssetBlobs({ maxAgeMs });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'UNAUTHORIZED') {
      return jsonError(e.code, e.message, e.status);
    }
    return toErrorResponse(e);
  }
}
