import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const config = JSON.parse(formData.get('config'));

    if (!file) {
      return Response.json({ error: '未上传文件' }, { status: 400 });
    }

    // 检查文件类型
    if (file.type !== 'image/gif') {
      return Response.json({ error: '文件类型错误，仅支持 GIF 格式' }, { status: 400 });
    }

    // 将上传的文件保存到临时目录
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempInputPath = join('/tmp', `${Date.now()}_input.gif`);
    const tempOutputPath = join('/tmp', `${Date.now()}_output.gif`);

    try {
      writeFileSync(tempInputPath, buffer);
    } catch (error) {
      console.error('文件保存失败:', error);
      return Response.json({ error: '文件保存失败' }, { status: 500 });
    }

    try {
      // 使用 sharp 压缩 GIF，优化压缩参数提高效率
      const sharpInstance = sharp(tempInputPath, { animated: true });
      
      // 1. 先获取原始GIF信息，用于智能压缩
      const metadata = await sharp(tempInputPath).metadata();
      
      // 2. 激进尺寸调整：无论大小，都适当缩小以减少体积，参考在线压缩网站策略
      if (!config.width && !config.height && metadata.width && metadata.height) {
        const maxDimension = 800; // 进一步降低最大维度
        const scaleFactor = Math.min(0.8, maxDimension / Math.max(metadata.width, metadata.height));
        
        // 即使尺寸不大，也缩小80%以获得更好压缩效果
        sharpInstance.resize({
          width: Math.round(metadata.width * scaleFactor),
          height: Math.round(metadata.height * scaleFactor),
          fit: 'inside',
          withoutEnlargement: false, // 允许缩小
          kernel: 'lanczos3'
        });
      } 
      // 手动尺寸调整
      else if (config.width || config.height) {
        sharpInstance.resize({
          width: config.width,
          height: config.height,
          fit: config.fit || 'inside',
          withoutEnlargement: true,
          kernel: 'lanczos3'
        });
      }
      
      // 3. 采用更激进的压缩策略，仅使用sharp 0.34.5支持的参数
      await sharpInstance.gif({
        quality: Math.min(config.quality || 30, 100), // 降低默认质量到30，参考在线压缩网站
        effort: Math.min(config.effort || 10, 10), // 保持最大压缩努力值
        speed: Math.max(config.speed || 1, 1), // 保持最低编码速度
        colors: Math.min(Math.max(config.colors || 32, 2), 256), // 大幅减少颜色数量到32色
        dither: Math.min(Math.max(config.dither || 0.2, 0), 1), // 进一步降低抖动强度
        loop: config.loop === undefined ? 0 : config.loop,
        compressionLevel: Math.min(Math.max(config.compressionLevel || 9, 1), 9), // 最高压缩级别
        lossy: true, // 强制开启有损压缩
        optimize: true, // 强制开启优化
        interlaced: false // 关闭隔行扫描
      })
      .toFile(tempOutputPath);

      // 读取原始文件和压缩后的文件
      const originalBuffer = readFileSync(tempInputPath);
      const outputBuffer = readFileSync(tempOutputPath);
      
      // 比较大小，如果压缩后更大则使用原始文件
      if (outputBuffer.length >= originalBuffer.length) {
        console.log('压缩后文件更大，返回原始文件');
        return new Response(originalBuffer, {
          headers: {
            'Content-Type': 'image/gif',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`compressed-${file.name}`)}`,
            'X-Compression-Result': 'original',
            'X-Original-Size': originalBuffer.length,
            'X-Compressed-Size': outputBuffer.length
          }
        });
      }

      // 删除临时文件
      if (existsSync(tempInputPath)) unlinkSync(tempInputPath);
      if (existsSync(tempOutputPath)) unlinkSync(tempOutputPath);

      // 返回压缩后的 GIF 文件
      return new Response(outputBuffer, {
        headers: {
          'Content-Type': 'image/gif',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`compressed-${file.name}`)}`,
          'X-Compression-Result': 'compressed',
          'X-Original-Size': originalBuffer.length,
          'X-Compressed-Size': outputBuffer.length,
          'X-Compression-Rate': ((1 - outputBuffer.length / originalBuffer.length) * 100).toFixed(2) + '%'
        }
      });
    } catch (error) {
      // 清理临时文件
      if (existsSync(tempInputPath)) unlinkSync(tempInputPath);
      if (existsSync(tempOutputPath)) unlinkSync(tempOutputPath);

      console.error('压缩错误:', error);
      
      // 提供更详细的错误信息
      if (error.message.includes('Input file has corrupt header')) {
        return Response.json({ error: 'GIF 文件损坏，无法读取' }, { status: 400 });
      } else if (error.message.includes('insufficient memory')) {
        return Response.json({ error: '内存不足，无法处理大文件' }, { status: 500 });
      } else if (error.message.includes('Unsupported color space')) {
        return Response.json({ error: '不支持的颜色空间' }, { status: 400 });
      } else {
        return Response.json({ error: `压缩失败: ${error.message}` }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('请求处理错误:', error);
    return Response.json({ error: `请求处理错误: ${error.message}` }, { status: 500 });
  }
}