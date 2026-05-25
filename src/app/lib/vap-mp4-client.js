/**
 * 浏览器端解析 MP4 中的 vapc box（用于本地预览）
 * @param {ArrayBuffer} buffer
 */
export function parseVapcFromArrayBuffer(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;

  const readType = (offset) => String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  );

  const findBox = (start, end, boxType) => {
    let offset = start;
    while (offset + 8 <= end) {
      let size = view.getUint32(offset);
      const type = readType(offset + 4);
      if (size === 0) size = end - offset;
      if (size < 8) {
        offset += 8;
        continue;
      }
      if (type === boxType) {
        const dataStart = offset + 8;
        const json = new TextDecoder().decode(bytes.slice(dataStart, offset + size));
        try {
          return JSON.parse(json);
        } catch {
          return null;
        }
      }
      const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'meta', 'ilst']);
      if (containers.has(type)) {
        const inner = findBox(offset + 8, offset + size, boxType);
        if (inner) return inner;
      }
      offset += size;
    }
    return null;
  };

  return findBox(0, len, 'vapc');
}
