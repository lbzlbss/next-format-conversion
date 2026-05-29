import { CHAT_TOOLS } from './registry.js';
import { parseConfigForTool } from './parse-config.js';

function parseFilenameFromDisposition(header) {
  if (!header) return null;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* ignore */
    }
  }
  const plain = header.match(/filename="([^"]+)"/i);
  return plain ? plain[1] : null;
}

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

/**
 * @param {string} toolId
 * @param {File} file
 * @param {Record<string, unknown>} [config]
 */
export async function runChatFileTool(toolId, file, config) {
  const tool = CHAT_TOOLS[toolId];
  if (!tool?.endpoint) {
    throw new Error('未知工具');
  }

  if (file.size > tool.maxBytes) {
    throw new Error(
      `文件过大，请上传小于 ${Math.floor(tool.maxBytes / 1024 / 1024)}MB 的文件`,
    );
  }

  const finalConfig = config ?? parseConfigForTool(toolId, '');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('config', JSON.stringify(finalConfig));

  const res = await fetch(tool.endpoint, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${tool.label}失败 (${res.status})`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition');
  const fileName =
    parseFilenameFromDisposition(disposition) ||
    tool.outputName?.(file.name, finalConfig) ||
    `output-${Date.now()}`;

  let compressionRatio = null;
  const infoHeader = res.headers.get('x-compression-info');
  if (infoHeader) {
    try {
      const info = JSON.parse(infoHeader);
      if (info.compressionRatio != null) compressionRatio = info.compressionRatio;
    } catch {
      /* ignore */
    }
  }

  return {
    toolId,
    blob,
    downloadUrl: URL.createObjectURL(blob),
    previewUrl: blob.type.startsWith('image/') ? URL.createObjectURL(blob) : null,
    fileName,
    beforeBytes: file.size,
    afterBytes: blob.size,
    config: finalConfig,
    compressionRatio,
  };
}

/**
 * @param {string} prompt
 */
export async function runGenerateImageTool(prompt) {
  const tool = CHAT_TOOLS['ai.generateImage'];
  const res = await fetch(tool.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: String(prompt).trim(), mode: 'text2image' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `文生图失败 (${res.status})`);
  }
  const data = await res.json();
  if (!data?.imageUrl) {
    throw new Error('未获取到生成图片地址');
  }
  return {
    toolId: 'ai.generateImage',
    imageUrl: data.imageUrl,
    fileName: 'generated.png',
    beforeBytes: 0,
    afterBytes: 0,
    config: { prompt: String(prompt).trim() },
  };
}

/**
 * @param {Awaited<ReturnType<typeof runChatFileTool>> | Awaited<ReturnType<typeof runGenerateImageTool>>} result
 */
export function formatToolSummary(result) {
  const tool = CHAT_TOOLS[result.toolId];
  const label = tool?.label || result.toolId;

  if (result.toolId === 'ai.generateImage') {
    return (
      `【工具执行结果】已调用「${label}」，提示词：${result.config?.prompt || ''}。` +
      `请简要说明画面要点，并提醒用户点击下方预览或打开图片链接。`
    );
  }

  const saved =
    result.beforeBytes > 0
      ? Math.round((1 - result.afterBytes / result.beforeBytes) * 100)
      : result.compressionRatio ?? 0;

  return (
    `【工具执行结果】已调用「${label}」，输出文件 ${result.fileName}。` +
    `体积 ${formatBytes(result.beforeBytes)} → ${formatBytes(result.afterBytes)}` +
    (saved > 0 ? `（约减小 ${saved}%）` : '') +
    `。请简要说明处理效果与关键参数，并提醒用户点击下载按钮。`
  );
}
