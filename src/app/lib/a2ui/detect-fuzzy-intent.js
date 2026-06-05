/**
 * 判断用户文本是否已包含明确转换参数（有则跳过 ParamForm）
 * @param {string} text
 */
export function hasExplicitToolParams(text) {
  const q = String(text || '');
  if (/(?:质量|quality|crf|fps|帧率|宽|高|width|height)\s*[:：]?\s*\d+/i.test(q)) {
    return true;
  }
  if (/near\s*lossless|接近无损/i.test(q)) return true;
  if (/\b(720|1080|4k)\b/i.test(q)) return true;
  return false;
}

/**
 * GIF 附件场景：工具类型不明确（需在表单中选 WebP / 压缩 / MP4）
 * @param {string} text
 */
export function isAmbiguousGifTool(text) {
  const q = String(text || '').trim();
  if (!q) return true;
  if (/(?:webp|mp4|压缩|compress|转\s*mp4)/i.test(q)) return false;
  if (/(?:压|弄小|处理|转换|转一下|帮我)/i.test(q)) return true;
  return false;
}

/**
 * 是否应先展示 ParamForm 再执行工具
 * @param {{ toolId: string, text: string, needsFile: boolean }} p
 */
export function shouldShowParamForm({ toolId, text, needsFile }) {
  if (!needsFile) return false;
  if (hasExplicitToolParams(text)) return false;

  const q = String(text || '').trim();
  if (!q) return true;

  if (/(?:压一下|弄小点|处理一下|帮我弄|尽量小|压缩一下|转一下|转换一下)/i.test(q)) {
    return true;
  }

  if (toolId.startsWith('gif.') && isAmbiguousGifTool(text)) return true;

  if (
    /(?:压缩|缩小|瘦身|处理)/i.test(q) &&
    !/(?:webp|mp4|png|jpe?g|质量|quality)/i.test(q)
  ) {
    return true;
  }

  return false;
}
