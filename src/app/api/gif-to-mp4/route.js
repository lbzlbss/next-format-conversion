import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

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
    if (!file.type || !file.type.startsWith('image/gif')) {
      return NextResponse.json({ error: '只支持GIF格式文件' }, { status: 400 });
    }

    // 创建临时文件路径
    const tempFilePath = path.join(tempDir, `${Date.now()}_${file.name}`);
    const outputFilePath = path.join(tempDir, `${Date.now()}_converted_${file.name.replace(/\.gif$/i, '.mp4')}`);

    try {
      // 写入临时文件
      const buffer = await file.arrayBuffer();
      fs.writeFileSync(tempFilePath, Buffer.from(buffer));

      // 设置转换参数
      const conversionConfig = {
        crf: config.crf || 23,
        preset: config.preset || 'medium',
        fps: config.fps || 30,
        bitrate: config.bitrate || '192k'
      };

      // 使用ffmpeg将GIF转换为MP4
      await new Promise((resolve, reject) => {
        ffmpeg(tempFilePath)
          .outputOptions([
            `-c:v libx264`,
            `-crf ${conversionConfig.crf}`,
            `-preset ${conversionConfig.preset}`,
            `-r ${conversionConfig.fps}`,
            `-c:a aac`,
            `-b:a ${conversionConfig.bitrate}`,
            `-movflags +faststart`,
            `-pix_fmt yuv420p` // 确保兼容性
          ])
          .on('end', resolve)
          .on('error', reject)
          .save(outputFilePath);
      });

      // 读取转换后的文件
      const convertedFile = fs.readFileSync(outputFilePath);

      // 返回转换后的文件
      return new Response(convertedFile, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${file.name.replace(/\.gif$/i, '.mp4')}"`,
          'Content-Length': convertedFile.length
        }
      });
    } finally {
      // 清理临时文件
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      if (fs.existsSync(outputFilePath)) {
        fs.unlinkSync(outputFilePath);
      }
    }
  } catch (error) {
    console.error('转换GIF为MP4时出错:', error);
    return NextResponse.json({ error: error.message || '转换GIF为MP4时出错' }, { status: 500 });
  }
}