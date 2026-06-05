'use client';

import dynamic from 'next/dynamic';

const A2uiRenderer = dynamic(() => import('./A2uiRenderer.jsx'), { ssr: false });

/**
 * @param {{
 *   surfaces?: import('../../lib/a2ui/build-tool-result-surface.js').A2uiSurfaceState[],
 *   variant?: 'page' | 'float',
 * }} props
 */
export default function A2uiSurfaceHost({ surfaces = [], variant = 'page' }) {
  if (!surfaces.length) return null;

  return (
    <>
      {surfaces.map((surface) => (
        <A2uiRenderer key={surface.surfaceId} surface={surface} variant={variant} />
      ))}
    </>
  );
}
