import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';

// 配置ffmpeg路径，使用项目内的ffmpeg
const ffmpegPath = path.join(process.cwd(), 'public', 'ffmpeg', 'ffmpeg');
if (fs.existsSync(ffmpegPath)) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log(`已设置ffmpeg路径: ${ffmpegPath}`);
}

// 确保临时目录存在
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const config = JSON.parse(formData.get('config') || '{}');

    if (!file) {
      return NextResponse.json({ error: '没有提供文件' }, { status: 400 });
    }

    // 验证文件类型
    if (!file.type || !file.type.startsWith('video/mp4')) {
      return NextResponse.json({ error: '只支持MP4格式文件' }, { status: 400 });
    }

    // 创建临时文件路径
    const tempFilePath = path.join(tempDir, `${Date.now()}_${file.name}`);
    const tempFramePath = path.join(tempDir, `${Date.now()}_frame.jpg`);
    const outputFilePath = path.join(tempDir, `${Date.now()}_first_frame.${config.format || 'webp'}`);

    try {
      // 写入临时文件
      const buffer = await file.arrayBuffer();
      fs.writeFileSync(tempFilePath, Buffer.from(buffer));

      // 设置转换参数
      const conversionConfig = {
        format: config.format || 'webp',
        quality: config.quality || 80,
        effort: config.effort || 4
      };

      // 使用ffmpeg提取首帧
      await new Promise((resolve, reject) => {
        ffmpeg(tempFilePath)
          .outputOptions([
            '-ss 00:00:00.001', // 提取第一帧
            '-vframes 1',      // 只提取一帧
            '-q:v 2'           // 图像质量
          ])
          .output(tempFramePath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // 使用sharp将提取的图像转换为目标格式
      const imageProcessor = sharp(tempFramePath);
      
      if (conversionConfig.format === 'webp') {
        await imageProcessor
          .webp({
            quality: conversionConfig.quality,
            effort: conversionConfig.effort
          })
          .toFile(outputFilePath);
      } else if (conversionConfig.format === 'png') {
        await imageProcessor
          .png({
            quality: conversionConfig.quality
          })
          .toFile(outputFilePath);
      } else {
        throw new Error('不支持的输出格式');
      }

      // 读取转换后的文件
      const frameFile = fs.readFileSync(outputFilePath);

      // 返回提取的首帧
      return new Response(frameFile, {
        headers: {
          'Content-Type': `image/${conversionConfig.format}`,
          'Content-Disposition': `attachment; filename="${file.name.replace(/\.mp4$/i, '_first_frame.')}${conversionConfig.format}"`,
          'Content-Length': frameFile.length
        }
      });
    } finally {
      // 清理临时文件
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      if (fs.existsSync(tempFramePath)) {
        fs.unlinkSync(tempFramePath);
      }
      if (fs.existsSync(outputFilePath)) {
        fs.unlinkSync(outputFilePath);
      }
    }
  } catch (error) {
    console.error('提取MP4首帧时出错:', error);
    return NextResponse.json({ error: error.message || '提取MP4首帧时出错' }, { status: 500 });
  }
}