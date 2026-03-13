import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import protobuf from 'protobufjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const SVGA_PROTO_PATH = fileURLToPath(new URL('./svga.proto', import.meta.url));
let movieEntityTypePromise;

async function getMovieEntityType() {
  if (!movieEntityTypePromise) {
    movieEntityTypePromise = (async () => {
      const protoText = await readFile(SVGA_PROTO_PATH, 'utf-8');
      const parsed = protobuf.parse(protoText, { keepCase: true });
      return parsed.root.lookupType('com.opensource.svga.MovieEntity');
    })();
  }
  return movieEntityTypePromise;
}

function toSpecFromMovie(movieObj) {
  const params = movieObj?.params || {};
  return {
    fps: params.fps || 20,
    frames: params.frames || 0,
    viewBox: {
      width: params.viewBoxWidth || 100,
      height: params.viewBoxHeight || 100,
    },
    images: movieObj?.images || {},
    audios: movieObj?.audios || [],
  };
}

function parseEdits(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function parseOptions(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function imageDataToBytes(imageData) {
  if (typeof imageData !== 'string' || imageData.length === 0) return null;
  if (imageData.startsWith('data:image')) {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }
  const normalized = imageData.replace(/\s+/g, '');
  if (/^[A-Za-z0-9+/=]+$/.test(normalized)) {
    try {
      return Buffer.from(normalized, 'base64');
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeMovieImagesForProto(images) {
  if (!images || typeof images !== 'object') return {};
  const normalized = {};
  for (const [key, value] of Object.entries(images)) {
    if (value == null) continue;
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
      normalized[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      normalized[key] = Uint8Array.from(value);
      continue;
    }
    if (typeof value === 'string') {
      // 兼容 dataURL / base64 / 普通文件名字符串
      const maybeBytes = imageDataToBytes(value);
      normalized[key] = maybeBytes ?? Buffer.from(value, 'utf-8');
      continue;
    }
    try {
      normalized[key] = Buffer.from(value);
    } catch {
      // 忽略无法识别的值，避免 verify 直接失败
    }
  }
  return normalized;
}

function bytesHash(buffer) {
  let hash = 0;
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < Math.min(bytes.length, 2048); i++) {
    hash = (hash << 5) - hash + bytes[i];
    hash |= 0;
  }
  return hash.toString(16);
}

async function decodeMovieBinary(svgaContent) {
  const movieBinaryFile = svgaContent.file('movie.binary');
  if (!movieBinaryFile) return null;
  const movieBinary = await movieBinaryFile.async('nodebuffer');
  const MovieEntity = await getMovieEntityType();
  const movieMessage = MovieEntity.decode(movieBinary);
  return MovieEntity.toObject(movieMessage, {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
  });
}

async function decodeMovieEntityFromBuffer(buffer) {
  const MovieEntity = await getMovieEntityType();
  const movieMessage = MovieEntity.decode(buffer);
  return MovieEntity.toObject(movieMessage, {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
  });
}

function buildExportResponse(buffer, fileName) {
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="edited_${fileName}"`,
    },
  });
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const action = formData.get('action');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }
    if (!action || !['convert', 'compress', 'export'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action: use convert | compress | export' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    const bytes = new Uint8Array(arrayBuffer);
    const isZipLike = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
    let containerType = 'zip';
    let svgaContent = null;
    let movieObj = null;
    let spec = null;
    let hasMovieBinary = false;
    let hasMovieSpec = false;

    if (isZipLike) {
      const zip = new JSZip();
      try {
        svgaContent = await zip.loadAsync(arrayBuffer);
      } catch (zipError) {
        console.error('SVGA zip load failed:', zipError?.message, 'byteLength:', arrayBuffer.byteLength);
        return NextResponse.json(
          {
            error: 'Invalid or corrupted SVGA file (zip decode failed).',
            debug: { receivedBytes: arrayBuffer.byteLength },
          },
          { status: 400 }
        );
      }

      hasMovieBinary = !!svgaContent.file('movie.binary');
      hasMovieSpec = !!svgaContent.file('movie.spec');
      if (!hasMovieBinary && !hasMovieSpec) {
        return NextResponse.json(
          { error: 'Invalid SVGA file: neither movie.binary nor movie.spec found' },
          { status: 400 }
        );
      }

      if (hasMovieBinary) {
        movieObj = await decodeMovieBinary(svgaContent);
        spec = toSpecFromMovie(movieObj);
      } else {
        const specContent = await svgaContent.file('movie.spec').async('string');
        spec = JSON.parse(specContent);
      }
    } else {
      // 兼容部分 SVGA 文件：整体是 zlib 压缩后的 movie.binary，而非 zip 容器
      const rawBuffer = Buffer.from(arrayBuffer);
      const headerHex =
        bytes.length >= 4
          ? Array.from(bytes.slice(0, 4))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join(' ')
          : null;

      let decodedMovie = null;
      let decodeErr = null;

      // 先尝试按 zlib inflate 后 decode
      try {
        const inflated = inflateSync(rawBuffer);
        decodedMovie = await decodeMovieEntityFromBuffer(inflated);
        containerType = 'binary-deflate';
      } catch (err) {
        decodeErr = err;
      }

      // 再尝试直接 decode 原始二进制（少量文件可能不是 zlib 包）
      if (!decodedMovie) {
        try {
          decodedMovie = await decodeMovieEntityFromBuffer(rawBuffer);
          containerType = 'binary-raw';
        } catch (err) {
          decodeErr = err;
        }
      }

      if (!decodedMovie) {
        return NextResponse.json(
          {
            error:
              'Invalid or unsupported SVGA container. File is neither zip SVGA nor decodable movie.binary stream.',
            debug: {
              receivedBytes: arrayBuffer.byteLength,
              firstBytesHex: headerHex,
              decodeError: decodeErr?.message || null,
            },
          },
          { status: 400 }
        );
      }

      movieObj = decodedMovie;
      spec = toSpecFromMovie(movieObj);
      hasMovieBinary = true;
      hasMovieSpec = false;
    }

    const fps = spec.fps || 20;
    const frames = spec.frames || 0;
    const width = spec.viewBox?.width || 100;
    const height = spec.viewBox?.height || 100;

    switch (action) {
      case 'convert': {
        const format = formData.get('format');
        const options = parseOptions(formData.get('options'));
        const opts = { fps, frames, width, height, ...options };
        if (format === 'gif') return convertToGIF(opts);
        if (format === 'mp4') return convertToMP4(opts);
        if (format === 'webm') return convertToWebM(opts);
        if (format === 'png-sequence') return convertToPNGSequence(opts);
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
      }
      case 'compress': {
        const options = parseOptions(formData.get('options'));
        return handleCompress({
          spec,
          movieObj,
          hasMovieBinary,
          containerType,
          svgaContent,
          originalSize: arrayBuffer.byteLength,
          fileName: file.name,
          options,
        });
      }
      case 'export': {
        const edits = parseEdits(formData.get('edits'));
        return handleExport({
          spec,
          movieObj,
          hasMovieBinary,
          containerType,
          svgaContent,
          fileName: file.name,
          edits,
        });
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('SVGA API error:', error);
    return NextResponse.json({ error: error?.message || 'SVGA API failed' }, { status: 500 });
  }
}

async function convertToGIF(options) {
  return NextResponse.json({
    success: true,
    format: 'gif',
    message: 'GIF conversion requires client-side rendering',
    spec: {
      fps: options.fps,
      frames: options.frames,
      width: options.width,
      height: options.height,
      duration: options.frames / options.fps,
    },
  });
}

async function convertToMP4(options) {
  return NextResponse.json({
    success: true,
    format: 'mp4',
    message: 'MP4 conversion requires server-side video encoding',
    spec: {
      fps: options.fps,
      frames: options.frames,
      width: options.width,
      height: options.height,
      duration: options.frames / options.fps,
    },
  });
}

async function convertToWebM(options) {
  return NextResponse.json({
    success: true,
    format: 'webm',
    message: 'WebM conversion requires client-side MediaRecorder',
    spec: {
      fps: options.fps,
      frames: options.frames,
      width: options.width,
      height: options.height,
      duration: options.frames / options.fps,
    },
  });
}

async function convertToPNGSequence(options) {
  const frames = [];
  for (let i = 0; i < options.frames; i++) {
    frames.push({ index: i, time: i / options.fps });
  }
  return NextResponse.json({
    success: true,
    format: 'png-sequence',
    message: 'PNG sequence requires client-side rendering',
    frames,
    spec: {
      fps: options.fps,
      frames: options.frames,
      width: options.width,
      height: options.height,
    },
  });
}

async function handleCompress({
  spec,
  movieObj,
  hasMovieBinary,
  containerType,
  svgaContent,
  originalSize,
  fileName,
  options,
}) {
  if (hasMovieBinary && movieObj) {
    const movieToEdit = JSON.parse(JSON.stringify(movieObj));
    movieToEdit.images = normalizeMovieImagesForProto(movieToEdit.images);
    const compressOptions = {
      removeAudio: options.removeAudio ?? false,
      deduplicate: options.deduplicate !== false,
    };

    let totalSaved = 0;

    if (compressOptions.removeAudio && Array.isArray(movieToEdit.audios) && movieToEdit.audios.length > 0) {
      movieToEdit.audios = [];
      totalSaved += 1000;
    }

    if (compressOptions.deduplicate && movieToEdit.images && typeof movieToEdit.images === 'object') {
      const hashMap = new Map();
      for (const [key, value] of Object.entries(movieToEdit.images)) {
        const buf = Buffer.from(value);
        const hash = bytesHash(buf);
        if (hashMap.has(hash)) {
          movieToEdit.images[key] = movieToEdit.images[hashMap.get(hash)];
          totalSaved += buf.length;
        } else {
          hashMap.set(hash, key);
        }
      }
    }

    const MovieEntity = await getMovieEntityType();
    const verifyErr = MovieEntity.verify(movieToEdit);
    if (verifyErr) {
      return NextResponse.json({ error: `Invalid movie.binary after compress: ${verifyErr}` }, { status: 400 });
    }

    const newBinary = MovieEntity.encode(MovieEntity.create(movieToEdit)).finish();

    let compressedBuffer;
    if (containerType === 'binary-deflate' || containerType === 'binary-raw') {
      compressedBuffer =
        containerType === 'binary-deflate'
          ? deflateSync(Buffer.from(newBinary))
          : Buffer.from(newBinary);
    } else {
      const newZip = new JSZip();
      svgaContent.forEach((relativePath, file) => {
        if (relativePath === 'movie.binary') {
          newZip.file('movie.binary', newBinary);
        } else {
          newZip.file(relativePath, file.async('uint8array'));
        }
      });

      compressedBuffer = await newZip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });
    }

    const compressedSize = compressedBuffer.length;
    const compressionRatio = (((originalSize - compressedSize) / originalSize) * 100).toFixed(2);

    return NextResponse.json({
      success: true,
      originalSize,
      compressedSize,
      compressionRatio,
      estimatedSavedBytes: totalSaved,
      data: Buffer.from(compressedBuffer).toString('base64'),
      filename: `compressed_${fileName}`,
    });
  }

  const compressOptions = {
    imageQuality: options.imageQuality ?? 0.8,
    removeAudio: options.removeAudio ?? false,
    deduplicate: options.deduplicate !== false,
  };

  const imageMap = new Map();
  let totalSaved = 0;

  if (spec.images) {
    for (const [key, imageData] of Object.entries(spec.images)) {
      if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const imageHash = bytesHash(imageBuffer);

        if (compressOptions.deduplicate && imageMap.has(imageHash)) {
          const existingKey = imageMap.get(imageHash);
          spec.images[key] = spec.images[existingKey];
          totalSaved += imageBuffer.length;
        } else {
          imageMap.set(imageHash, key);
        }
      }
    }
  }

  if (compressOptions.removeAudio && spec.audios) {
    delete spec.audios;
    totalSaved += 1000;
  }

  const newZip = new JSZip();
  newZip.file('movie.spec', JSON.stringify(spec));

  svgaContent.forEach((relativePath, file) => {
    if (relativePath !== 'movie.spec') {
      newZip.file(relativePath, file.async('uint8array'));
    }
  });

  const compressedBuffer = await newZip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  const compressedSize = compressedBuffer.length;
  const compressionRatio = (((originalSize - compressedSize) / originalSize) * 100).toFixed(2);

  return NextResponse.json({
    success: true,
    originalSize,
    compressedSize,
    compressionRatio,
    estimatedSavedBytes: totalSaved,
    data: Buffer.from(compressedBuffer).toString('base64'),
    filename: `compressed_${fileName}`,
  });
}

async function handleExport({ spec, movieObj, hasMovieBinary, containerType, svgaContent, fileName, edits }) {
  if (hasMovieBinary && movieObj) {
    const movieToEdit = JSON.parse(JSON.stringify(movieObj));
    movieToEdit.images = normalizeMovieImagesForProto(movieToEdit.images);

    if (edits.canvas?.width != null && edits.canvas?.height != null) {
      movieToEdit.params = movieToEdit.params || {};
      movieToEdit.params.viewBoxWidth = edits.canvas.width;
      movieToEdit.params.viewBoxHeight = edits.canvas.height;
    }

    if (Array.isArray(edits.replace) && edits.replace.length > 0) {
      movieToEdit.images = movieToEdit.images || {};
      for (const replacement of edits.replace) {
        if (!replacement?.key || !replacement?.imageData) continue;
        const bytes = imageDataToBytes(replacement.imageData);
        if (bytes) {
          movieToEdit.images[replacement.key] = bytes;
        }
      }
    }

    if (edits.audio) {
      if (edits.audio.remove) {
        movieToEdit.audios = [];
      } else if (edits.audio.volume !== undefined && Array.isArray(movieToEdit.audios)) {
        const nextVolume = edits.audio.volume / 100;
        movieToEdit.audios = movieToEdit.audios.map((audio) => {
          if (audio && Object.prototype.hasOwnProperty.call(audio, 'volume')) {
            return { ...audio, volume: nextVolume };
          }
          return audio;
        });
      }
    }

    const MovieEntity = await getMovieEntityType();
    const verifyErr = MovieEntity.verify(movieToEdit);
    if (verifyErr) {
      return NextResponse.json({ error: `Invalid movie.binary after edits: ${verifyErr}` }, { status: 400 });
    }

    const newBinary = MovieEntity.encode(MovieEntity.create(movieToEdit)).finish();

    let exportedBuffer;
    if (containerType === 'binary-deflate' || containerType === 'binary-raw') {
      exportedBuffer =
        containerType === 'binary-deflate'
          ? deflateSync(Buffer.from(newBinary))
          : Buffer.from(newBinary);
    } else {
      const newZip = new JSZip();
      svgaContent.forEach((relativePath, file) => {
        if (relativePath === 'movie.binary') {
          newZip.file('movie.binary', newBinary);
        } else {
          newZip.file(relativePath, file.async('uint8array'));
        }
      });

      exportedBuffer = await newZip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });
    }

    return buildExportResponse(exportedBuffer, fileName);
  }

  if (edits.canvas?.width != null && edits.canvas?.height != null) {
    spec.viewBox = {
      ...spec.viewBox,
      width: edits.canvas.width,
      height: edits.canvas.height,
    };
  }

  if (Array.isArray(edits.replace) && edits.replace.length > 0) {
    for (const replacement of edits.replace) {
      if (replacement?.key && replacement?.imageData) {
        spec.images = spec.images || {};
        spec.images[replacement.key] = replacement.imageData;
      }
    }
  }

  if (edits.audio) {
    if (edits.audio.remove) {
      delete spec.audios;
    } else if (edits.audio.volume !== undefined && Array.isArray(spec.audios)) {
      spec.audios = spec.audios.map((audio) => ({
        ...audio,
        volume: edits.audio.volume / 100,
      }));
    }
  }

  const newZip = new JSZip();
  newZip.file('movie.spec', JSON.stringify(spec));
  svgaContent.forEach((relativePath, file) => {
    if (relativePath !== 'movie.spec') {
      newZip.file(relativePath, file.async('uint8array'));
    }
  });

  const exportedBuffer = await newZip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return buildExportResponse(exportedBuffer, fileName);
}
