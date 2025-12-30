import { NextResponse } from 'next/server';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

// 定义支持的图片格式
const SUPPORTED_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif', 'svg', 'avif']);

export async function POST(request) {
  try {
    // 解析表单数据
    const formData = await request.formData();
    const file = formData.get('file');
    const configJson = formData.get('config');

    if (!file) {
      return NextResponse.json({ error: '没有提供文件' }, { status: 400 });
    }

    // 解析配置
    let config;
    try {
      config = JSON.parse(configJson);
    } catch (error) {
      return NextResponse.json({ error: '无效的配置格式' }, { status: 400 });
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

    // 开始处理图片
    let image = sharp(buffer);

    // 获取原始图片信息
    const metadata = await image.metadata();

    // 根据配置设置图片处理参数
    if (config.maxWidth || config.maxHeight) {
      image = image.resize({
        width: config.maxWidth,
        height: config.maxHeight,
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // 设置输出格式和质量
    const outputFormat = config.outputFormat === 'original' 
      ? (metadata.format || 'jpeg') 
      : config.outputFormat;

    // 处理不同的输出格式
    switch (outputFormat.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        image = image.jpeg({
          quality: config.quality || 80,
          progressive: true,
          mozjpeg: true,
          force: true
        });
        break;
      case 'png':
        image = image.png({
          quality: config.quality || 80,
          progressive: true,
          force: true
        });
        break;
      case 'webp':
        image = image.webp({
          quality: config.quality || 80,
          force: true
        });
        break;
      case 'avif':
        image = image.avif({
          quality: config.quality || 80,
          force: true
        });
        break;
      default:
        // 保持原格式
        if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
          image = image.jpeg({ quality: config.quality || 80 });
        } else if (metadata.format === 'png') {
          image = image.png({ quality: config.quality || 80 });
        } else if (metadata.format === 'webp') {
          image = image.webp({ quality: config.quality || 80 });
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
    const compressedBuffer = await image.toBuffer();
    const compressedSize = compressedBuffer.length;

    // 计算压缩率
    const compressionRatio = originalSize > 0 
      ? ((originalSize - compressedSize) / originalSize * 100).toFixed(1) 
      : 0;

    // 确定Content-Type
    const contentType = {
      'jpeg': 'image/jpeg',
      'jpg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'avif': 'image/avif'
    }[outputFormat.toLowerCase()] || 'image/jpeg';

    // 创建响应
    const response = new NextResponse(compressedBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename=compressed.${outputFormat.toLowerCase()}`,
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