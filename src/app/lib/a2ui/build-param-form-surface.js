import { CHAT_TOOLS, CHAT_TOOL_IDS } from '../chat-tools/registry.js';
import { parseConfigForTool } from '../chat-tools/parse-config.js';
import { isAmbiguousGifTool } from './detect-fuzzy-intent.js';
import { MEDIAFLOW_CHAT_CATALOG_ID } from './constants.js';

/**
 * @typedef {{
 *   id: string,
 *   component: string,
 *   [key: string]: unknown,
 * }} ParamFieldNode
 */

/**
 * @param {string} toolId
 * @param {string} userText
 * @param {{ allowToolPick?: boolean }} [options]
 * @returns {{ fields: ParamFieldNode[], params: Record<string, unknown> }}
 */
function fieldsForTool(toolId, userText, options = {}) {
  const defaults = parseConfigForTool(toolId, userText);
  /** @type {ParamFieldNode[]} */
  const fields = [];

  if (options.allowToolPick) {
    fields.push(
      {
        id: 'toolId',
        component: 'Select',
        label: '选择工具',
        path: '/params/toolId',
        options: [
          { value: CHAT_TOOL_IDS.GIF_TO_WEBP, label: 'GIF 转 WebP' },
          { value: CHAT_TOOL_IDS.GIF_COMPRESS, label: 'GIF 压缩' },
          { value: CHAT_TOOL_IDS.GIF_TO_MP4, label: 'GIF 转 MP4' },
        ],
      },
      {
        id: 'quality',
        component: 'Slider',
        label: '质量 / 压缩强度',
        path: '/params/quality',
        min: 1,
        max: 100,
        step: 1,
      },
    );
    return {
      fields,
      params: {
        toolId,
        quality: typeof defaults.quality === 'number' ? defaults.quality : 75,
      },
    };
  }

  switch (toolId) {
    case CHAT_TOOL_IDS.GIF_TO_WEBP:
      fields.push(
        {
          id: 'quality',
          component: 'Slider',
          label: '质量 Quality',
          path: '/params/quality',
          min: 1,
          max: 100,
          step: 1,
        },
        {
          id: 'effort',
          component: 'Slider',
          label: 'Effort（1–6）',
          path: '/params/effort',
          min: 1,
          max: 6,
          step: 1,
        },
        {
          id: 'speed',
          component: 'Slider',
          label: 'Speed（1–10）',
          path: '/params/speed',
          min: 1,
          max: 10,
          step: 1,
        },
        {
          id: 'nearLossless',
          component: 'Select',
          label: '接近无损',
          path: '/params/nearLossless',
          options: [
            { value: 'false', label: '关闭' },
            { value: 'true', label: '开启' },
          ],
        },
      );
      break;
    case CHAT_TOOL_IDS.GIF_COMPRESS:
      fields.push(
        {
          id: 'quality',
          component: 'Slider',
          label: '质量',
          path: '/params/quality',
          min: 1,
          max: 100,
          step: 1,
        },
        {
          id: 'colors',
          component: 'Slider',
          label: '颜色数',
          path: '/params/colors',
          min: 2,
          max: 256,
          step: 1,
        },
      );
      break;
    case CHAT_TOOL_IDS.GIF_TO_MP4:
      fields.push(
        {
          id: 'crf',
          component: 'Slider',
          label: 'CRF（18–32）',
          path: '/params/crf',
          min: 18,
          max: 32,
          step: 1,
        },
        {
          id: 'fps',
          component: 'Slider',
          label: '帧率 FPS',
          path: '/params/fps',
          min: 10,
          max: 60,
          step: 1,
        },
      );
      break;
    case CHAT_TOOL_IDS.MP4_COMPRESS:
      fields.push(
        {
          id: 'crf',
          component: 'Slider',
          label: 'CRF（18–32）',
          path: '/params/crf',
          min: 18,
          max: 32,
          step: 1,
        },
        {
          id: 'maxHeight',
          component: 'Select',
          label: '最大高度',
          path: '/params/maxHeight',
          options: [
            { value: '', label: '保持原尺寸' },
            { value: '720', label: '720p' },
            { value: '1080', label: '1080p' },
          ],
        },
      );
      break;
    case CHAT_TOOL_IDS.MP4_FIRST_FRAME:
      fields.push(
        {
          id: 'format',
          component: 'Select',
          label: '输出格式',
          path: '/params/format',
          options: [
            { value: 'webp', label: 'WebP' },
            { value: 'png', label: 'PNG' },
          ],
        },
        {
          id: 'quality',
          component: 'Slider',
          label: '质量',
          path: '/params/quality',
          min: 1,
          max: 100,
          step: 1,
        },
      );
      break;
    case CHAT_TOOL_IDS.IMAGE_COMPRESS:
      fields.push(
        {
          id: 'quality',
          component: 'Slider',
          label: '质量',
          path: '/params/quality',
          min: 1,
          max: 100,
          step: 1,
        },
        {
          id: 'outputFormat',
          component: 'Select',
          label: '输出格式',
          path: '/params/outputFormat',
          options: [
            { value: 'original', label: '保持原格式' },
            { value: 'webp', label: 'WebP' },
            { value: 'jpeg', label: 'JPEG' },
            { value: 'png', label: 'PNG' },
          ],
        },
      );
      break;
    default:
      break;
  }

  // normalize defaults for form display
  const params = { ...defaults };
  if (typeof params.nearLossless === 'boolean') {
    params.nearLossless = params.nearLossless ? 'true' : 'false';
  }
  if (params.maxHeight == null) params.maxHeight = '';
  else params.maxHeight = String(params.maxHeight);

  return { fields, params };
}

