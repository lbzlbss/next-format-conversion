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

/**
 * 不可变更新 dataModel 路径
 * @param {Record<string, unknown>} dataModel
 * @param {string} path
 * @param {unknown} value
 */
export function setDataPath(dataModel, path, value) {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return dataModel;

  const next = { ...dataModel };
  let cur = /** @type {Record<string, unknown>} */ (next);

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const child = cur[key];
    cur[key] =
      child != null && typeof child === 'object'
        ? { .../** @type {Record<string, unknown>} */ (child) }
        : {};
    cur = /** @type {Record<string, unknown>} */ (cur[key]);
  }

  cur[parts[parts.length - 1]] = value;
  return next;
}
