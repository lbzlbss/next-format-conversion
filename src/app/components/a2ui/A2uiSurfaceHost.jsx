'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { filterSurfaceForVariant } from '../../lib/a2ui/filter-surface-variant.js';

const A2uiRenderer = dynamic(() => import('./A2uiRenderer.jsx'), { ssr: false });

/**
 * @param {{
 *   surfaces?: import('../../lib/a2ui/build-tool-result-surface.js').A2uiSurfaceState[],
 *   variant?: 'page' | 'float',
 *   interactiveSurfaceId?: string | null,
 *   onSurfaceAction?: (surfaceId: string, action: string, dataModel: Record<string, unknown>) => void,
 * }} props
 */
export default function A2uiSurfaceHost({
  surfaces = [],
  variant = 'page',
  interactiveSurfaceId = null,
  onSurfaceAction,
}) {
  const filtered = useMemo(
    () => surfaces.map((s) => filterSurfaceForVariant(s, variant)),
    [surfaces, variant],
  );

  if (!filtered.length) return null;

  return (
    <>
      {filtered.map((surface) => {
        const interactive =
          Boolean(interactiveSurfaceId) && surface.surfaceId === interactiveSurfaceId;
        return (
          <A2uiRenderer
            key={surface.surfaceId}
            surface={surface}
            variant={variant}
            interactive={interactive}
            onAction={
              interactive && onSurfaceAction
                ? (action, dataModel) =>
                    onSurfaceAction(surface.surfaceId, action, dataModel)
                : undefined
            }
          />
        );
      })}
    </>
  );
}
