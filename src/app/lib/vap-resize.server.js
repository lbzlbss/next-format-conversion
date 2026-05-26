/**
 * VAP 改尺寸：按 rgbFrame/aFrame 拼版 crop → scale → 重组，避免整帧拉伸破坏布局
 */

import { toEven, resolveRightSmallLayout } from './vap-pack.js';
import { buildVapcFromSequence } from './vapc-builder.js';

/** @param {number} v @param {number} m */
export function ceilTo(v, m) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return v;
  return Math.ceil(n / m) * m;
}

/** @param {unknown} rect */
export function layoutToRect(rect) {
  if (!rect) return null;
  if (Array.isArray(rect) && rect.length >= 4) {
    return { x: rect[0], y: rect[1], w: rect[2], h: rect[3] };
  }
  if (typeof rect === 'object' && rect !== null && 'w' in rect) {
    const r = /** @type {{ x?: number, y?: number, w?: number, h?: number }} */ (rect);
    return { x: r.x ?? 0, y: r.y ?? 0, w: r.w ?? 0, h: r.h ?? 0 };
  }
  return null;
}

/**
 * @param {Record<string, unknown>} info
 * @returns {'right' | 'right-small' | 'bottom'}
 */
export function detectVapPack(info) {
  const w = Number(info.w) || 0;
  const h = Number(info.h) || 0;
  const videoW = Number(info.videoW) || 0;
  const videoH = Number(info.videoH) || 0;
  const rgb = layoutToRect(info.rgbFrame ?? info.rgbLayout);
  const a = layoutToRect(info.aFrame ?? info.aLayout);

  if (a && a.y >= Math.max(1, h) - 1 && a.x <= 1) return 'bottom';
  if (a && a.h > 0 && h > 0 && a.h < h * 0.99 && a.x >= (rgb?.w ?? w) * 0.5) return 'right-small';
  if (videoH >= h * 1.85 && videoW <= w * 1.2) return 'bottom';
  if (videoW > w * 1.35 && a && a.w < w * 0.99) return 'right-small';
  return 'right';
}

/**
 * @param {Record<string, unknown>} info
 */
export function getVapLayoutContext(info) {
  const w = Math.max(1, Math.floor(Number(info.w) || 1));
  const h = Math.max(1, Math.floor(Number(info.h) || 1));
  const videoW = Math.max(1, Math.floor(Number(info.videoW) || w * 2));
  const videoH = Math.max(1, Math.floor(Number(info.videoH) || h));
  const pack = detectVapPack(info);

  let rgb = layoutToRect(info.rgbFrame ?? info.rgbLayout) ?? { x: 0, y: 0, w, h };
  let alpha = layoutToRect(info.aFrame ?? info.aLayout);

  if (!alpha) {
    alpha =
      pack === 'bottom'
        ? { x: 0, y: h, w, h }
        : pack === 'right-small'
          ? { x: rgb.w, y: 0, w: Math.ceil(w / 2), h: Math.floor(h / 2) }
          : { x: w, y: 0, w, h };
  }

  /** 视频纹理中 RGB 面板（含 padding） */
  let rgbPanel;
  if (pack === 'bottom') {
    rgbPanel = {
      x: 0,
      y: 0,
      w: videoW,
      h: Math.max(1, alpha.y > 0 ? alpha.y : Math.floor(videoH / 2)),
    };
  } else {
    let rgbPanelW = Math.max(rgb.w, alpha.x);
    if (alpha.x > 0) rgbPanelW = alpha.x;
    rgbPanel = {
      x: 0,
      y: 0,
      w: Math.min(videoW, Math.max(1, rgbPanelW)),
      h: videoH,
    };
  }

  return { pack, w, h, videoW, videoH, rgb, alpha, rgbPanel };
}

/**
 * @param {Record<string, unknown>} config
 * @param {number} scaleX
 * @param {number} scaleY
 * @param {{ targetW?: number, targetH?: number }} [opts]
 */
