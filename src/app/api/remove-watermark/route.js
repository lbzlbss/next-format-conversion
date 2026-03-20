import { NextResponse } from 'next/server';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const TMP = os.tmpdir();
const TIMEOUT_MS = process.env.NODE_ENV === 'production' ? 20000 : 120000;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

let ffmpegBin = null;
try {
  const ffmpegStatic = _require('ffmpeg-static');
  if (ffmpegStatic && fs.existsSync(ffmpegStatic)) ffmpegBin = ffmpegStatic;
} catch (_) {}
if (!ffmpegBin) {
  for (const p of ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg']) {
    if (fs.existsSync(p)) {
      ffmpegBin = p;
      break;
    }
  }
}
if (ffmpegBin) ffmpeg.setFfmpegPath(ffmpegBin);

function apiError(code, message, status = 400, detail = null) {
  return NextResponse.json({ code, message, detail }, { status });
}

function toInt(v, fallback = 0) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseTracks(raw) {
  if (!raw) return [];
  try {
    const list = JSON.parse(String(raw));
    if (!Array.isArray(list)) return [];
    return list
      .map((it) => ({
        start: Math.max(0, Number(it.start || 0)),
        end: Math.max(0, Number(it.end || 0)),
        x: Math.max(0, Number(it.x || 0)),
        y: Math.max(0, Number(it.y || 0)),
        width: Math.max(1, Number(it.width || 1)),
        height: Math.max(1, Number(it.height || 1)),
      }))
      .filter((it) => Number.isFinite(it.start) && Number.isFinite(it.end) && it.end > it.start);
  } catch {
    return [];
  }
}

async function runFfmpeg(inputPath, outputPath, options) {
  await new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS);
    ffmpeg(inputPath)
      .outputOptions(options)
      .on('stderr', (line) => { stderr += line + '\n'; })
      .on('end', () => {
        clearTimeout(timer);
        resolve();
      })
      .on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`${err.message}\nffmpeg stderr:\n${stderr}`));
      })
      .save(outputPath);
  });
}

export async function POST(request) {
  let inputPath = '';
  let outputPath = '';

  try {
    if (!ffmpegBin) {
      return apiError('FFMPEG_NOT_FOUND', 'Cannot find ffmpeg', 500);
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const maskX = toInt(formData.get('maskX'));
    const maskY = toInt(formData.get('maskY'));
    const maskWidth = toInt(formData.get('maskWidth'));
    const maskHeight = toInt(formData.get('maskHeight'));
    const smooth = String(formData.get('smooth')) === 'true';
    const keepAudio = String(formData.get('keepAudio')) !== 'false';
    const tracks = parseTracks(formData.get('maskTracks'));

    if (!file || typeof file.arrayBuffer !== 'function') {
      return apiError('INVALID_FORMAT', '请上传 MP4 文件', 400);
    }
    if (file.size === 0) {
      return apiError('INVALID_FORMAT', '文件为空', 400);
    }
    if (file.size > MAX_FILE_SIZE) {
      return apiError('FILE_TOO_LARGE', '文件过大，请上传小于 50MB 的视频', 413, {
        maxBytes: MAX_FILE_SIZE,
        actualBytes: file.size,
      });
    }
    if (maskWidth <= 0 || maskHeight <= 0) {
      return apiError('INVALID_MASK', '水印区域参数无效', 400);
    }

    const inputName = `wm_in_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
    const outputName = `wm_out_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
    inputPath = path.join(TMP, inputName);
    outputPath = path.join(TMP, outputName);

    const buf = Buffer.from(await file.arrayBuffer());
    await fsp.writeFile(inputPath, buf);

    const toDelogo = (m) => `delogo=x=${Math.max(0, m.x)}:y=${Math.max(0, m.y)}:w=${m.width}:h=${m.height}:show=0`;
    const vFilter = tracks.length > 0
      ? tracks
          .map((t) => `${toDelogo(t)}:enable='between(t\\,${t.start}\\,${t.end})'`)
          .concat(smooth ? ['boxblur=1:1'] : [])
          .join(',')
      : (smooth
          ? `${toDelogo({ x: maskX, y: maskY, width: maskWidth, height: maskHeight })},boxblur=1:1`
          : toDelogo({ x: maskX, y: maskY, width: maskWidth, height: maskHeight }));
    const outputOptions = [
      `-vf ${vFilter}`,
      '-c:v libx264',
      '-crf 23',
      '-preset medium',
      '-movflags +faststart',
    ];
    if (keepAudio) {
      outputOptions.push('-c:a aac', '-b:a 128k');
    } else {
      outputOptions.push('-an');
    }

    await runFfmpeg(inputPath, outputPath, outputOptions);
    const outBuf = await fsp.readFile(outputPath);

    const originalName = String(file.name || 'video.mp4');
    const downloadName = `no_watermark_${originalName}`;
    const asciiFallback = downloadName.replace(/[^\x20-\x7E]/g, '_');

    return new Response(outBuf, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        'Content-Length': String(outBuf.length),
      },
    });
  } catch (error) {
    if (String(error?.message || '').includes('TIMEOUT')) {
      return apiError('TIMEOUT', `处理超时（>${TIMEOUT_MS}ms）`, 408);
    }
    return apiError('SERVER_ERROR', error?.message || '处理失败', 500);
  } finally {
    if (inputPath) await fsp.unlink(inputPath).catch(() => {});
    if (outputPath) await fsp.unlink(outputPath).catch(() => {});
  }
}

