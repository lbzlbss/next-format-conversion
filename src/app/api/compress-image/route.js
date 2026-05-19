import { NextResponse } from 'next/server';
import sharp from 'sharp';
import path from 'path';

// 定义支持的图片格式
const SUPPORTED_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif', 'svg', 'avif']);

export async function POST(request) {
  try {
    // 解析表单数据
    const formData = await request.formData();
    const file = formData.get('file');
    const configRaw = formData.get('config');

    if (!file) {
      return NextResponse.json({ error: '没有提供文件' }, { status: 400 });
    }

    if (typeof file === 'string' || !(typeof file.arrayBuffer === 'function')) {
      return NextResponse.json(
        { error: '无效的 file 字段，请使用 multipart file 上传' },
        { status: 400 }
      );
    }

    // 解析配置（缺省或未传则用默认项，兼容部分客户端）
    let config = {};
    if (configRaw != null && configRaw !== '') {
      try {
        const text = typeof configRaw === 'string' ? configRaw : String(configRaw);
        config = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: '无效的配置格式（config 应为 JSON）' }, { status: 400 });
      }
    }

    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      return NextResponse.json({ error: 'config 必须是 JSON 对象' }, { status: 400 });
    }

    // 检查文件格式是否支持
    const fileExtension = path.extname(file.name).toLowerCase().slice(1) || 'jpeg';
    if (!SUPPORTED_FORMATS.has(fileExtension)) {
      return NextResponse.json({ error: '不支持的文件格式' }, { status: 400 });
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalSize = buffer.length;

    if (!originalSize) {
      return NextResponse.json(
        {
          error:
            '文件内容为空。若用 curl 手工拼 multipart，请确保 file 段落里包含真实的图片二进制（建议用 curl -F "file=@/path/to.jpg" ...）',
        },
        { status: 400 }
      );
    }

    // 开始处理图片
    let image = sharp(buffer);

    // 获取原始图片信息
    let metadata;
    try {
      metadata = await image.metadata();
    } catch (metaErr) {
      return NextResponse.json(
        { error: `无法读取图片（请确认为非空的有效图片）：${metaErr.message}` },
        { status: 400 }
      );
    }

    // 根据配置设置图片处理参数
    const maxWidth = typeof config.maxWidth === 'number' ? config.maxWidth : null;
    const maxHeight = typeof config.maxHeight === 'number' ? config.maxHeight : null;

    if (maxWidth || maxHeight) {
      image = image.resize({
        width: maxWidth ?? undefined,
        height: maxHeight ?? undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const rawFmt =
      typeof config.outputFormat === 'string' ? config.outputFormat.trim() : 'original';

    let outputFormat =
      rawFmt.toLowerCase() === 'original'
        ? String(metadata.format || 'jpeg').toLowerCase()
        : String(rawFmt).toLowerCase();

    // 处理不同的输出格式
    const qualityNum = typeof config.quality === 'number' ? config.quality : 80;

    switch (outputFormat) {
      case 'jpeg':
      case 'jpg':
        image = image.jpeg({
          quality: qualityNum,
          progressive: true,
          mozjpeg: true,
          force: true,
        });
        break;
      case 'png':
        image = image.png({
          compressionLevel: Math.round((100 - Math.min(Math.max(qualityNum, 0), 99)) / 11),
          progressive: true,
          force: true,
        });
        break;
      case 'webp':
        image = image.webp({
          quality: qualityNum,
          force: true,
        });
        break;
      case 'avif':
        image = image.avif({
          quality: qualityNum,
          force: true,
        });
        break;
      default: {
        // 保持与原图相同编码；不支持的格式则安全转 JPEG
        const fmt = (metadata.format && String(metadata.format).toLowerCase()) || '';
        if (fmt === 'jpeg' || fmt === 'jpg') {
          image = image.jpeg({ quality: qualityNum });
        } else if (fmt === 'png') {
          image = image.png();
        } else if (fmt === 'webp') {
          image = image.webp({ quality: qualityNum });
        } else {
          image = image.jpeg({
            quality: qualityNum,
            mozjpeg: true,
            progressive: true,
            force: true,
          });
          outputFormat = 'jpeg';
        }
        break;
      }
    }

    // 处理元数据
    if (!config.preserveExif || config.stripMetadata) {
      image = image.withMetadata({
        exif: config.preserveExif ? undefined : null,
        icc: config.stripMetadata ? null : undefined,
        xmp: config.stripMetadata ? null : undefined
      });
    }

    // 执行压缩
    let compressedBuffer;
    try {
      compressedBuffer = await image.toBuffer();
    } catch (bufErr) {
      return NextResponse.json(
        { error: `图片处理失败（可能格式不支持或服务端解码异常）：${bufErr.message}` },
        { status: 422 }
      );
    }
    const compressedSize = compressedBuffer.length;

    // 计算压缩率
    const compressionRatio = originalSize > 0 
      ? ((originalSize - compressedSize) / originalSize * 100).toFixed(1) 
      : 0;

    // 确定Content-Type
    const contentType =
      {
        jpeg: 'image/jpeg',
        jpg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        avif: 'image/avif',
      }[outputFormat] || 'image/jpeg';

    // 创建响应
    const response = new NextResponse(compressedBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename=compressed.${outputFormat}`,
        'x-compression-info': JSON.stringify({
          originalSize,
          compressedSize,
          compressionRatio: parseFloat(compressionRatio)
        })
      }
    });

    return response;
  } catch (error) {
    console.error('图片压缩失败:', error);
    return NextResponse.json(
      { error: `图片压缩失败: ${error.message}` },
      { status: 500 }
    );
  }
}