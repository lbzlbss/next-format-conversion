'use client';

import { upload } from '@vercel/blob/client';

import { releaseTempBlob } from './blob-release-client.js';
import {
  BLOB_CLIENT_UPLOAD_THRESHOLD_BYTES,
  BLOB_MULTIPART_THRESHOLD_BYTES,
  safeSvgaBlobPathname,
  safeVapBlobPathname,
} from './upload-limits.js';

/**
 * 大文件走 Blob 直传，避免 Vercel 函数 4.5MB 请求体限制
 * @param {{ file: File, action: string, options?: Record<string, unknown> }} params
 */
export async function postVapApi({ file, action, options = {} }) {
  if (!file || file.size === 0) {
    throw new Error('文件为空');
  }

  if (file.size < BLOB_CLIENT_UPLOAD_THRESHOLD_BYTES) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('action', action);
    if (Object.keys(options).length > 0) {
      fd.append('options', JSON.stringify(options));
    }
    return fetch('/api/vap', { method: 'POST', body: fd });
  }

  const isSvga = /\.svga$/i.test(file.name) || action === 'svga-to-vap';
  const pathname = isSvga ? safeSvgaBlobPathname(file.name) : safeVapBlobPathname(file.name);

  /** @type {string | null} */
  let uploadedUrl = null;
  try {
    const uploaded = await upload(pathname, file, {
      access: 'public',
      handleUploadUrl: '/api/blob/upload',
      multipart: file.size >= BLOB_MULTIPART_THRESHOLD_BYTES,
      contentType: file.type || 'application/octet-stream',
    });
    uploadedUrl = uploaded.downloadUrl || uploaded.url;

    return await fetch('/api/vap', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        blobUrl: uploadedUrl,
        expectedBytes: file.size,
        filename: file.name,
        action,
        options,
      }),
    });
  } catch (e) {
    if (uploadedUrl) {
      await releaseTempBlob(uploadedUrl).catch(() => {});
    }
    throw e;
  }
}
