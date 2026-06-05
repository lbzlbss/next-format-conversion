import { CHAT_TOOLS } from '../chat-tools/registry.js';
import { MEDIAFLOW_CHAT_CATALOG_ID } from './constants.js';

/**
 * @typedef {{
 *   id: string,
 *   component: string,
 *   [key: string]: unknown,
 * }} A2uiComponentNode
 * @typedef {{
 *   surfaceId: string,
 *   catalogId: string,
 *   rootId: string,
 *   components: A2uiComponentNode[],
 *   dataModel: Record<string, unknown>,
 * }} A2uiSurfaceState
 */

function formatBytes(n) {
  if (!n || typeof n !== 'number') return '—';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

/**
 * @param {import('../../hooks/useChatStream.js').ToolCall} toolCall
 * @returns {A2uiSurfaceState | null}
 */
export function buildToolResultSurface(toolCall) {
  if (!toolCall) return null;

  const tool = CHAT_TOOLS[toolCall.toolId];
  const label = tool?.label || toolCall.toolId || '工具';
  const surfaceId = `tool-${toolCall.id}`;

  if (toolCall.status === 'running') {
    return {
      surfaceId,
      catalogId: MEDIAFLOW_CHAT_CATALOG_ID,
      rootId: 'root',
      components: [
        { id: 'root', component: 'Card', child: 'body' },
        { id: 'body', component: 'Column', children: ['loading'] },
        {
          id: 'loading',
          component: 'Progress',
          text: `正在执行 ${label}…`,
        },
      ],
      dataModel: { tool: { toolId: toolCall.toolId, status: 'running', label } },
    };
  }

  if (toolCall.status === 'error') {
    return {
      surfaceId,
      catalogId: MEDIAFLOW_CHAT_CATALOG_ID,
      rootId: 'root',
      components: [
        { id: 'root', component: 'Card', variant: 'error', child: 'body' },
        { id: 'body', component: 'Column', children: ['title', 'err'] },
        { id: 'title', component: 'Text', text: `${label} 失败`, variant: 'h4' },
        { id: 'err', component: 'Text', text: toolCall.error || '未知错误', variant: 'muted' },
      ],
      dataModel: { tool: { toolId: toolCall.toolId, status: 'error', label } },
    };
  }

  const out = toolCall.output;
  if (!out) return null;

  const saved =
    out.beforeBytes > 0 ? Math.round((1 - out.afterBytes / out.beforeBytes) * 100) : 0;

  const dataModel = {
    tool: {
      toolId: toolCall.toolId,
      status: 'success',
      label,
      fileName: out.fileName,
      beforeBytes: out.beforeBytes,
      afterBytes: out.afterBytes,
      beforeLabel: formatBytes(out.beforeBytes),
      afterLabel: formatBytes(out.afterBytes),
      savedPercent: saved,
      downloadUrl: out.downloadUrl,
      previewUrl: out.previewUrl,
      imageUrl: out.imageUrl,
    },
  };

  if (out.imageUrl) {
    return {
      surfaceId,
      catalogId: MEDIAFLOW_CHAT_CATALOG_ID,
      rootId: 'root',
      components: [
        { id: 'root', component: 'Card', child: 'body' },
        { id: 'body', component: 'Column', children: ['title', 'img', 'open'] },
        { id: 'title', component: 'Text', text: `${label} 已完成`, variant: 'h4' },
        {
          id: 'img',
          component: 'Image',
          src: { path: '/tool/imageUrl' },
          alt: '生成结果',
        },
        {
          id: 'open',
          component: 'Button',
          text: '打开图片',
          href: { path: '/tool/imageUrl' },
          variant: 'primary',
        },
      ],
      dataModel,
    };
  }

  const children = ['title'];
  if (saved > 0) children.push('tag');
  if (out.previewUrl) children.push('preview');
  children.push('size', 'download');

  return {
    surfaceId,
    catalogId: MEDIAFLOW_CHAT_CATALOG_ID,
    rootId: 'root',
    components: [
      { id: 'root', component: 'Card', child: 'body' },
      { id: 'body', component: 'Column', children },
      { id: 'title', component: 'Text', text: `${label} 已完成`, variant: 'h4' },
      ...(saved > 0
        ? [
            {
              id: 'tag',
              component: 'Tag',
              text: `约减小 ${saved}%`,
              color: 'green',
            },
          ]
        : []),
      ...(out.previewUrl
        ? [
            {
              id: 'preview',
              component: 'Image',
              src: { path: '/tool/previewUrl' },
              alt: out.fileName || 'preview',
            },
          ]
        : []),
      {
        id: 'size',
        component: 'Text',
        text: `${formatBytes(out.beforeBytes)} → ${formatBytes(out.afterBytes)}`,
        variant: 'muted',
      },
      {
        id: 'download',
        component: 'DownloadLink',
        url: { path: '/tool/downloadUrl' },
        fileName: { path: '/tool/fileName' },
      },
    ],
    dataModel,
  };
}

/**
 * @param {import('../../hooks/useChatStream.js').ToolCall[]} toolCalls
 * @returns {A2uiSurfaceState[]}
 */
export function buildToolResultSurfaces(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls
    .map((tc) => buildToolResultSurface(tc))
    .filter((s) => s != null);
}
