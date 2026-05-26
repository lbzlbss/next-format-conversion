import { spawn } from 'child_process';

import { requireFfmpegBin } from './ffmpeg-path.server.js';

/**
 * 经 stdin 喂 PNG 序列，避免在 /tmp 落盘全部帧
 * @param {{
 *   fps: number,
 *   filterComplex: string,
 *   outMp4: string,
 *   crf?: number,
 *   audioPath?: string | null,
 *   frames: AsyncIterable<Buffer> | Iterable<Buffer>,
 * }} opts
 */
export function runFfmpegImage2Pipe(opts) {
  const { fps, filterComplex, outMp4, crf = 18, audioPath = null, frames } = opts;
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
  args.push(
    '-filter_complex',
    filterComplex,
    '-map',
    '[v]',
  );
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
  );
  if (audioPath) {
    args.push('-c:a', 'aac', '-b:a', '128k');
  }
  args.push('-movflags', '+faststart', outMp4);

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg 退出码 ${code}\nffmpeg stderr:\n${stderr}`));
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
