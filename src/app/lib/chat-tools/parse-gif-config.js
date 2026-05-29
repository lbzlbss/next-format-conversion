/** @typedef {{ quality: number, effort: number, speed: number, nearLossless: boolean }} GifWebpConfig */

export const DEFAULT_GIF_WEBP_CONFIG = {
  quality: 80,
  effort: 4,
  speed: 5,
  nearLossless: false,
};

/**
 * 从用户自然语言中解析 WebP 转换参数
 * @param {string} text
 * @param {GifWebpConfig} [defaults]
 * @returns {GifWebpConfig}
 */
export function parseGifConfigFromText(text, defaults = DEFAULT_GIF_WEBP_CONFIG) {
  const config = { ...defaults };
  const q = String(text || '');

  const qualityMatch = q.match(/(?:质量|quality)\s*[:：]?\s*(\d{1,3})/i);
  if (qualityMatch) {
    config.quality = Math.min(100, Math.max(1, Number(qualityMatch[1])));
  }

  if (/(?:尽量小|压缩|体积小|瘦身)/i.test(q)) {
    config.quality = Math.min(config.quality, 65);
    config.effort = Math.max(config.effort, 5);
  }

  if (/(?:清晰|高质量|画质)/i.test(q)) {
    config.quality = Math.max(config.quality, 85);
  }

  if (/near\s*lossless|接近无损/i.test(q)) {
    config.nearLossless = true;
  }

  return config;
}
