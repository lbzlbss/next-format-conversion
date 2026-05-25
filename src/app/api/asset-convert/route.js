import { NextResponse } from 'next/server';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { createRequire } from 'node:module';
import ffmpeg from 'fluent-ffmpeg';
import JSZip from 'jszip';
import sharp from 'sharp';

import { ApiError, LIMITS, assertFile, assertMaxFrames, toErrorResponse, withTimeout } from '../_lib/guard';
import { downloadBlobZipBuffer } from '../../lib/blob-download.server.js';
import { validateZipBuffer } from '../../lib/zip-extract.server.js';
import { extractZipImageFrames } from '../../lib/zip-extract.server.js';
import { buildVapcFromSequence } from '../../lib/vapc-builder.js';
import { rebuildWithVapc } from '../../lib/vap-mp4.server.js';

const _require = createRequire(import.meta.url);
export const maxDuration = 300;

// ─── ffmpeg path ───────────────────────────────────────────────────────────────
let ffmpegBin = null;
try {
  const ffmpegStatic = _require('ffmpeg-static');
  const binPath = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic?.default;
  if (binPath && fs.existsSync(binPath)) ffmpegBin = binPath;
} catch (_) {}

if (!ffmpegBin) {
  for (const p of ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', path.join(process.cwd(), 'public', 'ffmpeg', 'ffmpeg')]) {
    if (fs.existsSync(p)) {
      ffmpegBin = p;
      break;
    }
  }
}
if (ffmpegBin) ffmpeg.setFfmpegPath(ffmpegBin);

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

function fitToSharp(fit) {
  if (fit === 'stretch') return { fit: 'fill' };
  if (fit === 'cover') return { fit: 'cover' };
  return { fit: 'contain' };
}

function runFfmpeg(input, output, outputOptions = []) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const cmd = ffmpeg(input).outputOptions(outputOptions).output(output);
    cmd
      .on('stderr', (line) => {
        stderr += line + '\n';
      })
      .on('end', resolve)
      .on('error', (err) => reject(new Error(`${err.message}\nffmpeg stderr:\n${stderr}`)))
      .run();
  });
}

function runFfmpegImageSeqToMp4({ pattern, fps, filterComplex, outMp4, crf = 18 }) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const cmd = ffmpeg()
      .input(pattern)
      // IMPORTANT: -framerate is an INPUT option for image sequences
      .inputOptions(['-framerate', String(fps), '-start_number', '0'])
      .outputOptions([
        '-y',
        '-filter_complex',
        filterComplex,
        '-map',
        '[v]',
        '-f',
        'mp4',
        '-c:v',
        'libx264',
        // safer defaults to avoid decoder artifacts
        '-preset',
        'veryfast',
        '-crf',
        String(Math.min(28, Math.max(15, crf))),
        // Make every frame a keyframe (intra-only) to avoid P/B-frame corruption artifacts.
        '-g',
        '1',
        '-keyint_min',
        '1',
        '-sc_threshold',
        '0',
        // VAP packing works better with no B-frames (less reordering)
        '-bf',
        '0',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
      ])
      .output(outMp4);

    cmd
      .on('stderr', (line) => {
        stderr += line + '\n';
      })
      .on('end', resolve)
      .on('error', (err) => reject(new Error(`${err.message}\nffmpeg stderr:\n${stderr}`)))
      .run();
  });
}

async function buildSvgaFromFrameDir(framesDir, frameCount, { fps, width, height }) {
  const zip = new JSZip();
  const images = {};

  for (let i = 0; i < frameCount; i++) {
    const key = `image_${i}`;
    const pngPath = path.join(framesDir, `${String(i).padStart(3, '0')}.png`);
    const buf = await fsp.readFile(pngPath);
    zip.file(`images/${key}.png`, buf);
    images[key] = `images/${key}`; // no .png suffix
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

        const { file, blobUrl, outFormat, fps, fit, pack, crf, reqW, reqH, stem, expectedBytes } =
          parseInputPayload(
          contentType,
          formData,
          jsonBody
        );

        let zipBuffer = null;
        let inputName = `${stem || 'asset'}.zip`;

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
        if (!['right', 'bottom'].includes(pack)) {
          throw new ApiError('INVALID_FORMAT', 'pack 仅支持 right | bottom', 400);
        }
        const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), `asset_zip_${randomUUID()}_`));
        const framesDir = path.join(tmpDir, 'frames');
        await fsp.mkdir(framesDir, { recursive: true });

        let zipSession = null;
        try {
          zipSession = await extractZipImageFrames(zipBuffer, tmpDir);
          const frames = zipSession.frames;
          assertMaxFrames(frames.length);

          const firstBuf = await frames[0].readBuffer();
          const meta = await sharp(firstBuf, { failOn: 'none' }).metadata();
          const origW = meta.width ?? null;
          const origH = meta.height ?? null;
          if (!origW || !origH) {
            throw new ApiError('INVALID_FORMAT', '无法读取首帧图片尺寸', 400);
          }

          const targetW = reqW ?? origW;
          const targetH = reqH ?? origH;
          const encW = toEven(targetW);
          const encH = toEven(targetH);
          const padW = ceilTo(encW, 16);
          const padH = ceilTo(encH, 16);

          const resizeOpt = fitToSharp(fit);

          for (let i = 0; i < frames.length; i++) {
            const buf = await frames[i].readBuffer();
            const base = sharp(buf, { failOn: 'none' })
              .ensureAlpha()
              .resize(encW, encH, {
                ...resizeOpt,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
              })
              // Pad to 16-aligned for H.264 macroblocks; keep transparent padding.
              .extend({
                top: 0,
                left: 0,
                right: Math.max(0, padW - encW),
                bottom: Math.max(0, padH - encH),
                background: { r: 0, g: 0, b: 0, alpha: 0 },
              });
            const pngBuf = await base.png().toBuffer();

            const outPngPath = path.join(framesDir, `${String(i).padStart(3, '0')}.png`);
            await fsp.writeFile(outPngPath, pngBuf);
          }

          const outStem = String(inputName || 'asset').replace(/\.zip$/i, '');
          if (outFormat === 'svga') {
            const svgaBuf = await buildSvgaFromFrameDir(framesDir, frames.length, {
              fps,
              width: encW,
              height: encH,
            });
            return new NextResponse(svgaBuf, {
              headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(`${outStem}_${encW}x${encH}_${fps}.svga`)}"`,
              },
            });
          }

          // vap
          const outMp4 = path.join(tmpDir, 'out.mp4');
          const pattern = path.join(framesDir, '%03d.png');
          // Make alpha plane 3-channel to avoid colorspace conversions polluting alpha.
          // pack=right:  [rgb | alpha] (hstack)  => videoW = padW*2, videoH = padH
          // pack=bottom: [rgb / alpha] (vstack)  => videoW = padW,   videoH = padH*2
          const filterComplex =
            '[0:v]format=rgba,split=2[c0][c1];' +
            '[c1]alphaextract,format=gray,format=rgb24[a];' +
            '[c0]format=rgb24[c];' +
            (pack === 'bottom' ? '[c][a]vstack=inputs=2[v]' : '[c][a]hstack=inputs=2[v]');

          await runFfmpegImageSeqToMp4({ pattern, fps, filterComplex, outMp4, crf });

          const mp4Buf = await fsp.readFile(outMp4);
          const vapc = buildVapcFromSequence({
            encW,
            encH,
            padW,
            padH,
            fps,
            frameCount: frames.length,
            pack,
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
      })(),
      540000
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}

