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
    if (!file.type || !file.type.startsWith('video/mp4')) {
      return NextResponse.json({ error: '只支持MP4格式文件' }, { status: 400 });
    }

    // 创建临时文件路径
    const tempFilePath = path.join(tempDir, `${Date.now()}_${file.name}`);
    const outputFilePath = path.join(tempDir, `${Date.now()}_compressed_${file.name}`);

    try {
      // 写入临时文件
      const buffer = await file.arrayBuffer();
      fs.writeFileSync(tempFilePath, Buffer.from(buffer));

      // 设置压缩参数
      const compressionConfig = {
        crf: config.crf || 23,
        preset: config.preset || 'medium',
        bitrate: config.bitrate || '192k',
        maxWidth: config.maxWidth || null,
        maxHeight: config.maxHeight || null
      };

      // 使用ffmpeg压缩MP4
      await new Promise((resolve, reject) => {
        const command = ffmpeg(tempFilePath)
          .outputOptions([
            `-c:v libx264`,
            `-crf ${compressionConfig.crf}`,
            `-preset ${compressionConfig.preset}`,
            `-c:a aac`,
            `-b:a ${compressionConfig.bitrate}`,
            `-movflags +faststart` // 优化web播放
          ])
          .on('end', resolve)
          .on('error', reject)
          .save(outputFilePath);

        // 处理分辨率限制
        if (compressionConfig.maxWidth || compressionConfig.maxHeight) {
          command.size(`${compressionConfig.maxWidth || '?'}x${compressionConfig.maxHeight || '?'}`);
        }
      });

      // 获取原始文件大小
      const originalSize = fs.statSync(tempFilePath).size;
      // 获取压缩后文件大小
      const compressedSize = fs.statSync(outputFilePath).size;
      // 计算压缩率
      const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

      // 读取压缩后的文件
      const compressedFile = fs.readFileSync(outputFilePath);

      // 准备压缩信息
      const compressionInfo = JSON.stringify({
        originalSize,
        compressedSize,
        compressionRatio: parseFloat(compressionRatio)
      });

      // 返回压缩后的文件
      return new Response(compressedFile, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="compressed_${file.name}"`,
          'Content-Length': compressedFile.length,
          'x-compression-info': compressionInfo
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
    console.error('压缩MP4时出错:', error);
    return NextResponse.json({ error: error.message || '压缩MP4时出错' }, { status: 500 });
  }
}