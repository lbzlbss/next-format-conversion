import sharp from 'sharp';

import { ApiError } from '../api/_lib/guard.js';
import { unsupportedFrameUserMessage } from './image-sniff.js';

function fitToSharp(fit) {
  if (fit === 'stretch') return { fit: 'fill' };
  if (fit === 'cover') return { fit: 'cover' };
  return { fit: 'contain' };
}

/**
 * 单帧：缩放 + 16 对齐 padding → PNG（供 ffmpeg image2pipe / SVGA）
 * @param {Buffer} buf
 * @param {{ encW: number, encH: number, padW: number, padH: number, fit: string, frameName?: string }} opts
 */
export async function processSequenceFrameToPng(buf, opts) {
  const { encW, encH, padW, padH, fit, frameName = 'frame' } = opts;
  const resizeOpt = fitToSharp(fit);
  try {
    return await sharp(buf, { failOn: 'none' })
      .ensureAlpha()
      .resize(encW, encH, {
        ...resizeOpt,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: 0,
        left: 0,
        right: Math.max(0, padW - encW),
        bottom: Math.max(0, padH - encH),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  } catch (e) {
    const msg = String(e?.message || e);
    if (/unsupported image|input buffer/i.test(msg)) {
      throw new ApiError('INVALID_FORMAT', unsupportedFrameUserMessage(frameName), 400, {
        frame: frameName,
      });
    }
    throw e;
  }
}
