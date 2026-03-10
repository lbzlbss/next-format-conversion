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

// 导入ReadableStream用于SSE
import { ReadableStream } from 'stream/web';

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

      // 使用ffmpeg压缩MP4，添加超时机制
      await new Promise((resolve, reject) => {
        // 设置120秒超时
        const timeout = setTimeout(() => {
          reject(new Error('压缩超时'));
        }, 120000);

        const command = ffmpeg(tempFilePath)
          .outputOptions([
            `-c:v libx264`,
            `-crf ${compressionConfig.crf}`,
            `-preset ${compressionConfig.preset}`,
            `-c:a aac`,
            `-b:a ${compressionConfig.bitrate}`,
            `-movflags +faststart` // 优化web播放
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
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`压缩进度: ${progress.percent}%`);
            } else {
              console.log(`压缩中...`);
            }
          });

        // 处理分辨率限制
        if (compressionConfig.maxWidth || compressionConfig.maxHeight) {
          command.size(`${compressionConfig.maxWidth || '?'}x${compressionConfig.maxHeight || '?'}`);
        }

        command.save(outputFilePath);
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
      const downloadName = `compressed_${String(file.name || 'video.mp4')}`;
      const asciiFallback = downloadName.replace(/[^\x20-\x7E]/g, '_');
      return new Response(compressedFile, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
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