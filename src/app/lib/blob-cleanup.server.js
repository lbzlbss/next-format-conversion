import { del, list } from '@vercel/blob';

/** 临时 Blob 路径前缀 */
export const ASSET_BLOB_PREFIX = 'asset-seq/';
export const VAP_BLOB_PREFIX = 'asset-vap/';
export const SVGA_BLOB_PREFIX = 'asset-svga/';
export const AUDIO_BLOB_PREFIX = 'asset-audio/';
export const TEMP_BLOB_PREFIXES = [ASSET_BLOB_PREFIX, VAP_BLOB_PREFIX, SVGA_BLOB_PREFIX, AUDIO_BLOB_PREFIX];

const VERCEL_BLOB_HOST_RE = /(?:^|\.)((?:public\.)?blob\.vercel-storage\.com|vercel-storage\.com)$/i;

/**
 * @param {string} url
 */
export function isVercelBlobUrl(url) {
  try {
    const u = new URL(url);
    return VERCEL_BLOB_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

/**
 * 转换结束后删除本次上传的 ZIP（失败也删，避免 Hobby 1GB 配额被占满）
 * @param {string | null | undefined} blobUrl
 */
export async function deleteAssetBlobQuietly(blobUrl) {
  if (!blobUrl || !isVercelBlobUrl(blobUrl) || !process.env.BLOB_READ_WRITE_TOKEN) {
    return false;
  }
  try {
    await del(blobUrl);
    return true;
  } catch {
    return false;
  }
}

/**
 * 仅允许删除本项目临时前缀下的 Blob（供前端放弃任务/中断后释放，URL 含随机后缀）
 * @param {string} blobUrl
 */
export function isTempAssetBlobUrl(blobUrl) {
  if (!isVercelBlobUrl(blobUrl)) return false;
  try {
    const path = decodeURIComponent(new URL(blobUrl).pathname);
    return TEMP_BLOB_PREFIXES.some((prefix) => path.includes(prefix.replace(/\/$/, '')));
  } catch {
    return false;
  }
}

/**
 * @param {string} blobUrl
 */
export async function releaseTempAssetBlob(blobUrl) {
  if (!isTempAssetBlobUrl(blobUrl)) {
    return { deleted: false, reason: 'not_temp_blob' };
  }
  const deleted = await deleteAssetBlobQuietly(blobUrl);
  return { deleted, reason: deleted ? 'ok' : 'delete_failed' };
}

/**
 * 清理 asset-seq/ 下过期或未完成的临时 ZIP
 * @param {{ prefix?: string, maxAgeMs?: number }} options maxAgeMs=0 表示删除该前缀下全部对象
 */
export async function purgeAssetBlobs({ prefix = ASSET_BLOB_PREFIX, maxAgeMs = 24 * 60 * 60 * 1000 } = {}) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('缺少 BLOB_READ_WRITE_TOKEN');
  }

  const cutoff = Date.now() - maxAgeMs;
  let cursor;
  let deleted = 0;
  let scanned = 0;
  let skipped = 0;

  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      scanned += 1;
      if (maxAgeMs > 0) {
        const uploadedAt = blob.uploadedAt ? new Date(blob.uploadedAt).getTime() : 0;
        if (uploadedAt > cutoff) {
          skipped += 1;
          continue;
        }
      }
      try {
        await del(blob.url);
        deleted += 1;
      } catch {
        /* 单条失败继续 */
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return { deleted, scanned, skipped, prefix, maxAgeMs };
}

/** 清理所有临时前缀 */
export async function purgeAllTempBlobs(maxAgeMs = 24 * 60 * 60 * 1000) {
  const results = [];
  for (const prefix of TEMP_BLOB_PREFIXES) {
    results.push(await purgeAssetBlobs({ prefix, maxAgeMs }));
  }
  return results;
}
