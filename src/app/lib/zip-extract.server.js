import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import yauzl from 'yauzl';

import { ApiError } from '../api/_lib/guard.js';
import { isSupportedSequenceFrame, unsupportedFrameUserMessage } from './image-sniff.js';
import { detectArchiveKind, findZipMagicOffset, invalidZipUserMessage } from './zip-sniff.js';

const SUPPORTED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac']);

/** macOS / Windows 压缩包常见垃圾条目 */
function shouldSkipZipEntry(fileName) {
  const normalized = String(fileName || '').replace(/\\/g, '/');
  if (/__MACOSX\//i.test(normalized) || /\/\.DS_Store$/i.test(normalized)) return true;
  const base = path.basename(normalized);
  if (base === '.DS_Store' || base === 'Thumbs.db' || base.startsWith('._')) return true;
  return false;
}

function naturalKey(s) {
  const parts = String(s).split(/(\d+)/g);
  return parts.map((p) => (p && /^\d+$/.test(p) ? Number(p) : String(p).toLowerCase()));
}

function cmpNatural(a, b) {
  const ak = naturalKey(a);
  const bk = naturalKey(b);
  const n = Math.max(ak.length, bk.length);
  for (let i = 0; i < n; i++) {
    const av = ak[i];
    const bv = bk[i];
    if (av == null && bv == null) return 0;
    if (av == null) return -1;
    if (bv == null) return 1;
    if (typeof av === 'number' && typeof bv === 'number') {
      if (av !== bv) return av - bv;
      continue;
    }
    const as = String(av);
    const bs = String(bv);
    if (as !== bs) return as < bs ? -1 : 1;
  }
  return 0;
}

/**
 * 校验 ZIP 魔数与目录尾（含 ZIP64 locator），避免截断/HTML 错误页
 * @param {Buffer} buf
 * @param {number | null} expectedBytes
 */
export function validateZipBuffer(buf, expectedBytes = null) {
  if (!buf || buf.length < 22) {
    throw new ApiError('INVALID_FORMAT', '文件过小或不是有效的 ZIP', 400);
  }

  if (expectedBytes != null && expectedBytes > 0 && buf.length !== expectedBytes) {
    throw new ApiError(
      'BLOB_FETCH_FAILED',
      `ZIP 下载不完整：期望 ${expectedBytes} 字节，实际 ${buf.length} 字节。请重新上传。`,
      502,
      { expectedBytes, actualBytes: buf.length },
    );
  }

  const pkOffset = findZipMagicOffset(buf);
  if (pkOffset < 0) {
    const kind = detectArchiveKind(buf);
    const msg = invalidZipUserMessage(kind);
    const code = kind === 'HTML' || kind === 'JSON' ? 'BLOB_FETCH_FAILED' : 'INVALID_FORMAT';
    throw new ApiError(code, msg, code === 'BLOB_FETCH_FAILED' ? 502 : 400, {
      sniff: buf.subarray(0, 8).toString('hex'),
    });
  }
  const tailSource = pkOffset > 0 ? buf.subarray(pkOffset) : buf;

  const tailLen = Math.min(tailSource.length, 65557);
  const tail = tailSource.slice(tailSource.length - tailLen);
  let hasEnd = false;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] !== 0x50 || tail[i + 1] !== 0x4b) continue;
    const sig2 = tail[i + 2];
    const sig3 = tail[i + 3];
    if ((sig2 === 0x05 && sig3 === 0x06) || (sig2 === 0x06 && sig3 === 0x07)) {
      hasEnd = true;
      break;
    }
  }
  if (!hasEnd) {
    throw new ApiError(
      'BLOB_FETCH_FAILED',
      'ZIP 文件不完整（未找到中央目录），上传可能中断或超过平台限制',
      502,
    );
  }
}

/** 内存打开 ZIP，避免大文件再写入 /tmp（Vercel /tmp 约 512MB） */
function openZipFromBuffer(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) reject(err);
      else resolve(zipfile);
    });
  });
}

