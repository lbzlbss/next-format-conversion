/**
 * 腾讯 VAP / video-animation-player 兼容的 vapc 配置（info + rgbFrame/aFrame 数组）
 * @see https://github.com/Tencent/vap/tree/master/tool
 */

import { toEven } from './vap-pack.js';

/**
 * @param {{
 *   w: number,
 *   h: number,
 *   videoW: number,
 *   videoH: number,
 *   fps: number,
 *   frameCount?: number,
 *   pack?: 'right' | 'bottom' | 'right-small',
 *   alphaW?: number,
 *   aFrameX?: number,
 *   aFrameH?: number,
 * }} opts
 */
export function buildVapcPayload(opts) {
  const w = Math.max(1, Math.floor(opts.w));
  const h = Math.max(1, Math.floor(opts.h));
  const videoW = Math.max(1, Math.floor(opts.videoW));
  const videoH = Math.max(1, Math.floor(opts.videoH));
  const fps = Math.max(1, Math.min(60, Math.floor(opts.fps)));
  const pack = opts.pack === 'bottom' ? 'bottom' : opts.pack === 'right-small' ? 'right-small' : 'right';
  const frameCount = Math.max(1, Math.floor(opts.frameCount ?? fps));

  const rgbFrame = [0, 0, w, h];
  const alphaW = Math.max(1, Math.floor(opts.alphaW ?? w));
  const aFrameX = Math.max(0, Math.floor(opts.aFrameX ?? w));
  const aFrameH = Math.max(1, Math.floor(opts.aFrameH ?? h));
  /**
   * 左大右小：主透明通道在右上角 aFrame=[padW,0,alphaW,h/2]；右下角为融合/遮罩预留（视频黑底，不在 aFrame 内）
   */
  const aFrame =
    pack === 'bottom'
      ? [0, h, w, h]
      : pack === 'right-small'
        ? [aFrameX, 0, alphaW, aFrameH]
        : [w, 0, alphaW, h];
  const alphaScale = pack === 'right-small' ? Number((alphaW / w).toFixed(4)) : 1;

  return {
    info: {
      v: 2,
      f: frameCount,
      w,
      h,
      videoW,
      videoH,
      orien: 0,
      fps,
      isVapx: 0,
      alpha: alphaScale,
      isAlignBothEnds: 0,
      rgbFrame,
      aFrame,
      sources: [],
    },
  };
}

/**
 * 序列帧 → VAP 编码尺寸（含 16 对齐 padding）
 * @param {{ encW: number, encH: number, padW: number, padH: number, fps: number, frameCount: number, pack?: 'right'|'bottom'|'right-small', alphaW?: number }} p
 */
export function buildVapcFromSequence(p) {
  const { encW, encH, padW, padH, fps, frameCount, pack = 'right', alphaW } = p;

  if (pack === 'right-small') {
    const alphaPlaneW = Math.max(1, Math.floor(alphaW ?? Math.ceil(padW / 2)));
    const aFrameH = toEven(Math.floor(encH / 2));
    return buildVapcPayload({
      w: encW,
      h: encH,
      videoW: padW + alphaPlaneW,
      videoH: padH,
      fps,
      frameCount,
      pack,
      alphaW: alphaPlaneW,
      aFrameX: padW,
      aFrameH,
    });
  }

  const videoW = pack === 'bottom' ? padW : padW * 2;
  const videoH = pack === 'bottom' ? padH * 2 : padH;
  return buildVapcPayload({
    w: encW,
    h: encH,
    videoW,
    videoH,
    fps,
    frameCount,
    pack,
    alphaW: padW,
    aFrameX: encW,
    aFrameH: encH,
  });
}

/**
 * SVGA 侧-by-side 布局（无 macroblock padding）
 */
export function buildVapcFromSvgaLayout({ displayW, displayH, fps, frameCount }) {
  return buildVapcPayload({
    w: displayW,
    h: displayH,
    videoW: displayW * 2,
    videoH: displayH,
    fps,
    frameCount,
    pack: 'right',
  });
}
