import { CHAT_MAX_BYTES } from './constants.js';
import { getFileCategory } from './resolve-tool.js';

export const CHAT_TOOL_IDS = {
  GIF_TO_WEBP: 'gif.convertToWebp',
  GIF_COMPRESS: 'gif.compress',
  GIF_TO_MP4: 'gif.toMp4',
  MP4_COMPRESS: 'mp4.compress',
  MP4_FIRST_FRAME: 'mp4.firstFrame',
  IMAGE_COMPRESS: 'image.compress',
  AI_GENERATE_IMAGE: 'ai.generateImage',
};

/** @type {Record<string, {
 *   id: string,
 *   label: string,
 *   toolKey?: string|null,
 *   wikiSlug?: string,
 *   endpoint: string,
 *   maxBytes: number,
 *   needsFile: boolean,
 *   acceptMime?: string[],
 *   acceptExt?: RegExp,
 *   outputName?: (inputName: string, config: Record<string, unknown>) => string,
 * }>} */
export const CHAT_TOOLS = {
  [CHAT_TOOL_IDS.GIF_TO_WEBP]: {
    id: CHAT_TOOL_IDS.GIF_TO_WEBP,
    label: 'GIF 转 WebP',
    toolKey: 'gifToWebp',
    wikiSlug: 'gif-to-webp',
    endpoint: '/api/convert-gif',
    maxBytes: CHAT_MAX_BYTES.gif,
    needsFile: true,
    acceptMime: ['image/gif'],
    acceptExt: /\.gif$/i,
    outputName: (name) => String(name || 'out.gif').replace(/\.gif$/i, '.webp'),
  },
  [CHAT_TOOL_IDS.GIF_COMPRESS]: {
    id: CHAT_TOOL_IDS.GIF_COMPRESS,
    label: 'GIF 压缩',
    toolKey: 'gifCompress',
    wikiSlug: 'gif-compress',
    endpoint: '/api/compress-gif',
    maxBytes: CHAT_MAX_BYTES.gif,
    needsFile: true,
    acceptMime: ['image/gif'],
    acceptExt: /\.gif$/i,
    outputName: (name) => `compressed-${name || 'out.gif'}`,
  },
  [CHAT_TOOL_IDS.GIF_TO_MP4]: {
    id: CHAT_TOOL_IDS.GIF_TO_MP4,
    label: 'GIF 转 MP4',
    toolKey: 'gifToMp4',
    wikiSlug: 'gif-to-mp4',
    endpoint: '/api/gif-to-mp4',
    maxBytes: CHAT_MAX_BYTES.gif,
    needsFile: true,
    acceptMime: ['image/gif'],
    acceptExt: /\.gif$/i,
    outputName: (name) => String(name || 'out.gif').replace(/\.gif$/i, '.mp4'),
  },
  [CHAT_TOOL_IDS.MP4_COMPRESS]: {
    id: CHAT_TOOL_IDS.MP4_COMPRESS,
    label: 'MP4 压缩',
    toolKey: 'mp4Compress',
    wikiSlug: 'mp4-compress',
    endpoint: '/api/compress-mp4',
    maxBytes: CHAT_MAX_BYTES.mp4,
    needsFile: true,
    acceptMime: ['video/mp4'],
    acceptExt: /\.mp4$/i,
    outputName: (name) => `compressed_${name || 'video.mp4'}`,
  },
  [CHAT_TOOL_IDS.MP4_FIRST_FRAME]: {
    id: CHAT_TOOL_IDS.MP4_FIRST_FRAME,
    label: 'MP4 提取首帧',
    toolKey: null,
    endpoint: '/api/mp4-first-frame',
    maxBytes: CHAT_MAX_BYTES.mp4,
    needsFile: true,
    acceptMime: ['video/mp4'],
    acceptExt: /\.mp4$/i,
    outputName: (name, config) => {
      const fmt = config?.format === 'png' ? 'png' : 'webp';
      const stem = String(name || 'video.mp4').replace(/\.mp4$/i, '');
      return `${stem}_first_frame.${fmt}`;
    },
  },
  [CHAT_TOOL_IDS.IMAGE_COMPRESS]: {
    id: CHAT_TOOL_IDS.IMAGE_COMPRESS,
    label: '图片压缩',
    toolKey: 'imageCompress',
    wikiSlug: 'image-compress',
    endpoint: '/api/compress-image',
    maxBytes: CHAT_MAX_BYTES.image,
    needsFile: true,
    acceptMime: ['image/jpeg', 'image/png', 'image/webp'],
    acceptExt: /\.(jpe?g|png|webp)$/i,
    outputName: (_name, config) => {
      const fmt =
        config?.outputFormat && config.outputFormat !== 'original'
          ? config.outputFormat
          : 'jpg';
      return `compressed.${fmt === 'jpeg' ? 'jpg' : fmt}`;
    },
  },
  [CHAT_TOOL_IDS.AI_GENERATE_IMAGE]: {
    id: CHAT_TOOL_IDS.AI_GENERATE_IMAGE,
    label: 'AI 文生图',
    toolKey: 'imageGenerate',
    wikiSlug: 'image-generate',
    endpoint: '/api/generate-image',
    maxBytes: 0,
    needsFile: false,
  },
};

/** 有附件时可用的工具（按文件类型） */
export function listToolsForFile(file) {
  const category = getFileCategory(file);
  if (!category) return [];
  return Object.values(CHAT_TOOLS).filter((t) => {
    if (!t.needsFile) return false;
    if (category === 'gif') {
      return t.acceptExt?.test('.gif') || t.acceptMime?.includes('image/gif');
    }
    if (category === 'mp4') {
      return t.acceptMime?.includes('video/mp4');
    }
    if (category === 'image') {
      return t.id === CHAT_TOOL_IDS.IMAGE_COMPRESS;
    }
    return false;
  });
}

/**
 * @param {File} file
 * @returns {string|null}
 */
export function detectToolForFile(file) {
  const list = listToolsForFile(file);
  return list[0]?.id ?? null;
}

export const CHAT_TOOL_LIST = Object.values(CHAT_TOOLS);
