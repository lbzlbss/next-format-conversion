/**
 * 从 dataModel 解析 path，支持 "/tool/downloadUrl" 或 "tool.downloadUrl"
 * @param {Record<string, unknown>} dataModel
 * @param {string | undefined} path
 */
export function resolveDataPath(dataModel, path) {
  if (!path || typeof path !== 'string') return undefined;
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const parts = normalized.split('/').filter(Boolean);
  let cur = /** @type {unknown} */ (dataModel);
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = /** @type {Record<string, unknown>} */ (cur)[p];
  }
  return cur;
}
