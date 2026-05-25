/**
 * 序列帧图片魔数探测（Sharp 可读格式）
 */

/**
 * @param {Buffer | Uint8Array} buf
 * @returns {'png'|'jpeg'|'gif'|'webp'|null}
 */
export function detectRasterImageFormat(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

/**
 * @param {Buffer | Uint8Array} buf
 */
export function isSupportedSequenceFrame(buf) {
  return detectRasterImageFormat(buf) != null;
}

/**
 * @param {string} fileName
 */
export function unsupportedFrameUserMessage(fileName) {
  const name = fileName ? `「${fileName}」` : '其中某一帧';
  return (
    `${name} 不是有效的 PNG/JPEG/WebP/GIF 图片。` +
    '常见于 macOS 压缩包里的 ._ 附属文件、__MACOSX 目录或扩展名与内容不符的文件。' +
    '请只保留序列帧图片后重新打 zip（可先在 Finder 中删除 __MACOSX 与以 ._ 开头的文件）。'
  );
}
