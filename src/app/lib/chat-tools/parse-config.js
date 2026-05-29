import { DEFAULT_GIF_WEBP_CONFIG } from './parse-gif-config.js';

/**
 * @param {string} toolId
 * @param {string} text
 */
export function parseConfigForTool(toolId, text) {
  const q = String(text || '');

  switch (toolId) {
    case 'gif.convertToWebp': {
      const config = { ...DEFAULT_GIF_WEBP_CONFIG };
      const qualityMatch = q.match(/(?:质量|quality)\s*[:：]?\s*(\d{1,3})/i);
      if (qualityMatch) config.quality = Math.min(100, Math.max(1, Number(qualityMatch[1])));
      if (/(?:尽量小|压缩|体积小|瘦身)/i.test(q)) {
        config.quality = Math.min(config.quality, 65);
        config.effort = 5;
      }
      if (/(?:清晰|高质量)/i.test(q)) config.quality = Math.max(config.quality, 85);
      if (/near\s*lossless|接近无损/i.test(q)) config.nearLossless = true;
      return config;
    }
    case 'gif.compress': {
      const config = {
        quality: 30,
        effort: 10,
        speed: 1,
        colors: 32,
        dither: 0.2,
        compressionLevel: 9,
        lossy: true,
      };
      const qualityMatch = q.match(/(?:质量|quality)\s*[:：]?\s*(\d{1,3})/i);
      if (qualityMatch) config.quality = Math.min(100, Math.max(1, Number(qualityMatch[1])));
      if (/(?:尽量小|压缩|体积小)/i.test(q)) config.quality = Math.min(config.quality, 25);
      return config;
    }
    case 'gif.toMp4': {
      const config = { crf: 23, preset: 'medium', fps: 30, bitrate: '192k' };
      const fpsMatch = q.match(/(?:fps|帧率)\s*[:：]?\s*(\d{1,2})/i);
      if (fpsMatch) config.fps = Math.min(60, Math.max(1, Number(fpsMatch[1])));
      if (/(?:高画质|清晰)/i.test(q)) config.crf = 20;
      if (/(?:小体积|压缩)/i.test(q)) config.crf = 28;
      return config;
    }
    case 'mp4.compress': {
      const config = { crf: 23, preset: 'medium', bitrate: '128k', maxWidth: null, maxHeight: null };
      if (/(?:小体积|压缩|瘦身)/i.test(q)) config.crf = 28;
      if (/(?:高画质|清晰)/i.test(q)) config.crf = 20;
      const wMatch = q.match(/(?:宽|width)\s*[:：]?\s*(\d{3,4})/i);
      const hMatch = q.match(/(?:高|height)\s*[:：]?\s*(\d{3,4})/i);
      if (wMatch) config.maxWidth = Number(wMatch[1]);
      if (hMatch) config.maxHeight = Number(hMatch[1]);
      if (/720/i.test(q)) config.maxHeight = 720;
      if (/1080/i.test(q)) config.maxHeight = 1080;
      return config;
    }
    case 'mp4.firstFrame': {
      const config = { format: 'webp', quality: 80, effort: 4 };
      if (/png/i.test(q)) config.format = 'png';
      if (/webp/i.test(q)) config.format = 'webp';
      const qualityMatch = q.match(/(?:质量|quality)\s*[:：]?\s*(\d{1,3})/i);
      if (qualityMatch) config.quality = Math.min(100, Math.max(1, Number(qualityMatch[1])));
      return config;
    }
    case 'image.compress': {
      const config = {
        quality: 80,
        outputFormat: 'original',
        maxWidth: null,
        maxHeight: null,
        preserveExif: true,
        stripMetadata: false,
      };
      const qualityMatch = q.match(/(?:质量|quality)\s*[:：]?\s*(\d{1,3})/i);
      if (qualityMatch) config.quality = Math.min(100, Math.max(1, Number(qualityMatch[1])));
      if (/webp/i.test(q)) config.outputFormat = 'webp';
      if (/png/i.test(q)) config.outputFormat = 'png';
      if (/jpe?g/i.test(q)) config.outputFormat = 'jpeg';
      if (/720/i.test(q)) config.maxHeight = 720;
      if (/1080/i.test(q)) config.maxHeight = 1080;
      if (/(?:去元数据|strip)/i.test(q)) config.stripMetadata = true;
      return config;
    }
    default:
      return {};
  }
}
