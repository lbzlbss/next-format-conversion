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
    const tempOutputPath = join('/tmp', `${Date.now()}_output.webp`);

    try {
      writeFileSync(tempInputPath, buffer);
    } catch (error) {
      console.error('文件保存失败:', error);
      return Response.json({ error: '文件保存失败' }, { status: 500 });
    }

    try {
      // 使用 sharp 转换 GIF 到 WebP
      await sharp(tempInputPath, { animated: true })
        .webp({
          quality: config.quality || 40,
          effort: config.effort || 4,
          speed: config.speed || 8,
          nearLossless: config.nearLossless || false
        })
        .toFile(tempOutputPath);

      // 直接读取转换后的文件，保持动态WebP特性
      const outputBuffer = readFileSync(tempOutputPath);

      // 删除临时文件
      if (existsSync(tempInputPath)) unlinkSync(tempInputPath);
      if (existsSync(tempOutputPath)) unlinkSync(tempOutputPath);

      // 返回转换后的 WebP 文件
      return new Response(outputBuffer, {
        headers: {
          'Content-Type': 'image/webp',
          'Content-Disposition': `attachment; filename="${file.name.replace('.gif', '.webp')}"`
        }
      });
    } catch (error) {
      // 清理临时文件
      if (existsSync(tempInputPath)) unlinkSync(tempInputPath);
      if (existsSync(tempOutputPath)) unlinkSync(tempOutputPath);

      console.error('转换错误:', error);
      
      // 提供更详细的错误信息
      if (error.message.includes('Input file has corrupt header')) {
        return Response.json({ error: 'GIF 文件损坏，无法读取' }, { status: 400 });
      } else if (error.message.includes('insufficient memory')) {
        return Response.json({ error: '内存不足，无法处理大文件' }, { status: 500 });
      } else if (error.message.includes('Unsupported color space')) {
        return Response.json({ error: '不支持的颜色空间' }, { status: 400 });
      } else {
        return Response.json({ error: `转换失败: ${error.message}` }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('请求处理错误:', error);
    return Response.json({ error: `请求处理错误: ${error.message}` }, { status: 500 });
  }
}