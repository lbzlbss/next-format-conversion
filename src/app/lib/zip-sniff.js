/**
 * ZIP / 常见压缩包魔数探测（浏览器与 Node 通用）
 */

const SCAN_BYTES = 262144;

/**
 * @param {Uint8Array} bytes
 * @returns {number} PK 签名起始偏移，-1 表示未找到
 */
export function findZipMagicOffset(bytes) {
  const scan = Math.min(bytes.length, SCAN_BYTES);
  for (let i = 0; i < scan - 3; i++) {
    if (bytes[i] !== 0x50 || bytes[i + 1] !== 0x4b) continue;
    const sig2 = bytes[i + 2];
    if (sig2 === 0x03 || sig2 === 0x05 || sig2 === 0x07) return i;
  }
  return -1;
}

/**
 * @param {Uint8Array} bytes
 * @returns {'ZIP'|'RAR'|'7Z'|'GZIP'|'BZIP'|'TAR'|'JSON'|'HTML'|'UNKNOWN'}
 */
export function detectArchiveKind(bytes) {
  if (!bytes || bytes.length < 4) return 'UNKNOWN';
  if (findZipMagicOffset(bytes) >= 0) return 'ZIP';
  if (bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21) return 'RAR';
  if (bytes[0] === 0x37 && bytes[1] === 0x7a && bytes[2] === 0xbc && bytes[3] === 0xaf) return '7Z';
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return 'GZIP';
  if (bytes[0] === 0x42 && bytes[1] === 0x5a) return 'BZIP';
  if (bytes[0] === 0x75 && bytes[1] === 0x73 && bytes[2] === 0x74 && bytes[3] === 0x61) return 'TAR';
  const text = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 120)));
  const trim = text.trimStart();
  if (trim.startsWith('{') || trim.startsWith('[')) return 'JSON';
  if (trim.startsWith('<') || trim.includes('<!DOCTYPE')) return 'HTML';
  return 'UNKNOWN';
}

/**
 * @param {'ZIP'|'RAR'|'7Z'|'GZIP'|'BZIP'|'TAR'|'JSON'|'HTML'|'UNKNOWN'} kind
 * @param {string} [fileName]
 */
export function invalidZipUserMessage(kind, fileName = '') {
  const name = fileName ? `「${fileName}」` : '该文件';
  switch (kind) {
    case 'RAR':
      return `${name} 是 RAR 格式。请先解压序列帧文件夹，再用系统「压缩」/ 7-Zip 打成标准 .zip（存储模式即可）。`;
    case '7Z':
      return `${name} 是 7z 格式。请用 7-Zip / macOS 归档工具重新导出为 .zip。`;
    case 'GZIP':
      return `${name} 是 gzip/tar.gz 一类格式，不是 ZIP。请打包为 .zip。`;
    case 'TAR':
      return `${name} 是 tar 包。请在 Finder/资源管理器中右键文件夹 → 压缩，生成 .zip。`;
    case 'JSON':
    case 'HTML':
      return `${name} 内容像网页/接口响应，不是压缩包。请重新选择本机上的 .zip 文件。`;
    default:
      return (
        `${name} 不是标准 ZIP（前 256KB 内未找到 PK 头）。` +
        '请确认：① 扩展名为 .zip；② 非分卷压缩（.z01）；③ 用系统/7-Zip 对「序列帧文件夹」重新压缩。'
      );
  }
}
