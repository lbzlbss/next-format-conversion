import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);

/** @type {string | null} */
let cached = null;

/** @returns {string | null} */
export function getFfmpegBin() {
  if (cached) return cached;
  try {
    const ffmpegStatic = _require('ffmpeg-static');
    const binPath = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic?.default;
    if (binPath && fs.existsSync(binPath)) {
      cached = binPath;
      return cached;
    }
  } catch {
    /* ignore */
  }
  for (const p of ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', path.join(process.cwd(), 'public', 'ffmpeg', 'ffmpeg')]) {
    if (fs.existsSync(p)) {
      cached = p;
      return cached;
    }
  }
  return null;
}

export function requireFfmpegBin() {
  const bin = getFfmpegBin();
  if (!bin) {
    throw new Error('未找到 ffmpeg 可执行文件');
  }
  return bin;
}