function readEntryToBuffer(zipfile, entry) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err || !stream) {
        reject(err || new Error('无法打开 ZIP 条目'));
        return;
      }
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  });
}

function listImageAndAudioEntries(zipfile) {
  return new Promise((resolve, reject) => {
    const entries = [];
    let audioEntry = null;
    zipfile.readEntry();
    zipfile.on('entry', (entry) => {
      if (/\/$/.test(entry.fileName) || shouldSkipZipEntry(entry.fileName)) {
        zipfile.readEntry();
        return;
      }
      const ext = path.extname(entry.fileName).toLowerCase();
      if (AUDIO_EXTS.has(ext)) {
        if (!audioEntry) audioEntry = entry;
        zipfile.readEntry();
        return;
      }
      if (!SUPPORTED_IMAGE_EXTS.has(ext)) {
        zipfile.readEntry();
        return;
      }
      entries.push(entry);
      zipfile.readEntry();
    });
    zipfile.on('end', () => {
      entries.sort((a, b) =>
        cmpNatural(path.basename(a.fileName), path.basename(b.fileName)),
      );
      resolve({ entries, audioEntry });
    });
    zipfile.on('error', reject);
  });
}

/**
 * 使用 yauzl 解压序列帧（支持 ZIP64 / 大文件，避免 JSZip 中央目录错误）
 * @param {Buffer} zipBuffer
 * @param {string} [_workDir] 保留参数以兼容调用方；不再将整包写入磁盘
 * @returns {Promise<{ frames: Array<{ name: string, readBuffer: () => Promise<Buffer> }>, audio: { name: string, readBuffer: () => Promise<Buffer> } | null, dispose: () => Promise<void> }>}
 */
export async function extractZipImageFrames(zipBuffer, _workDir) {
  validateZipBuffer(zipBuffer);
  let sourceBuf = zipBuffer;
  const pkOffset = findZipMagicOffset(zipBuffer);
  if (pkOffset > 0) {
    sourceBuf = zipBuffer.subarray(pkOffset);
  }

  let zipfile;
  try {
    zipfile = await openZipFromBuffer(sourceBuf);
    const { entries, audioEntry } = await listImageAndAudioEntries(zipfile);
    if (entries.length === 0) {
      throw new ApiError(
        'INVALID_FORMAT',
        '压缩包中未找到可用序列帧（png/jpg/jpeg/webp/gif）。若用 macOS 压缩，请删除 __MACOSX 与 ._ 开头文件后重新打包。',
        400,
      );
    }
    return {
      frames: entries.map((entry) => ({
        name: entry.fileName,
        readBuffer: async () => {
          const buf = await readEntryToBuffer(zipfile, entry);
          if (!isSupportedSequenceFrame(buf)) {
            throw new ApiError('INVALID_FORMAT', unsupportedFrameUserMessage(entry.fileName), 400, {
              frame: entry.fileName,
            });
          }
          return buf;
        },
      })),
      audio: audioEntry
        ? {
            name: audioEntry.fileName,
            readBuffer: () => readEntryToBuffer(zipfile, audioEntry),
          }
        : null,
      async dispose() {
        await new Promise((resolve) => {
          try {
            zipfile.close();
          } catch {
            /* ignore */
          }
          resolve();
        });
      },
    };
  } catch (e) {
    try {
      zipfile?.close();
    } catch {
      /* ignore */
    }
    if (e instanceof ApiError) throw e;
    const msg = String(e?.message || e);
    if (/central directory|end of central|zip file/i.test(msg)) {
      throw new ApiError(
        'INVALID_FORMAT',
        'ZIP 无法解析（可能损坏或为分卷压缩）。请用标准 ZIP 重新打包序列帧后再试。',
        400,
      );
    }
    throw new ApiError('INVALID_FORMAT', `ZIP 解压失败: ${msg}`, 400);
  }
}
