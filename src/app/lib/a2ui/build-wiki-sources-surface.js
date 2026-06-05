import { MEDIAFLOW_CHAT_CATALOG_ID } from './constants.js';

/**
 * @param {Array<{ slug: string, title: string, anchor?: string }>} sources
 * @returns {import('./build-tool-result-surface.js').A2uiSurfaceState | null}
 */
export function buildWikiSourcesSurface(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return null;

  const refIds = sources.map((_, i) => `ref-${i}`);

  return {
    surfaceId: `wiki-${Date.now()}`,
    catalogId: MEDIAFLOW_CHAT_CATALOG_ID,
    rootId: 'root',
    components: [
      { id: 'root', component: 'Card', child: 'body' },
      { id: 'body', component: 'Column', children: ['title', 'refs'] },
      { id: 'title', component: 'Text', text: '参考 Wiki', variant: 'h4' },
      { id: 'refs', component: 'Column', children: refIds },
      ...sources.map((s, i) => ({
        id: `ref-${i}`,
        component: 'WikiRef',
        slug: s.slug,
        title: s.title,
        ...(s.anchor ? { anchor: s.anchor } : {}),
      })),
    ],
    dataModel: {
      wiki: { items: sources },
    },
  };
}

/**
 * @param {import('./build-tool-result-surface.js').A2uiSurfaceState[]} [surfaces]
 */
export function hasWikiA2uiSurface(surfaces) {
  if (!Array.isArray(surfaces)) return false;
  return surfaces.some(
    (s) =>
      String(s.surfaceId || '').startsWith('wiki-') ||
      (s.dataModel?.wiki && Array.isArray(s.dataModel.wiki.items)),
  );
}
