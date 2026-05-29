import { DEFAULT_GIF_WEBP_CONFIG } from './parse-gif-config.js';

/** @typedef {'gif.convertToWebp'} ChatToolId */

export const CHAT_TOOL_IDS = {
  GIF_TO_WEBP: 'gif.convertToWebp',
};

export const CHAT_TOOLS = {
  [CHAT_TOOL_IDS.GIF_TO_WEBP]: {
    id: CHAT_TOOL_IDS.GIF_TO_WEBP,
    label: 'GIF 转 WebP',
    toolKey: 'gifToWebp',
    wikiSlug: 'gif-to-webp',
    acceptMime: ['image/gif'],
    acceptExt: /\.gif$/i,
    maxBytes: 20 * 1024 * 1024,
    defaultConfig: DEFAULT_GIF_WEBP_CONFIG,
  },
};

/**
 * @param {File} file
 * @returns {ChatToolId | null}
 */
export function detectToolForFile(file) {
  if (!file) return null;
  const tool = CHAT_TOOLS[CHAT_TOOL_IDS.GIF_TO_WEBP];
  if (tool.acceptMime.includes(file.type) || tool.acceptExt.test(file.name || '')) {
    return CHAT_TOOL_IDS.GIF_TO_WEBP;
  }
  return null;
}

/**
 * @param {string} text
 * @param {File[]} files
 */
export function shouldRunGifToWebp(text, files) {
  const hasGif = files.some((f) => detectToolForFile(f) === CHAT_TOOL_IDS.GIF_TO_WEBP);
  if (hasGif) return true;
  if (!files.length && /gif.*webp|webp.*gif|动图.*转|转成\s*webp/i.test(String(text || ''))) {
    return false;
  }
  return false;
}
