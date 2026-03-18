import { NextResponse } from 'next/server';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import JSZip from 'jszip';
import protobuf from 'protobufjs';

// CJS require helper — needed for packages that don't ship ESM (e.g. ffmpeg-static)
const _require = createRequire(import.meta.url);

// ─── SVGA v2 protobuf setup (shared proto with /api/svga) ─────────────────────
const SVGA_PROTO_PATH = fileURLToPath(new URL('../svga/svga.proto', import.meta.url));
let _movieEntityTypePromise = null;
async function getMovieEntityType() {
  if (!_movieEntityTypePromise) {
    _movieEntityTypePromise = (async () => {
      const protoText = await fsp.readFile(SVGA_PROTO_PATH, 'utf-8');
      const parsed = protobuf.parse(protoText, { keepCase: true });
      return parsed.root.lookupType('com.opensource.svga.MovieEntity');
    })();
  }
  return _movieEntityTypePromise;
}

// ─── ffmpeg path ───────────────────────────────────────────────────────────────
// Priority: ffmpeg-static (bundled binary, works on Vercel) → system path
let ffmpegBin = null;
try {
  // ffmpeg-static is a CJS module that exports the binary path as its default export
  const ffmpegStatic = _require('ffmpeg-static');
  const binPath = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic?.default;
  if (binPath && fs.existsSync(binPath)) ffmpegBin = binPath;
} catch (_) {}

if (!ffmpegBin) {
  // Fall back to well-known system locations
  for (const p of ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg',
                   path.join(process.cwd(), 'public', 'ffmpeg', 'ffmpeg')]) {
    if (fs.existsSync(p)) { ffmpegBin = p; break; }
  }
}

if (ffmpegBin) {
  ffmpeg.setFfmpegPath(ffmpegBin);
}

const TMP = os.tmpdir();

// ─── MP4 box helpers ───────────────────────────────────────────────────────────
const CONTAINER_BOXES = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'meta', 'ilst']);

/**
 * Linearly scan a buffer for a box with the given 4-char type.
 * Returns { start, size, data } or null.
 */
function findBoxLinear(buf, boxType) {
  let offset = 0;
  while (offset + 8 <= buf.length) {
    let size = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString('ascii');

    if (size === 0) {
      // Box extends to end of file
      size = buf.length - offset;
    } else if (size === 1) {
      // Extended 64-bit size — skip for now
      offset += size;
      continue;
    }

    if (type === boxType) {
      return { start: offset, size, data: buf.slice(offset + 8, offset + size) };
    }

    offset += size;
    if (size < 8) break; // corrupted
  }
  return null;
}

/**
 * Recursively search a buffer (and container boxes) for the given type.
 */
function findBoxRecursive(buf, boxType) {
  let offset = 0;
  while (offset + 8 <= buf.length) {
    let size = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString('ascii');

    if (size === 0) size = buf.length - offset;
    if (size === 1 || size < 8) { offset += Math.max(size, 8); continue; }

    if (type === boxType) {
      return { start: offset, size, data: buf.slice(offset + 8, offset + size) };
    }

    if (CONTAINER_BOXES.has(type)) {
      const inner = findBoxRecursive(buf.slice(offset + 8, offset + size), boxType);
      if (inner) {
        // Adjust start to be absolute within buf
        return { ...inner, start: inner.start + offset + 8 };
      }
    }

    offset += size;
  }
  return null;
}

function parseVapc(buf) {
  const box = findBoxRecursive(buf, 'vapc');
  if (!box) return null;
  try {
    return JSON.parse(box.data.toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Replace the vapc box in buf with a new JSON config.
 * If no vapc box exists, append a new one before the end.
 */
function rebuildWithVapc(buf, config) {
  const jsonStr = JSON.stringify(config);
  const jsonBuf = Buffer.from(jsonStr, 'utf8');
  const boxSize = 8 + jsonBuf.length;
  const newBox = Buffer.alloc(boxSize);
  newBox.writeUInt32BE(boxSize, 0);
  newBox.write('vapc', 4, 'ascii');
  jsonBuf.copy(newBox, 8);

  const box = findBoxRecursive(buf, 'vapc');
  if (!box) {
    return Buffer.concat([buf, newBox]);
  }
  return Buffer.concat([
    buf.slice(0, box.start),
    newBox,
    buf.slice(box.start + box.size),
  ]);
}

// ─── ffmpeg helpers ────────────────────────────────────────────────────────────
function runFfmpeg(input, output, options = []) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const cmd = ffmpeg(input).outputOptions(options).output(output);
    cmd
      .on('stderr', (line) => { stderr += line + '\n'; })
      .on('end', resolve)
      .on('error', (err) => reject(new Error(`${err.message}\nffmpeg stderr:\n${stderr}`)))
      .run();
  });
}

