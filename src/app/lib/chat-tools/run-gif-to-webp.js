import { DEFAULT_GIF_WEBP_CONFIG } from './parse-gif-config.js';

/** GIF 对话附件上限（与站点图片类工具对齐） */
export const CHAT_GIF_MAX_BYTES = 20 * 1024 * 1024;

/**
 * @param {File} file
 * @param {import('./parse-gif-config.js').GifWebpConfig} [config]
 */
export async function runGifToWebp(file, config = DEFAULT_GIF_WEBP_CONFIG) {
  if (!file) {
    throw new Error('未选择 GIF 文件');
  }

  const isGif =
    file.type === 'image/gif' || /\.gif$/i.test(String(file.name || ''));
  if (!isGif) {
    throw new Error('仅支持 GIF 动图');
  }

  if (file.size > CHAT_GIF_MAX_BYTES) {
    throw new Error(
      `GIF 过大，请上传小于 ${Math.floor(CHAT_GIF_MAX_BYTES / 1024 / 1024)}MB 的文件`,
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('config', JSON.stringify(config));

  const res = await fetch('/api/convert-gif', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `转换失败 (${res.status})`);
  }

  const blob = await res.blob();
  const fileName = String(file.name || 'converted.gif').replace(/\.gif$/i, '.webp');

  return {
    blob,
    downloadUrl: URL.createObjectURL(blob),
    fileName,
    beforeBytes: file.size,
    afterBytes: blob.size,
    config,
  };
}

/**
 * @param {import('./run-gif-to-webp.js').GifToWebpResult} result
 */
export function formatGifToWebpToolSummary(result) {
  const saved =
    result.beforeBytes > 0
      ? Math.round((1 - result.afterBytes / result.beforeBytes) * 100)
      : 0;
  return (
    `【工具执行结果】已将「${result.fileName.replace(/\.webp$/i, '.gif')}」转为 WebP（${result.fileName}）。` +
    `体积 ${formatBytes(result.beforeBytes)} → ${formatBytes(result.afterBytes)}` +
    (saved > 0 ? `（约减小 ${saved}%）` : '') +
    `；参数 quality=${result.config.quality}, effort=${result.config.effort}, speed=${result.config.speed}` +
    `${result.config.nearLossless ? ', nearLossless=true' : ''}。` +
    `请简要说明效果，并提醒用户点击消息中的下载按钮。`
  );
}

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}