export function scaleVapcConfig(config, scaleX, scaleY, opts = {}) {
  const info = config.info && typeof config.info === 'object' ? config.info : config;
  const ctx = getVapLayoutContext(info);
  const { pack, w, h } = ctx;

  let newW = toEven(Math.round(w * scaleX));
  let newH = toEven(Math.round(h * scaleY));

  if (opts.targetW && opts.targetW > 0) newW = toEven(Math.floor(opts.targetW));
  if (opts.targetH && opts.targetH > 0) newH = toEven(Math.floor(opts.targetH));

  newW = Math.max(2, newW);
  newH = Math.max(2, newH);

  const padW = ceilTo(newW, 16);
  const padH = ceilTo(newH, 16);
  const fps = Math.max(1, Math.floor(Number(info.fps) || Number(info.f) || 20));
  const frameCount = Math.max(1, Math.floor(Number(info.f) || fps));

  return buildVapcFromSequence({
    encW: newW,
    encH: newH,
    padW,
    padH,
    fps,
    frameCount,
    pack,
    alphaW: pack === 'right-small' ? toEven(Math.ceil(padW / 2)) : undefined,
  });
}

/**
 * @param {{
 *   pack: string,
 *   srcRgbPanel: { x: number, y: number, w: number, h: number },
 *   srcAlpha: { x: number, y: number, w: number, h: number },
 *   padW: number,
 *   padH: number,
 *   encH: number,
 * }} p
 * @returns {string}
 */
export function buildVapResizeFilterComplex(p) {
  const { pack, srcRgbPanel: rp, srcAlpha: a, padW, padH, encH } = p;
  const rx = rp.x;
  const ry = rp.y;
  const rw = rp.w;
  const rh = rp.h;
  const ax = a.x;
  const ay = a.y;
  const aw = a.w;
  const ah = a.h;

  if (pack === 'bottom') {
    const topH = Math.max(1, ay > 0 ? ay : Math.floor(rh / 2));
    return (
      `[0:v]split=2[vinrgb][vina];` +
      `[vinrgb]crop=${rw}:${topH}:${rx}:${ry},scale=${padW}:${padH}:flags=lanczos,format=rgb24[rgb];` +
      `[vina]crop=${aw}:${ah}:${ax}:${ay},scale=${padW}:${padH}:flags=lanczos,format=rgb24[alpha];` +
      `[rgb][alpha]vstack=inputs=2[v]`
    );
  }

  const rs = resolveRightSmallLayout({ pack, padW, padH, encH });
  if (pack === 'right-small' && rs) {
    const { alphaPlaneW, alphaTopH, alphaBottomH } = rs;
    return (
      `[0:v]split=2[vinrgb][vina];` +
      `[vinrgb]crop=${rw}:${rh}:${rx}:${ry},scale=${padW}:${padH}:flags=lanczos,format=rgb24[rgb];` +
      `[vina]crop=${aw}:${ah}:${ax}:${ay},scale=${alphaPlaneW}:${alphaTopH}:flags=lanczos,format=rgb24[atk];` +
      `color=c=black:s=${alphaPlaneW}x${alphaBottomH}[abb];` +
      `[atk][abb]vstack=inputs=2[ar];` +
      `[rgb][ar]hstack=inputs=2[v]`
    );
  }

  return (
    `[0:v]split=2[vinrgb][vina];` +
    `[vinrgb]crop=${rw}:${rh}:${rx}:${ry},scale=${padW}:${padH}:flags=lanczos,format=rgb24[rgb];` +
    `[vina]crop=${aw}:${ah}:${ax}:${ay},scale=${padW}:${padH}:flags=lanczos,format=rgb24[alpha];` +
    `[rgb][alpha]hstack=inputs=2[v]`
  );
}

/**
 * @param {Record<string, unknown>} config
 * @param {number} scaleX
 * @param {number} scaleY
 * @param {{ targetW?: number, targetH?: number }} [opts]
 */
export function buildVapResizePlan(config, scaleX, scaleY, opts = {}) {
  const info = config.info && typeof config.info === 'object' ? config.info : config;
  const src = getVapLayoutContext(info);
  const newConfig = scaleVapcConfig(config, scaleX, scaleY, opts);
  const ni = newConfig.info;
  const padW = ceilTo(ni.w, 16);
  const padH = ceilTo(ni.h, 16);

  const filterComplex = buildVapResizeFilterComplex({
    pack: src.pack,
    srcRgbPanel: src.rgbPanel,
    srcAlpha: src.alpha,
    padW,
    padH,
    encH: ni.h,
  });

  return {
    newConfig,
    filterComplex,
    pack: src.pack,
    outputVideoW: ni.videoW,
    outputVideoH: ni.videoH,
  };
}
