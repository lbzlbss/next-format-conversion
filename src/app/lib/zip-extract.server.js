import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import yauzl from 'yauzl';

import { ApiError } from '../api/_lib/guard.js';

const SUPPORTED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

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

  let scanBuf = buf;
  if (!(buf[0] === 0x50 && buf[1] === 0x4b)) {
    const scanLen = Math.min(buf.length, 65536);
    let offset = -1;
    for (let i = 0; i < scanLen - 3; i++) {
      if (buf[i] !== 0x50 || buf[i + 1] !== 0x4b) continue;
      const b2 = buf[i + 2];
      if (b2 === 0x03 || b2 === 0x05 || b2 === 0x07) {
        offset = i;
        break;
      }
    }
    if (offset > 0) {
      scanBuf = buf.subarray(offset);
    } else {
      const head = buf.slice(0, 120).toString('utf8');
      if (head.trimStart().startsWith('<') || head.includes('<!DOCTYPE')) {
        throw new ApiError(
          'BLOB_FETCH_FAILED',
          '下载内容不是 ZIP（疑似错误页面），请重新上传',
          502,
        );
      }
      throw new ApiError('INVALID_FORMAT', '不是有效的 ZIP 文件（缺少 PK 文件头）', 400, {
        sniff: buf.subarray(0, 8).toString('hex'),
      });
    }
  }
  const tailSource = scanBuf;

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

function openZip(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
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

function listImageEntries(zipfile) {
  return new Promise((resolve, reject) => {
    const entries = [];
    zipfile.readEntry();
    zipfile.on('entry', (entry) => {
      if (/\/$/.test(entry.fileName)) {
        zipfile.readEntry();
        return;
      }
      const ext = path.extname(entry.fileName).toLowerCase();
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
      resolve(entries);
    });
    zipfile.on('error', reject);
  });
}

/**
 * 使用 yauzl 解压序列帧（支持 ZIP64 / 大文件，避免 JSZip 中央目录错误）
 * @param {Buffer} zipBuffer
 * @param {string} workDir 可写临时目录
 * @returns {Promise<Array<{ name: string, readBuffer: () => Promise<Buffer> }>>}
 */
export async function extractZipImageFrames(zipBuffer, workDir) {
  validateZipBuffer(zipBuffer);
  let sourceBuf = zipBuffer;
  if (!(zipBuffer[0] === 0x50 && zipBuffer[1] === 0x4b)) {
    const scanLen = Math.min(zipBuffer.length, 65536);
    for (let i = 0; i < scanLen - 3; i++) {
      if (zipBuffer[i] === 0x50 && zipBuffer[i + 1] === 0x4b) {
        sourceBuf = zipBuffer.subarray(i);
        break;
      }
    }
  }

  const zipPath = path.join(workDir, '_source.zip');
  await fsp.writeFile(zipPath, sourceBuf);

  let zipfile;
  try {
    zipfile = await openZip(zipPath);
    const entries = await listImageEntries(zipfile);
    if (entries.length === 0) {
      throw new ApiError('INVALID_FORMAT', '压缩包中未找到可用图片（png/jpg/jpeg/webp）', 400);
    }
    return {
      frames: entries.map((entry) => ({
        name: entry.fileName,
        readBuffer: () => readEntryToBuffer(zipfile, entry),
      })),
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
