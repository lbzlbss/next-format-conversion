import { CHAT_TOOL_IDS, CHAT_TOOLS } from './registry.js';

/**
 * @param {File} file
 * @returns {'gif'|'mp4'|'image'|null}
 */
export function getFileCategory(file) {
  if (!file) return null;
  const name = String(file.name || '');
  const type = String(file.type || '');
  if (type === 'image/gif' || /\.gif$/i.test(name)) return 'gif';
  if (type === 'video/mp4' || /\.mp4$/i.test(name)) return 'mp4';
  if (
    type.startsWith('image/') &&
    type !== 'image/gif' &&
    (type === 'image/jpeg' ||
      type === 'image/png' ||
      type === 'image/webp' ||
      /\.(jpe?g|png|webp)$/i.test(name))
  ) {
    return 'image';
  }
  return null;
}

/**
 * @param {string} text
 * @param {'gif'|'mp4'|'image'} category
 * @returns {string|null}
 */
function resolveByText(text, category) {
  const q = String(text || '');

  if (category === 'gif') {
    if (/webp/i.test(q)) return CHAT_TOOL_IDS.GIF_TO_WEBP;
    if (/mp4|视频/i.test(q)) return CHAT_TOOL_IDS.GIF_TO_MP4;
    if (/(?:压缩|缩小|瘦身)/i.test(q) && !/webp|mp4/i.test(q)) {
      return CHAT_TOOL_IDS.GIF_COMPRESS;
    }
    return CHAT_TOOL_IDS.GIF_TO_WEBP;
  }

  if (category === 'mp4') {
    if (/(?:首帧|封面|第一帧|抽帧|thumbnail|frame)/i.test(q)) {
      return CHAT_TOOL_IDS.MP4_FIRST_FRAME;
    }
    return CHAT_TOOL_IDS.MP4_COMPRESS;
  }

  if (category === 'image') {
    return CHAT_TOOL_IDS.IMAGE_COMPRESS;
  }

  return null;
}

/**
 * 无附件时：文生图
 * @param {string} text
 */
export function resolveTextOnlyTool(text) {
  const q = String(text || '').trim();
  if (!q) return null;
  if (
    /(?:文生图|生成.{0,6}图|画一|绘制|生图|ai\s*绘图|出图)/i.test(q) &&
    q.length >= 4
  ) {
    return CHAT_TOOL_IDS.AI_GENERATE_IMAGE;
  }
  return null;
}

/**
 * @param {{ file?: File|null, text?: string, preferredToolId?: string|null }} p
 */
export function resolveChatTool({ file, text = '', preferredToolId = null }) {
  if (preferredToolId && CHAT_TOOLS[preferredToolId]) {
    return preferredToolId;
  }

  if (!file) {
    return resolveTextOnlyTool(text);
  }

  const category = getFileCategory(file);
  if (!category) return null;

  return resolveByText(text, category);
}

/**
 * @param {string} toolId
 * @param {File} file
 */
export function defaultPromptForTool(toolId, file) {
  const name = file?.name || '附件';
  const tool = CHAT_TOOLS[toolId];
  if (!tool) return `请处理附件「${name}」`;
  return `请使用「${tool.label}」处理附件「${name}」并提供下载`;
}
