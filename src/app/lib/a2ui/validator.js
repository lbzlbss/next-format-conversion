import catalog from './catalogs/mediaflow-chat-v1.json';
import { MEDIAFLOW_CHAT_CATALOG_ID } from './constants.js';

const ALLOWED_COMPONENTS = new Set([
  ...catalog.components,
  'Steps',
  'Row',
]);

const MAX_SURFACES = 2;
const MAX_COMPONENTS = 24;
const MAX_TEXT_LEN = 800;
const SAFE_URL = /^https:\/\/[^\s]+$/i;

/**
 * @param {unknown} url
 */
function isSafeUrl(url) {
  return typeof url === 'string' && SAFE_URL.test(url);
}

/**
 * @param {unknown} node
 * @param {Set<string>} ids
 * @param {string[]} errors
 */
function validateComponent(node, ids, errors) {
  if (!node || typeof node !== 'object') {
    errors.push('组件节点无效');
    return;
  }

  const n = /** @type {Record<string, unknown>} */ (node);
  const id = n.id;
  const component = n.component;

  if (typeof id !== 'string' || !id) {
    errors.push('组件缺少 id');
    return;
  }
  if (ids.has(id)) errors.push(`重复组件 id: ${id}`);
  ids.add(id);

  if (typeof component !== 'string' || !ALLOWED_COMPONENTS.has(component)) {
    errors.push(`不允许的组件: ${String(component)}`);
    return;
  }

  if (component === 'Image' || component === 'DownloadLink') {
    errors.push(`LLM 不可生成 ${component}`);
  }

  if (typeof n.text === 'string' && n.text.length > MAX_TEXT_LEN) {
    errors.push(`Text 过长: ${id}`);
  }

  if (n.href != null && !isSafeUrl(n.href)) {
    errors.push(`Button href 不安全: ${id}`);
  }

  if (component === 'Steps' && Array.isArray(n.items)) {
    if (n.items.length > 8) errors.push('Steps 项过多');
    for (const item of n.items) {
      if (!item || typeof item !== 'object') continue;
      const t = /** @type {Record<string, unknown>} */ (item);
      if (typeof t.title === 'string' && t.title.length > 120) errors.push('Step title 过长');
      if (typeof t.description === 'string' && t.description.length > MAX_TEXT_LEN) {
        errors.push('Step description 过长');
      }
    }
  }
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, surfaces: import('./build-tool-result-surface.js').A2uiSurfaceState[] } | { ok: false, error: string }}
 */
export function validateLlmSurfaces(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'JSON 解析失败' };
    }
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, error: '根对象无效' };
  }

  const surfaces = /** @type {{ surfaces?: unknown }} */ (data).surfaces;
  if (!Array.isArray(surfaces)) {
    return { ok: false, error: '缺少 surfaces 数组' };
  }

  if (surfaces.length === 0) {
    return { ok: true, surfaces: [] };
  }

  if (surfaces.length > MAX_SURFACES) {
    return { ok: false, error: 'surfaces 数量超限' };
  }

  /** @type {import('./build-tool-result-surface.js').A2uiSurfaceState[]} */
  const normalized = [];
  const errors = [];

  for (const s of surfaces) {
    if (!s || typeof s !== 'object') {
      errors.push('surface 无效');
      continue;
    }
    const surface = /** @type {Record<string, unknown>} */ (s);
    const surfaceId = surface.surfaceId;
    const components = surface.components;
    const rootId = surface.rootId;

    if (typeof surfaceId !== 'string' || !surfaceId) {
      errors.push('surfaceId 无效');
      continue;
    }
    if (!Array.isArray(components) || components.length === 0) {
      errors.push('components 为空');
      continue;
    }
    if (components.length > MAX_COMPONENTS) {
      errors.push('components 过多');
      continue;
    }

    const ids = new Set();
    for (const c of components) {
      validateComponent(c, ids, errors);
    }

    const root = typeof rootId === 'string' ? rootId : 'root';
    if (!ids.has(root)) {
      errors.push(`rootId ${root} 不存在`);
    }

    normalized.push({
      surfaceId,
      catalogId:
        typeof surface.catalogId === 'string'
          ? surface.catalogId
          : MEDIAFLOW_CHAT_CATALOG_ID,
      rootId: root,
      components: /** @type {import('./build-tool-result-surface.js').A2uiComponentNode[]} */ (
        components
      ),
      dataModel:
        surface.dataModel && typeof surface.dataModel === 'object'
          ? /** @type {Record<string, unknown>} */ (surface.dataModel)
          : {},
    });
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.slice(0, 5).join('; ') };
  }

  return { ok: true, surfaces: normalized };
}
