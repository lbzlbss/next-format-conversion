/** float 布局下隐藏的宽组件 */
const FLOAT_HIDDEN = new Set(['Table']);

/**
 * @param {import('./build-tool-result-surface.js').A2uiSurfaceState} surface
 * @param {'page' | 'float'} variant
 */
export function filterSurfaceForVariant(surface, variant) {
  if (!surface || variant !== 'float') return surface;

  const components = surface.components.filter(
    (c) => !FLOAT_HIDDEN.has(c.component),
  );

  if (components.length === surface.components.length) return surface;

  const childRefs = new Set(
    components.flatMap((c) => {
      const ids = [];
      if (typeof c.child === 'string') ids.push(c.child);
      if (Array.isArray(c.children)) ids.push(...c.children);
      return ids;
    }),
  );

  const pruned = components.filter((c) => {
    if (c.id === surface.rootId) return true;
    return childRefs.has(c.id);
  });

  return { ...surface, components: pruned };
}
