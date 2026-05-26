import { spawn } from 'child_process';

import { requireFfmpegBin } from './ffmpeg-path.server.js';

/**
 * @param {{
 *   fps: number,
 *   filterComplex: string,
 *   crf?: number,
 *   audioPath?: string | null,
 *   frames: AsyncIterable<Buffer> | Iterable<Buffer>,
 *   outMp4?: string,
 * }} opts
 * @returns {Promise<Buffer | void>}
 */
export function runFfmpegImage2Pipe(opts) {
  const { fps, filterComplex, crf = 18, audioPath = null, frames, outMp4 } = opts;
  const toBuffer = !outMp4;
  const ffmpegBin = requireFfmpegBin();

  const args = [
    '-y',
    '-f',
    'image2pipe',
    '-vcodec',
    'png',
    '-framerate',
    String(fps),
    '-i',
    'pipe:0',
  ];
  if (audioPath) args.push('-i', audioPath);
  args.push('-filter_complex', filterComplex, '-map', '[v]');
  if (audioPath) {
    args.push('-map', '1:a:0?', '-shortest');
  }
  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    String(Math.min(28, Math.max(15, crf))),
    '-g',
    '1',
    '-keyint_min',
    '1',
    '-sc_threshold',
    '0',
    '-bf',
    '0',
    '-pix_fmt',
    'yuv420p',
    '-x264-params',
    'rc-lookahead=0:ref=2:sync-lookahead=0',
  );
  if (audioPath) {
    args.push('-c:a', 'aac', '-b:a', '128k');
  }

  if (toBuffer) {
    // 不写 /tmp：避免 +faststart 二次落盘导致 ENOSPC
    args.push('-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', 'pipe:1');
  } else {
    args.push('-movflags', '+faststart', outMp4);
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin, args, {
      stdio: ['pipe', toBuffer ? 'pipe' : 'ignore', 'pipe'],
    });
    let stderr = '';
    /** @type {Buffer[]} */
    const stdoutChunks = [];

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    if (toBuffer) {
      proc.stdout.on('data', (chunk) => {
        stdoutChunks.push(Buffer.from(chunk));
      });
    }

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg 退出码 ${code}\nffmpeg stderr:\n${stderr}`));
        return;
      }
      if (toBuffer) resolve(Buffer.concat(stdoutChunks));
      else resolve();
    });

    const writeChunk = (buf) =>
      new Promise((res, rej) => {
        const ok = proc.stdin.write(buf, (err) => {
          if (err) rej(err);
        });
        if (ok) res();
        else proc.stdin.once('drain', res);
      });

    (async () => {
      try {
        for await (const pngBuf of frames) {
          await writeChunk(pngBuf);
        }
        proc.stdin.end();
      } catch (e) {
        proc.stdin.destroy();
        proc.kill('SIGKILL');
        reject(e);
      }
    })();
  });
}
