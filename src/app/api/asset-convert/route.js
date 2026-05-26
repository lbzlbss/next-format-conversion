import { NextResponse } from 'next/server';
import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import JSZip from 'jszip';
import sharp from 'sharp';

import { ApiError, LIMITS, assertFile, assertMaxFrames, toErrorResponse, withTimeout } from '../_lib/guard';
import { processSequenceFrameToPng } from '../../lib/asset-frame-process.server.js';
import {
  assertSvgaMemoryBudget,
  assertVercelTmpBudget,
  estimateFramesOnDiskBytes,
  estimateSvgaMemoryBytes,
  estimateVapTmpBytes,
} from '../../lib/asset-tmp-budget.server.js';
import { deleteAssetBlobQuietly, purgeAssetBlobs } from '../../lib/blob-cleanup.server.js';
import { downloadBlobZipBuffer } from '../../lib/blob-download.server.js';
import { runFfmpegImage2Pipe } from '../../lib/ffmpeg-image-pipe.server.js';
import { validateZipBuffer } from '../../lib/zip-extract.server.js';
import { unsupportedFrameUserMessage } from '../../lib/image-sniff.js';
import { extractZipImageFrames } from '../../lib/zip-extract.server.js';
import { buildVapPackFilterComplex } from '../../lib/vap-pack.js';
import { buildVapcFromSequence } from '../../lib/vapc-builder.js';
import { rebuildWithVapc } from '../../lib/vap-mp4.server.js';
import { AUDIO_MAX_BYTES } from '../../lib/upload-limits.js';

export const maxDuration = 300;

function parsePositiveInt(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i > 0 ? i : null;
}

function toEven(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return v;
  return n % 2 === 0 ? n : n + 1;
}

function ceilTo(v, m) {
  const n = Number(v);
  const mm = Number(m);
  if (!Number.isFinite(n) || !Number.isFinite(mm) || mm <= 0) return v;
  return Math.ceil(n / mm) * mm;
}

/**
 * @param {Array<{ name: string, readBuffer: () => Promise<Buffer> }>} frames
 */
async function* iterateSequencePngs(frames, { encW, encH, padW, padH, fit }) {
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const buf = await frame.readBuffer();
    yield await processSequenceFrameToPng(buf, {
      encW,
      encH,
      padW,
      padH,
      fit,
      frameName: frame.name,
    });
  }
}

