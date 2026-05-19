import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

import { ApiError, toErrorResponse } from '../../_lib/guard';

const ALLOWED_CONTENT_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
];

const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

export async function POST(request) {
  try {
    const body = await request.json();
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // no-op: conversion API will consume blobUrl directly.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    if (String(error?.message || '').includes('BLOB_READ_WRITE_TOKEN')) {
      return toErrorResponse(
        new ApiError('INVALID_CONFIG', '缺少 BLOB_READ_WRITE_TOKEN 环境变量', 500)
      );
    }
    return toErrorResponse(error);
  }
}