/**
 * Extract PNG frames from video at target fps.
 * Returns array of file paths.
 */
async function extractFrames(videoPath, outDir, fps = 20) {
  const pattern = path.join(outDir, 'frame_%04d.png');
  await runFfmpeg(videoPath, pattern, [
    `-vf fps=${fps}`,
    '-pix_fmt rgb24',
    '-f image2',
  ]);
  const files = (await fsp.readdir(outDir))
    .filter((f) => f.endsWith('.png'))
    .sort();
  return files.map((f) => path.join(outDir, f));
}

/**
 * Apply alpha masking to a single frame PNG using vapc layout info.
 * Returns a Buffer of the composited RGBA PNG.
 */
async function applyAlphaMask(framePath, info) {
  const videoW = info.videoW || info.w * 2;
  const videoH = info.videoH || info.h;
  const w = info.w || Math.floor(videoW / 2);
  const h = info.h || videoH;

  // Fall back to left/right 50-50 split if layout is missing
  const halfW = Math.floor(videoW / 2);
  const rl = info.rgbLayout ?? { x: 0,     y: 0, w: halfW, h: videoH };
  const al = info.aLayout   ?? { x: halfW, y: 0, w: halfW, h: videoH };

  const img = sharp(framePath).ensureAlpha();
  const raw = await img.raw().toBuffer({ resolveWithObject: true });
  const { data, info: meta } = raw;
  const pw = meta.width;   // actual frame pixel width
  const ph = meta.height;  // actual frame pixel height

  // Scale factor between actual frame pixels and declared videoW/H
  const sx = pw / videoW;
  const sy = ph / videoH;

  // Scale layout coords to actual pixel coords
  const rgb = { x: rl.x * sx, y: rl.y * sy, w: rl.w * sx, h: rl.h * sy };
  const alp = { x: al.x * sx, y: al.y * sy, w: al.w * sx, h: al.h * sy };

  const outW = Math.round(w * sx);
  const outH = Math.round(h * sy);
  const outBuf = Buffer.alloc(outW * outH * 4);

  for (let oy = 0; oy < outH; oy++) {
    for (let ox = 0; ox < outW; ox++) {
      const u = ox / outW;
      const v = oy / outH;

      const rx = Math.min(Math.round(rgb.x + u * rgb.w), pw - 1);
      const ry = Math.min(Math.round(rgb.y + v * rgb.h), ph - 1);
      const ax = Math.min(Math.round(alp.x + u * alp.w), pw - 1);
      const ay = Math.min(Math.round(alp.y + v * alp.h), ph - 1);

      const ri = (ry * pw + rx) * 4;
      const ai = (ay * pw + ax) * 4;
      const oi = (oy * outW + ox) * 4;

      outBuf[oi]     = data[ri];
      outBuf[oi + 1] = data[ri + 1];
      outBuf[oi + 2] = data[ri + 2];
      outBuf[oi + 3] = data[ai]; // red channel of alpha area
    }
  }

  return sharp(outBuf, { raw: { width: outW, height: outH, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Build a SVGA v1 zip from extracted VAP frames.
 * Each frame becomes one sprite; only one sprite is visible per animation frame.
 */
async function buildSvgaFromFrames(framePaths, info) {
  const fps        = info.f || 20;
  const frameCount = framePaths.length;
  const w          = info.w || 320;
  const h          = info.h || 320;

  const zip    = new JSZip();
  const images = {};

  for (let i = 0; i < framePaths.length; i++) {
    const key    = `image_${i}`;
    const pngBuf = await applyAlphaMask(framePaths[i], info);
    // svgaplayerweb._loadImages does: zip.file(element + ".png")
    // so the images map value must NOT include the .png suffix.
    zip.file(`images/${key}.png`, pngBuf);
    images[key] = `images/${key}`;   // ← no .png here
  }

  // Identity transform — used for ALL frames (visible or hidden via alpha)
  const IDENTITY = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  const FULL_LAYOUT = { x: 0, y: 0, width: w, height: h };

  const sprites = framePaths.map((_, i) => ({
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
    movie: { fps, frames: frameCount, viewBox: { width: w, height: h } },
    images,
    sprites,
    audios: [],
  };

  zip.file('movie.spec', JSON.stringify(spec));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ─── SVGA parser helpers (v1 ZIP + v2 protobuf) ───────────────────────────────

/**
 * Parse a SVGA v1 ZIP.  Returns { fps, frameCount, width, height, spec, imageBuffers }.
 */
async function parseSvgaV1(zipBuffer) {
  const zip      = await JSZip.loadAsync(zipBuffer);
  const specFile = zip.files['movie.spec'];
  if (!specFile) throw new Error('不是有效的 SVGA v1 文件（缺少 movie.spec）');

  const spec = JSON.parse(await specFile.async('text'));
  const { fps = 20, frames: frameCount = 0, viewBox = {} } = spec.movie ?? {};
  const width  = viewBox.width  || 320;
  const height = viewBox.height || 320;

  const imageBuffers = {};
  for (const [key, imgPath] of Object.entries(spec.images ?? {})) {
    const candidates = [imgPath, `images/${key}.png`, `${key}.png`, key].filter(Boolean);
    for (const c of candidates) {
      if (zip.files[c]) {
        imageBuffers[key] = await zip.files[c].async('nodebuffer');
        break;
      }
    }
  }

  return { fps, frameCount, width, height, spec, imageBuffers };
}

/**
 * Parse a SVGA v2 binary (zlib-compressed protobuf MovieEntity).
 * Returns the same shape as parseSvgaV1 so callers are format-agnostic.
 */
async function parseSvgaV2(rawBuffer) {
  const MovieEntity = await getMovieEntityType();

  // Try inflate; if the data is not compressed, use it raw
  let decoded;
  try {
    const inflated = inflateSync(rawBuffer);
    decoded = MovieEntity.toObject(MovieEntity.decode(inflated), { defaults: true, longs: Number });
  } catch (_) {
    decoded = MovieEntity.toObject(MovieEntity.decode(rawBuffer), { defaults: true, longs: Number });
  }

  const params     = decoded.params ?? {};
  const fps        = params.fps    || 20;
  const frameCount = params.frames || 0;
  const width      = params.viewBoxWidth  || 320;
  const height     = params.viewBoxHeight || 320;

  // Build a v1-compatible spec so renderSvgaFrame can be reused
  const imageBuffers = {};
  const imagesMap    = {};
  for (const [key, bytes] of Object.entries(decoded.images ?? {})) {
    // protobufjs returns Uint8Array; convert to Buffer
    imageBuffers[key] = Buffer.from(bytes);
    imagesMap[key]    = `images/${key}`;
  }

  // Convert protobuf sprite / frame objects into the v1 JSON shape
  const sprites = (decoded.sprites ?? []).map((s) => ({
    imageKey: s.imageKey,
    matteKey: s.matteKey ?? '',
    frames: (s.frames ?? []).map((f) => ({
      alpha:  f.alpha ?? 0,
      layout: {
        x:      f.layout?.x      ?? 0,
        y:      f.layout?.y      ?? 0,
        width:  f.layout?.width  ?? width,
        height: f.layout?.height ?? height,
      },
      transform: {
        a: f.transform?.a ?? 1, b: f.transform?.b ?? 0,
        c: f.transform?.c ?? 0, d: f.transform?.d ?? 1,
        tx: f.transform?.tx ?? 0, ty: f.transform?.ty ?? 0,
      },
    })),
  }));

  const spec = {
    ver: '1.2.0',
    movie: { fps, frames: frameCount, viewBox: { width, height } },
    images: imagesMap,
    sprites,
    audios: [],
  };

  return { fps, frameCount, width, height, spec, imageBuffers };
}

/**
 * Auto-detect SVGA format (v1 ZIP vs v2 binary) and parse accordingly.
 */
async function parseSvgaFile(svgaBuffer) {
  // PK magic bytes → ZIP → SVGA v1 (or v2 wrapped in ZIP)
  const isZip = svgaBuffer[0] === 0x50 && svgaBuffer[1] === 0x4B
             && svgaBuffer[2] === 0x03 && svgaBuffer[3] === 0x04;
  if (isZip) {
    // Could still be v2 in ZIP (movie.binary). Try v1 first; gracefully handle v2-in-ZIP.
    try {
      return await parseSvgaV1(svgaBuffer);
    } catch (e) {
      // If movie.spec is missing, fall through to v2 parse
      if (!String(e.message).includes('movie.spec')) throw e;
    }
  }
  // Non-ZIP → must be v2 binary
  return await parseSvgaV2(svgaBuffer);
}

/**
 * Render a single SVGA v1 frame to RGBA PNG using sharp compositing.
 * Handles translation and uniform scaling; skips complex rotations/shears.
 */
async function renderSvgaFrame(spec, imageBuffers, frameIndex, width, height) {
  const composites = [];

  for (const sprite of spec.sprites ?? []) {
    const fd = sprite.frames?.[frameIndex];
    if (!fd) continue;

    const alpha = fd.alpha ?? 1;
    if (alpha <= 0) continue;

    const imgBuf = imageBuffers[sprite.imageKey];
    if (!imgBuf) continue;

    const layout    = fd.layout    ?? {};
    const transform = fd.transform ?? { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

    const lw = Math.round(Math.abs(layout.width  || 0));
    const lh = Math.round(Math.abs(layout.height || 0));
    if (lw <= 0 || lh <= 0) continue;

    // Resolve scale from transform diagonal
    const sx = Math.abs(transform.a ?? 1);
    const sy = Math.abs(transform.d ?? 1);
    const fw = Math.max(1, Math.round(lw * sx));
    const fh = Math.max(1, Math.round(lh * sy));

    const left = Math.max(0, Math.round((layout.x ?? 0) + (transform.tx ?? 0)));
    const top  = Math.max(0, Math.round((layout.y ?? 0) + (transform.ty ?? 0)));

    try {
      // Resize the sprite image to its target size
      const raw = await sharp(imgBuf)
        .resize(fw, fh, { fit: 'fill' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const data = Buffer.from(raw.data);
      // Apply sprite-level opacity
      if (alpha < 1) {
        for (let i = 3; i < data.length; i += 4) {
          data[i] = Math.round(data[i] * alpha);
        }
      }

      composites.push({
        input: await sharp(data, { raw: { width: fw, height: fh, channels: 4 } }).png().toBuffer(),
        left,
        top,
        blend: 'over',
      });
    } catch (e) {
      console.warn(`[svga-to-vap] frame ${frameIndex} sprite ${sprite.imageKey}:`, e.message);
    }
  }

  const base = sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  return composites.length > 0
    ? base.composite(composites).png().toBuffer()
    : base.png().toBuffer();
}

/**
 * Convert an RGBA PNG Buffer to a side-by-side VAP frame PNG:
 * left half = RGB content, right half = alpha (grayscale).
 */
async function makeVapFramePng(rgbaBuffer, w, h) {
  const { data } = await sharp(rgbaBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const videoW = w * 2;
  const out    = Buffer.alloc(videoW * h * 3);

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const si = (py * w + px) * 4;

      // Left: RGB
      const li = (py * videoW + px) * 3;
      out[li]     = data[si];
      out[li + 1] = data[si + 1];
      out[li + 2] = data[si + 2];

      // Right: Alpha channel as greyscale
      const ri = (py * videoW + (w + px)) * 3;
      const a  = data[si + 3];
      out[ri] = out[ri + 1] = out[ri + 2] = a;
    }
  }

  return sharp(out, { raw: { width: videoW, height: h, channels: 3 } }).png().toBuffer();
}

/**
 * Convert a SVGA v1 buffer to a VAP MP4 file buffer.
 */
async function buildVapFromSvga(svgaBuffer, options = {}) {
  const { fps: targetFps, scaleX = 1, scaleY = 1 } = options;
  const { fps, frameCount, width: rawW, height: rawH, spec, imageBuffers } = await parseSvgaFile(svgaBuffer);

  if (frameCount === 0) throw new Error('SVGA 动画帧数为 0');

  const displayW = toEven(Math.round(rawW * scaleX));
  const displayH = toEven(Math.round(rawH * scaleY));
  const videoW   = displayW * 2;  // side-by-side
  const videoH   = displayH;
  const outFps   = targetFps || fps;

  // Render all frames and save as PNG sequence
  const framesDir  = path.join(TMP, `svga2vap_${randomUUID()}`);
  const outputPath = path.join(TMP, `svga2vap_out_${randomUUID()}.mp4`);
  await fsp.mkdir(framesDir, { recursive: true });

  for (let i = 0; i < frameCount; i++) {
    const rgba    = await renderSvgaFrame(spec, imageBuffers, i, displayW, displayH);
    const vapPng  = await makeVapFramePng(rgba, displayW, displayH);
    const padded  = String(i + 1).padStart(4, '0');
    await fsp.writeFile(path.join(framesDir, `frame_${padded}.png`), vapPng);
  }

  // Encode PNG sequence as H.264 MP4
  const pattern = path.join(framesDir, 'frame_%04d.png');
  await runFfmpeg(pattern, outputPath, [
    `-framerate ${outFps}`,
    `-vf scale=${videoW}:${videoH}:flags=lanczos,format=yuv420p`,
    '-c:v libx264',
    '-crf 18',
    '-preset fast',
    '-an',
    '-movflags +faststart',
  ]);

  let outBuf = await fsp.readFile(outputPath);

  // Build vapc config
  const vapc = {
    info: {
      f:       outFps,
      w:       displayW,
      h:       displayH,
      videoW,
      videoH,
      orien:   0,
      alpha:   1,
      isAlignBothEnds: 0,
      rgbLayout:   { x: 0,        y: 0, w: displayW, h: displayH },
      aLayout:     { x: displayW, y: 0, w: displayW, h: displayH },
      sources: [],
    },
  };
  outBuf = rebuildWithVapc(outBuf, vapc);

  // Cleanup
  await fsp.rm(framesDir, { recursive: true, force: true }).catch(() => {});
  await fsp.unlink(outputPath).catch(() => {});

  return outBuf;
}

// ─── Scale config helper ───────────────────────────────────────────────────────
// Force a value to be even (required by libx264)
const toEven = (v) => Math.round(v / 2) * 2;

function scaleVapConfig(config, scaleX, scaleY) {
  const info = config.info;
  const sc     = (v, isX) => Math.round(v * (isX ? scaleX : scaleY));
  // videoW/H must be even for H.264 encoding
  const scEven = (v, isX) => toEven(sc(v, isX));
  const scaleLayout = (l) =>
    l ? { x: sc(l.x, true), y: sc(l.y, false), w: sc(l.w, true), h: sc(l.h, false) } : l;

  return {
    ...config,
    info: {
      ...info,
      w:      sc(info.w, true),
      h:      sc(info.h, false),
      videoW: scEven(info.videoW, true),
      videoH: scEven(info.videoH, false),
      rgbLayout: scaleLayout(info.rgbLayout),
      aLayout:   scaleLayout(info.aLayout),
    },
  };
}

// ─── POST handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
  const tmpFiles = [];
  const tmpDirs = [];

  const cleanup = async () => {
    for (const f of tmpFiles) await fsp.unlink(f).catch(() => {});
    for (const d of tmpDirs) await fsp.rm(d, { recursive: true, force: true }).catch(() => {});
  };

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const action = formData.get('action') || 'info';
    const optRaw = formData.get('options') || '{}';
    let options = {};
    try { options = JSON.parse(optRaw); } catch { /* ignore */ }

    if (!file || file.size === 0) {
      return NextResponse.json({ error: '未提供文件或文件为空' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // ── info ────────────────────────────────────────────────────────────────
    if (action === 'info') {
      const config = parseVapc(fileBuffer);
      if (!config) {
        return NextResponse.json(
          { error: '无法解析 vapc 配置，请确认文件是有效的 VAP(.mp4) 文件' },
          { status: 400 }
        );
      }
      return NextResponse.json({ config });
    }

    // ── resize ──────────────────────────────────────────────────────────────
    if (action === 'resize') {
      const config = parseVapc(fileBuffer);
      if (!config) {
        return NextResponse.json({ error: '无法解析 vapc 配置' }, { status: 400 });
      }

      const { scaleX = 1, scaleY = 1 } = options;
      const newConfig = scaleVapConfig(config, scaleX, scaleY);
      const { videoW: newVW, videoH: newVH } = newConfig.info;

      const inputPath = path.join(TMP, `vap_in_${randomUUID()}.mp4`);
      const outputPath = path.join(TMP, `vap_out_${randomUUID()}.mp4`);
      tmpFiles.push(inputPath, outputPath);

      await fsp.writeFile(inputPath, fileBuffer);

      // Ensure even dimensions (libx264 requirement) — scaleVapConfig already does this,
      // but apply toEven again as a safety net.
      const safeVW = toEven(newVW);
      const safeVH = toEven(newVH);

      await runFfmpeg(inputPath, outputPath, [
        `-vf scale=${safeVW}:${safeVH}:flags=lanczos,format=yuv420p`,
        '-c:v libx264',
        '-crf 18',
        '-preset fast',
        '-an',
        '-movflags +faststart',
      ]);

      let outBuf = await fsp.readFile(outputPath);
      outBuf = rebuildWithVapc(outBuf, newConfig);

      await cleanup();
      return new Response(outBuf, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': 'attachment; filename="resized.vap"',
          'Content-Length': String(outBuf.length),
        },
      });
    }

    // ── vap-to-svga ─────────────────────────────────────────────────────────
    if (action === 'vap-to-svga') {
      const config = parseVapc(fileBuffer);
      if (!config) {
        return NextResponse.json({ error: '无法解析 vapc 配置' }, { status: 400 });
      }

      const { maxFrames = 60, fps: targetFps } = options;
      const info = config.info;
      const fps = targetFps || info.f || 20;

      const inputPath = path.join(TMP, `vap_in_${randomUUID()}.mp4`);
      const framesDir = path.join(TMP, `vap_frames_${randomUUID()}`);
      tmpFiles.push(inputPath);
      tmpDirs.push(framesDir);

      await fsp.writeFile(inputPath, fileBuffer);
      await fsp.mkdir(framesDir, { recursive: true });

      const framePaths = await extractFrames(inputPath, framesDir, fps);
      const limitedPaths = framePaths.slice(0, maxFrames);

      if (limitedPaths.length === 0) {
        await cleanup();
        return NextResponse.json({ error: '无法从视频中提取帧' }, { status: 500 });
      }

      const svgaBuf = await buildSvgaFromFrames(limitedPaths, info);

      await cleanup();
      return new Response(svgaBuf, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="converted.svga"',
          'Content-Length': String(svgaBuf.length),
        },
      });
    }

    // ── svga-to-vap ─────────────────────────────────────────────────────────
    if (action === 'svga-to-vap') {
      const { scaleX = 1, scaleY = 1, fps: targetFps } = options;

      const vapBuf = await buildVapFromSvga(fileBuffer, { scaleX, scaleY, fps: targetFps });

      await cleanup();
      return new Response(vapBuf, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': 'attachment; filename="converted.vap"',
          'Content-Length': String(vapBuf.length),
        },
      });
    }

    await cleanup();
    return NextResponse.json({ error: `未知 action: ${action}` }, { status: 400 });
  } catch (e) {
    console.error('[vap API]', e);
    await cleanup();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
