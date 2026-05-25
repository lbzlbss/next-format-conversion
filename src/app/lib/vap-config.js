/**
 * 将 API 解析的 vapc（扁平或 info 嵌套）转为 video-animation-player 所需结构
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {{ info: Record<string, unknown>, src: unknown[], frame: unknown[] } | null}
 */
export function normalizeVapConfigForPlayer(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const root = /** @type {Record<string, unknown>} */ (raw);
  const info = /** @type {Record<string, unknown>} */ (
    root.info && typeof root.info === 'object' ? root.info : root
  );

  const layoutRect = (rect) => {
    if (!rect) return null;
    if (Array.isArray(rect) && rect.length >= 4) {
      return [rect[0], rect[1], rect[2], rect[3]];
    }
    if (typeof rect === 'object' && rect !== null && 'w' in rect) {
      const r = /** @type {{ x?: number, y?: number, w?: number, h?: number }} */ (rect);
      return [r.x ?? 0, r.y ?? 0, r.w ?? 0, r.h ?? 0];
    }
    return null;
  };

  const w = Number(info.w) || 375;
  const h = Number(info.h) || 375;
  const fps = Number(info.fps ?? info.f) || 30;

  let rgbFrame = layoutRect(info.rgbFrame ?? info.rgbLayout);
  let aFrame = layoutRect(info.aFrame ?? info.aLayout);

  const videoW = Number(info.videoW) || (aFrame ? aFrame[0] + aFrame[2] : w * 2);
  const videoH = Number(info.videoH) || h;

  if (!rgbFrame) rgbFrame = [0, 0, w, h];
  if (!aFrame) {
    aFrame = rgbFrame[0] + rgbFrame[2] >= w ? [w, 0, w, h] : [0, h, w, h];
  }

  const sources = Array.isArray(info.sources) ? info.sources : [];
  const frameList = Array.isArray(root.frame) ? root.frame : [];
  const srcList = Array.isArray(root.src) ? root.src : [];

  return {
    info: {
      v: Number(info.v) || 2,
      f: Number(info.f) || Math.max(1, Math.round(fps * 5)),
      w,
      h,
      videoW,
      videoH,
      orien: Number(info.orien) || 0,
      fps,
      isVapx: sources.length > 0 || frameList.length > 0 ? 1 : 0,
      alpha: info.alpha ?? 1,
      rgbFrame,
      aFrame,
      sources,
    },
    src: srcList,
    frame: frameList,
  };
}
