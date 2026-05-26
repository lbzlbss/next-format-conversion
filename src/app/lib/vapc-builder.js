/**
 * 腾讯 VAP / video-animation-player 兼容的 vapc 配置（info + rgbFrame/aFrame 数组）
 * @see https://github.com/Tencent/vap/tree/master/tool
 */

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
  /** 左右拼接：Alpha 紧贴 RGB 右侧（x=w），与腾讯 VapTool 一致 */
  const alphaW = Math.max(1, Math.floor(opts.alphaW ?? w));
  const aFrame = pack === 'bottom' ? [0, h, w, h] : [w, 0, alphaW, h];

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
      alpha: 1,
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
  const alphaPlaneW = pack === 'right-small' ? Math.max(1, Math.floor(alphaW ?? Math.ceil(padW / 2))) : padW;
  const videoW = pack === 'bottom' ? padW : pack === 'right-small' ? padW + alphaPlaneW : padW * 2;
  const videoH = pack === 'bottom' ? padH * 2 : padH;
  return buildVapcPayload({
    w: encW,
    h: encH,
    videoW,
    videoH,
    fps,
    frameCount,
    pack,
    alphaW: pack === 'right-small' ? alphaPlaneW : undefined,
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
