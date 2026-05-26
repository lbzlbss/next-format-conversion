/**
 * 腾讯 VAP 拼接布局（ffmpeg filter + vapc 尺寸）
 */

/** @param {number} v */
export function toEven(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return v;
  return n % 2 === 0 ? n : n + 1;
}

/**
 * 左大右小（行业通用）：左 RGB；右侧约 1/2 宽，上半主 Alpha（右上）、下半融合遮罩区（右下黑底）
 * @param {{ pack: string, padW: number, padH: number, encH: number }} p
 */
export function resolveRightSmallLayout({ pack, padW, padH, encH }) {
  if (pack !== 'right-small') return null;

  const alphaPlaneW = toEven(Math.ceil(padW / 2));
  const alphaTopH = toEven(Math.floor(padH / 2));
  const alphaBottomH = Math.max(2, padH - alphaTopH);
  const aFrameH = toEven(Math.floor(encH / 2));

  return {
    alphaPlaneW,
    alphaTopH,
    alphaBottomH,
    aFrameH,
    videoW: padW + alphaPlaneW,
    videoH: padH,
    aFrameX: padW,
  };
}

/**
 * @param {{ pack: string, padW: number, padH: number, encH: number }} p
 */
export function buildVapPackFilterComplex(p) {
  const { pack, padW, padH } = p;

  if (pack === 'bottom') {
    return (
      '[0:v]format=rgba,split=2[c0][c1];' +
      '[c1]alphaextract,format=gray,format=rgb24[a];' +
      '[c0]format=rgb24[c];' +
      '[c][a]vstack=inputs=2[v]'
    );
  }

  const rs = resolveRightSmallLayout(p);
  if (pack === 'right-small' && rs) {
    const { alphaPlaneW, alphaTopH, alphaBottomH } = rs;
    return (
      '[0:v]format=rgba,split=2[c0][c1];' +
      '[c0]format=rgb24[rgb];' +
      `[c1]alphaextract,format=gray,scale=${alphaPlaneW}:${alphaTopH}:flags=bilinear,format=rgb24[atk];` +
      `color=c=black:s=${alphaPlaneW}x${alphaBottomH}[abb];` +
      '[atk][abb]vstack=inputs=2[ar];' +
      '[rgb][ar]hstack=inputs=2[v]'
    );
  }

  return (
    '[0:v]format=rgba,split=2[c0][c1];' +
    '[c1]alphaextract,format=gray,format=rgb24[a];' +
    '[c0]format=rgb24[c];' +
    '[c][a]hstack=inputs=2[v]'
  );
}