/**
 * @param {string} toolId
 * @param {string} userText
 * @param {{ surfaceId?: string, fileName?: string }} [meta]
 * @returns {import('./build-tool-result-surface.js').A2uiSurfaceState}
 */
export function buildParamFormSurface(toolId, userText, meta = {}) {
  const tool = CHAT_TOOLS[toolId];
  const label = tool?.label || toolId;
  const allowToolPick = toolId.startsWith('gif.') && isAmbiguousGifTool(userText);
  const { fields, params } = fieldsForTool(toolId, userText, { allowToolPick });

  if (allowToolPick) {
    params.toolId = toolId;
  }

  const surfaceId = meta.surfaceId || `params-${Date.now()}`;
  const fieldIds = fields.map((f) => f.id);
  const childIds = ['title', 'hint', 'form', 'actions'];
  const formChildIds = fieldIds;

  return {
    surfaceId,
    catalogId: MEDIAFLOW_CHAT_CATALOG_ID,
    rootId: 'root',
    components: [
      { id: 'root', component: 'Card', child: 'body' },
      { id: 'body', component: 'Column', children: childIds },
      { id: 'title', component: 'Text', text: `${label} · 参数确认`, variant: 'h4' },
      {
        id: 'hint',
        component: 'Text',
        text: meta.fileName
          ? `附件：${meta.fileName}。调整参数后点击开始转换。`
          : '调整参数后点击开始转换。',
        variant: 'muted',
      },
      { id: 'form', component: 'ParamForm', children: formChildIds },
      ...fields,
      {
        id: 'actions',
        component: 'Column',
        children: ['startBtn', 'cancelBtn'],
      },
      {
        id: 'startBtn',
        component: 'Button',
        text: '开始转换',
        variant: 'primary',
        action: 'start_tool',
      },
      {
        id: 'cancelBtn',
        component: 'Button',
        text: '取消',
        variant: 'default',
        action: 'cancel_tool',
      },
    ],
    dataModel: {
      params,
      session: {
        toolId,
        awaitingAction: true,
        userText,
      },
    },
  };
}

/**
 * 合并表单参数为工具 config
 * @param {string} toolId
 * @param {string} userText
 * @param {Record<string, unknown>} formParams
 */
export function mergeParamFormConfig(toolId, userText, formParams) {
  const resolvedToolId =
    typeof formParams?.toolId === 'string' && CHAT_TOOLS[formParams.toolId]
      ? formParams.toolId
      : toolId;
  const base = parseConfigForTool(resolvedToolId, userText);
  const merged = { ...base, ...formParams };

  if (merged.nearLossless === 'true') merged.nearLossless = true;
  if (merged.nearLossless === 'false') merged.nearLossless = false;
  if (merged.maxHeight === '' || merged.maxHeight == null) {
    merged.maxHeight = null;
  } else if (typeof merged.maxHeight === 'string') {
    merged.maxHeight = Number(merged.maxHeight) || null;
  }

  return { toolId: resolvedToolId, config: merged };
}
