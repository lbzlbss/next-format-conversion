/**
 * MP4 vapc box 读写（Node / Buffer）
 */

const CONTAINER_BOXES = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'meta', 'ilst']);

export function findBoxRecursive(buf, boxType) {
  let offset = 0;
  while (offset + 8 <= buf.length) {
    let size = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString('ascii');

    if (size === 0) size = buf.length - offset;
    if (size === 1 || size < 8) {
      offset += Math.max(size, 8);
      continue;
    }

    if (type === boxType) {
      return { start: offset, size, data: buf.slice(offset + 8, offset + size) };
    }

    if (CONTAINER_BOXES.has(type)) {
      const inner = findBoxRecursive(buf.slice(offset + 8, offset + size), boxType);
      if (inner) return { ...inner, start: inner.start + offset + 8 };
    }

    offset += size;
  }
  return null;
}

export function parseVapc(buf) {
  const box = findBoxRecursive(buf, 'vapc');
  if (!box) return null;
  try {
    return JSON.parse(box.data.toString('utf8'));
  } catch {
    return null;
  }
}

export function rebuildWithVapc(buf, config) {
  const jsonStr = JSON.stringify(config);
  const jsonBuf = Buffer.from(jsonStr, 'utf8');
  const boxSize = 8 + jsonBuf.length;
  const newBox = Buffer.alloc(boxSize);
  newBox.writeUInt32BE(boxSize, 0);
  newBox.write('vapc', 4, 'ascii');
  jsonBuf.copy(newBox, 8);

  const box = findBoxRecursive(buf, 'vapc');
  if (!box) return Buffer.concat([buf, newBox]);
  return Buffer.concat([buf.slice(0, box.start), newBox, buf.slice(box.start + box.size)]);
}