async function buildSvgaFromZipFrames(frames, { fps, width, height, encW, encH, padW, padH, fit }) {
  const frameCount = frames.length;
  const zip = new JSZip();
  const images = {};

  for (let i = 0; i < frameCount; i++) {
    const key = `image_${i}`;
    const buf = await frames[i].readBuffer();
    const pngBuf = await processSequenceFrameToPng(buf, {
      encW,
      encH,
      padW,
      padH,
      fit,
      frameName: frames[i].name,
    });
    zip.file(`images/${key}.png`, pngBuf);
    images[key] = `images/${key}`;
  }

  const IDENTITY = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  const FULL_LAYOUT = { x: 0, y: 0, width, height };

  const sprites = Array.from({ length: frameCount }, (_, i) => ({
    imageKey: `image_${i}`,
    frames: Array.from({ length: frameCount }, (__, f) => ({
      alpha: f === i ? 1 : 0,
      layout: FULL_LAYOUT,
      transform: IDENTITY,
      clipPath: '',
    })),
  }));

  const spec = {
    ver: '1.2.0',
    movie: { fps, frames: frameCount, viewBox: { width, height } },
    images,
    sprites,
    audios: [],
  };

  zip.file('movie.spec', JSON.stringify(spec));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function parseInputPayload(contentType, formData, jsonBody) {
  if (contentType.includes('application/json')) {
    return {
      file: null,
      blobUrl: String(jsonBody?.blobUrl || '').trim(),
      outFormat: String(jsonBody?.format || 'vap').toLowerCase(),
      fps: parsePositiveInt(jsonBody?.fps) ?? 30,
      fit: String(jsonBody?.fit || 'contain').toLowerCase(),
      pack: String(jsonBody?.pack || 'right').toLowerCase(),
      crf: parsePositiveInt(jsonBody?.crf) ?? 18,
      reqW: parsePositiveInt(jsonBody?.width),
      reqH: parsePositiveInt(jsonBody?.height),
      stem: String(jsonBody?.filename || 'asset').replace(/\.(zip|svga|vap)$/i, ''),
      expectedBytes: parsePositiveInt(jsonBody?.expectedBytes) ?? parsePositiveInt(jsonBody?.fileSize),
    };
  }

  return {
    file: formData?.get('file'),
    blobUrl: String(formData?.get('blobUrl') || '').trim(),
    outFormat: String(formData?.get('format') || 'vap').toLowerCase(),
    fps: parsePositiveInt(formData?.get('fps')) ?? 30,
    fit: String(formData?.get('fit') || 'contain').toLowerCase(),
    pack: String(formData?.get('pack') || 'right').toLowerCase(),
    crf: parsePositiveInt(formData?.get('crf')) ?? 18,
    reqW: parsePositiveInt(formData?.get('width')),
    reqH: parsePositiveInt(formData?.get('height')),
    stem: String(formData?.get('filename') || 'asset').replace(/\.(zip|svga|vap)$/i, ''),
    expectedBytes: parsePositiveInt(formData?.get('expectedBytes')) ?? parsePositiveInt(formData?.get('fileSize')),
  };
}

async function fetchWithTimeout(url, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request) {
  try {
    return await withTimeout(
      (async () => {
        const contentType = String(request.headers.get('content-type') || '').toLowerCase();
        const isJson = contentType.includes('application/json');
        const jsonBody = isJson ? await request.json() : null;
        const formData = isJson ? null : await request.formData();

        const {
          file,
          blobUrl,
          outFormat,
          fps,
          fit,
          pack,
          crf,
          reqW,
          reqH,
          stem,
          expectedBytes,
        } =
          parseInputPayload(
          contentType,
          formData,
          jsonBody
        );

        let zipBuffer = null;
        let inputName = `${stem || 'asset'}.zip`;
        /** @type {string | null} */
        let sourceBlobUrl = null;

        try {
        if (blobUrl) {
          let parsedUrl = null;
          try {
            parsedUrl = new URL(blobUrl);
          } catch (_) {
            throw new ApiError('INVALID_FORMAT', 'blobUrl 不是有效 URL', 400);
          }
          if (parsedUrl.protocol !== 'https:') {
            throw new ApiError('INVALID_FORMAT', 'blobUrl 仅支持 https', 400);
          }

          if (expectedBytes > LIMITS.SVGA_VAP_MAX_BYTES) {
            throw new ApiError(
              'FILE_TOO_LARGE',
              `压缩包过大，请上传小于 ${(LIMITS.SVGA_VAP_MAX_BYTES / 1024 / 1024).toFixed(0)}MB 的文件`,
              413,
              { maxBytes: LIMITS.SVGA_VAP_MAX_BYTES, actualBytes: expectedBytes },
            );
          }

          sourceBlobUrl = blobUrl;
          try {
            await purgeAssetBlobs({ maxAgeMs: 2 * 60 * 60 * 1000 });
          } catch {
            /* 清理失败不阻断转换 */
          }

          zipBuffer = await downloadBlobZipBuffer(blobUrl, expectedBytes || null, (url, timeoutMs) =>
            fetchWithTimeout(url, timeoutMs),
          );

          if (zipBuffer.length > LIMITS.SVGA_VAP_MAX_BYTES) {
            throw new ApiError(
              'FILE_TOO_LARGE',
              `压缩包过大，请上传小于 ${(LIMITS.SVGA_VAP_MAX_BYTES / 1024 / 1024).toFixed(0)}MB 的文件`,
              413,
              { maxBytes: LIMITS.SVGA_VAP_MAX_BYTES, actualBytes: zipBuffer.length },
            );
          }
          inputName = path.basename(parsedUrl.pathname) || inputName;
        } else {
          assertFile(file, { maxBytes: LIMITS.SVGA_VAP_MAX_BYTES, label: '压缩包' });
          if (!String(file.name || '').toLowerCase().endsWith('.zip')) {
            throw new ApiError('INVALID_FORMAT', '请上传 .zip 压缩包', 400);
          }
          zipBuffer = Buffer.from(await file.arrayBuffer());
          validateZipBuffer(zipBuffer, expectedBytes || file.size || null);
          inputName = String(file.name || inputName);
        }

        if (!String(inputName || '').toLowerCase().endsWith('.zip')) {
          throw new ApiError('INVALID_FORMAT', '请上传 .zip 压缩包', 400);
        }
        if (!['vap', 'svga'].includes(outFormat)) {
          throw new ApiError('INVALID_FORMAT', 'format 仅支持 vap | svga', 400);
        }
        if (!['contain', 'cover', 'stretch'].includes(fit)) {
          throw new ApiError('INVALID_FORMAT', 'fit 仅支持 contain | cover | stretch', 400);
        }
        if (fps < 1 || fps > 60) {
          throw new ApiError('INVALID_FORMAT', 'fps 需在 1~60 之间', 400);
        }
        if (!['right', 'right-small', 'bottom'].includes(pack)) {
          throw new ApiError('INVALID_FORMAT', 'pack 仅支持 right | right-small | bottom', 400);
        }
        const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), `asset_zip_${randomUUID()}_`));
        let audioPath = null;

        let zipSession = null;
        try {
          zipSession = await extractZipImageFrames(zipBuffer, tmpDir);
          const frames = zipSession.frames;
          assertMaxFrames(frames.length);

          const firstBuf = await frames[0].readBuffer();
          let meta;
          try {
            meta = await sharp(firstBuf, { failOn: 'none' }).metadata();
          } catch (e) {
            const msg = String(e?.message || e);
            if (/unsupported image|input buffer/i.test(msg)) {
              throw new ApiError('INVALID_FORMAT', unsupportedFrameUserMessage(frames[0].name), 400, {
                frame: frames[0].name,
              });
            }
            throw e;
          }
          const origW = meta.width ?? null;
          const origH = meta.height ?? null;
          if (!origW || !origH) {
            throw new ApiError(
              'INVALID_FORMAT',
              `无法读取首帧「${frames[0].name}」尺寸，请确认是有效 PNG/JPEG/WebP/GIF`,
              400,
              { frame: frames[0].name },
            );
          }

          const targetW = reqW ?? origW;
          const targetH = reqH ?? origH;
          const encW = toEven(targetW);
          const encH = toEven(targetH);
          const padW = ceilTo(encW, 16);
          const padH = ceilTo(encH, 16);
          const frameCount = frames.length;

          const framesOnDiskBytes = estimateFramesOnDiskBytes(frameCount, padW, padH);
          if (outFormat === 'svga') {
            assertSvgaMemoryBudget(estimateSvgaMemoryBytes(frameCount, padW, padH), {
              frameCount,
              padW,
              padH,
            });
          } else {
            assertVercelTmpBudget(estimateVapTmpBytes(frameCount, padW, padH, pack), {
              frameCount,
              padW,
              padH,
              pack,
              framesOnDiskBytes,
              mode: 'image2pipe',
            });
          }

          // 压缩包内可选音频（mp3/m4a/aac/wav 等，取第一个）
          if (zipSession.audio) {
            const audioBuf = await zipSession.audio.readBuffer();
            if (audioBuf.length > AUDIO_MAX_BYTES) {
              throw new ApiError(
                'FILE_TOO_LARGE',
                `压缩包内音频过大（${zipSession.audio.name}），上限 ${(AUDIO_MAX_BYTES / 1024 / 1024).toFixed(0)}MB`,
                413,
              );
            }
            const audioExt = path.extname(zipSession.audio.name) || '.mp3';
            audioPath = path.join(tmpDir, `bundled_audio${audioExt}`);
            await fsp.writeFile(audioPath, audioBuf);
          }

          const outStem = String(inputName || 'asset').replace(/\.zip$/i, '');
          if (outFormat === 'svga') {
            const svgaBuf = await buildSvgaFromZipFrames(frames, {
              fps,
              width: encW,
              height: encH,
              encW,
              encH,
              padW,
              padH,
              fit,
            });
            return new NextResponse(svgaBuf, {
              headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(`${outStem}_${encW}x${encH}_${fps}.svga`)}"`,
              },
            });
          }

          // vap：经 stdin 管道喂帧，不在 /tmp 落盘全部 PNG
          const outMp4 = path.join(tmpDir, 'out.mp4');
          const filterComplex = buildVapPackFilterComplex({ pack, padW, padH, encH });

          await runFfmpegImage2Pipe({
            fps,
            filterComplex,
            outMp4,
            crf,
            audioPath,
            frames: iterateSequencePngs(frames, { encW, encH, padW, padH, fit }),
          });

          const mp4Buf = await fsp.readFile(outMp4);
          const vapc = buildVapcFromSequence({
            encW,
            encH,
            padW,
            padH,
            fps,
            frameCount: frames.length,
            pack,
            alphaW: pack === 'right-small' ? toEven(Math.ceil(padW / 2)) : undefined,
          });
          const vapBuf = rebuildWithVapc(mp4Buf, vapc);
          const vapcB64 = Buffer.from(JSON.stringify(vapc), 'utf8').toString('base64');

          return new NextResponse(vapBuf, {
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${encodeURIComponent(`${outStem}_${encW}x${encH}_${fps}.vap`)}"`,
              'X-Vapc-Config': vapcB64,
            },
          });
        } finally {
          try {
            await zipSession?.dispose?.();
          } catch {
            /* ignore */
          }
          try {
            await fsp.rm(tmpDir, { recursive: true, force: true });
          } catch (_) {}
        }
        } finally {
          if (sourceBlobUrl) {
            await deleteAssetBlobQuietly(sourceBlobUrl);
          }
        }
      })(),
      540000
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}

