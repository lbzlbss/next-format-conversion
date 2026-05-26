import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

import { ApiError, toErrorResponse } from '../../_lib/guard';
import {
  AUDIO_BLOB_PREFIX,
  purgeAllTempBlobs,
  SVGA_BLOB_PREFIX,
  VAP_BLOB_PREFIX,
} from '../../../lib/blob-cleanup.server.js';
import { ASSET_ZIP_MAX_BYTES, AUDIO_MAX_BYTES, VAP_TOOL_MAX_BYTES } from '../../../lib/upload-limits.js';

const ZIP_CONTENT_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
];

const VAP_CONTENT_TYPES = ['video/mp4', 'application/octet-stream'];

const SVGA_CONTENT_TYPES = ['application/octet-stream'];

const AUDIO_CONTENT_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  'audio/ogg',
  'application/octet-stream',
];

export async function POST(request) {
  try {
    const body = await request.json();
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const requestedSize = Number(clientPayload?.size ?? 0);
        const p = String(pathname || '');
        const isVap = p.startsWith(VAP_BLOB_PREFIX);
        const isSvga = p.startsWith(SVGA_BLOB_PREFIX);
        const isAudio = p.startsWith(AUDIO_BLOB_PREFIX);
        const maxBytes = isAudio ? AUDIO_MAX_BYTES : isVap || isSvga ? VAP_TOOL_MAX_BYTES : ASSET_ZIP_MAX_BYTES;

        if (requestedSize > maxBytes) {
          throw new Error(
            `文件过大（${Math.ceil(requestedSize / 1024 / 1024)}MB），上限 ${Math.floor(maxBytes / 1024 / 1024)}MB`,
          );
        }

        const allowedContentTypes = isAudio
          ? AUDIO_CONTENT_TYPES
          : isVap
            ? VAP_CONTENT_TYPES
            : isSvga
              ? SVGA_CONTENT_TYPES
              : ZIP_CONTENT_TYPES;

        return {
          allowedContentTypes,
          maximumSizeInBytes: maxBytes,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // conversion API 通过 blobUrl 拉取
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    if (String(error?.message || '').includes('BLOB_READ_WRITE_TOKEN')) {
      return toErrorResponse(
        new ApiError('INVALID_CONFIG', '缺少 BLOB_READ_WRITE_TOKEN 环境变量', 500)
      );
    }
    const msg = String(error?.message || '');
    if (msg.includes('文件过大') || msg.includes('maximumSize')) {
      return toErrorResponse(new ApiError('FILE_TOO_LARGE', msg, 413));
    }
    if (/storage quota exceeded|bad_request/i.test(msg) && /quota/i.test(msg)) {
      try {
        await purgeAllTempBlobs(0);
      } catch {
        /* ignore */
      }
      return toErrorResponse(
        new ApiError(
          'BLOB_QUOTA_EXCEEDED',
          '云端 Blob 存储已满（Hobby 约 1GB）。已尝试清理历史临时 ZIP，请重新上传；若仍失败请在 Vercel → Storage → Blob 手动删除 asset-seq/ 下文件。',
          507,
        ),
      );
    }
    return toErrorResponse(error);
  }
}
