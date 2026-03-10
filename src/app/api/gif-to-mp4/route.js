import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';

// 配置ffmpeg路径
let ffmpegPath;
if (process.env.NODE_ENV === 'production') {
  // 生产环境下使用系统安装的ffmpeg
  ffmpegPath = '/usr/bin/ffmpeg';
} else {
  // 开发环境下使用项目内的ffmpeg
  ffmpegPath = path.join(process.cwd(), 'public', 'ffmpeg', 'ffmpeg');
}

if (fs.existsSync(ffmpegPath)) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log(`已设置ffmpeg路径: ${ffmpegPath}`);
} else {
  console.error(`未找到ffmpeg可执行文件: ${ffmpegPath}`);
  // 在开发环境中，如果找不到ffmpeg，尝试使用系统安装的
  if (process.env.NODE_ENV !== 'production') {
    const systemFfmpeg = '/usr/bin/ffmpeg';
    if (fs.existsSync(systemFfmpeg)) {
      ffmpeg.setFfmpegPath(systemFfmpeg);
      console.log(`已回退到系统ffmpeg: ${systemFfmpeg}`);
    }
  }
}

// 使用系统临时目录
const tempDir = os.tmpdir();
console.log(`使用临时目录: ${tempDir}`);

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

      // 使用ffmpeg将GIF转换为MP4，添加超时机制
      await new Promise((resolve, reject) => {
        // 设置120秒超时
        const timeout = setTimeout(() => {
          reject(new Error('转换超时'));
        }, 120000);

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
          .on('end', () => {
            clearTimeout(timeout);
            resolve();
          })
          .on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          })
          .on('start', (cmd) => {
            console.log(`开始执行ffmpeg命令: ${cmd}`);
          })
          .save(outputFilePath);
      });

      // 读取转换后的文件
      const convertedFile = fs.readFileSync(outputFilePath);

      // 返回转换后的文件
      const downloadName = String(file.name || 'converted.mp4').replace(/\.gif$/i, '.mp4');
      const asciiFallback = downloadName.replace(/[^\x20-\x7E]/g, '_');
      return new Response(convertedFile, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
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