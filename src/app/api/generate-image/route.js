import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure output directory exists
const outputDir = path.join(__dirname, '../../../../public/generated-images');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

export async function POST(request) {
  try {
    let prompt, mode, imageFile;
    const contentType = request.headers.get('content-type');
    console.log('[generate-image] content-type:', contentType);
    
    if (contentType && contentType.includes('multipart/form-data')) {
      // Handle form-data request
      const formData = await request.formData();
      // 先把所有字段打印出来，便于定位“无数据”问题
      const keys = [];
      for (const [k, v] of formData.entries()) {
        keys.push([k, typeof v, v && typeof v === 'object' ? (v.name || v.type || 'object') : v]);
      }
      console.log('[generate-image] form keys:', keys);

      prompt = formData.get('prompt');
      mode = formData.get('mode') || 'text2image';
      
      // Get all image files (multiple files with the same name)
      const imageFiles = [];
      for (const [key, value] of formData.entries()) {
        // Node 运行时不一定有全局 File，用 “是否有 arrayBuffer” 来判断更稳
        if (key === 'image' && value && typeof value.arrayBuffer === 'function') imageFiles.push(value);
      }
      imageFile = imageFiles.length > 0 ? (imageFiles.length === 1 ? imageFiles[0] : imageFiles) : null;
    } else if (contentType && contentType.includes('application/json')) {
      // Handle JSON request
      const jsonData = await request.json();
      prompt = jsonData.prompt;
      mode = jsonData.mode || 'text2image';
      // Note: Image file cannot be sent via JSON, only via form-data
    } else {
      return NextResponse.json({ error: '不支持的请求格式' }, { status: 400 });
    }

    prompt = typeof prompt === 'string' ? prompt : (prompt ? String(prompt) : '');
    mode = typeof mode === 'string' ? mode : (mode ? String(mode) : 'text2image');

    console.log('[generate-image] parsed:', { promptLen: prompt?.length, mode, hasImage: !!imageFile });

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: '提示词不能为空' }, { status: 400 });
    }

    // ==== 接入 Ark Doubao Seedream 生图接口 ====
    // 从项目根目录 .env 读取 ARK_API_KEY
    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ARK_API_KEY 环境变量未设置' }, { status: 500 });
    }

    // Ark images/generations endpoint
    const url = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    // 目前示例是纯文生图，图生图模式暂时复用同一接口，只是保留前端入口
    const payload = {
      model: 'doubao-seedream-5-0-260128',
      prompt,
      sequential_image_generation: 'disabled',
      response_format: 'url', // 让 Ark 返回图片 URL
      size: '2K',
      stream: false,
      watermark: true,
    };

    console.log('[generate-image] Ark payload:', { ...payload, prompt: `${prompt.slice(0, 50)}...` });

    const response = await axios.post(url, payload, { headers });
    const arkData = response.data;
    console.log('[generate-image] Ark response:', arkData);

    // Ark 生图典型返回：{ data: [{ url: '...' }, ...], ... }
    let imageData = null;
    if (arkData && Array.isArray(arkData.data) && arkData.data.length > 0) {
      const first = arkData.data[0];
      if (first.url && typeof first.url === 'string') {
        imageData = { type: 'url', data: first.url };
      } else if (first.b64_json) {
        imageData = { type: 'base64', data: first.b64_json };
      }
    }

    if (!imageData) {
      return NextResponse.json({ error: '无法从API响应中提取图片数据' }, { status: 500 });
    }

    // Save image
    const fileName = `generated_${Date.now()}.png`;
    const outputPath = path.join(outputDir, fileName);

    if (imageData.type === 'base64') {
      fs.writeFileSync(outputPath, Buffer.from(imageData.data, 'base64'));
    } else if (imageData.type === 'url') {
      const imgResponse = await axios.get(imageData.data, { responseType: 'arraybuffer' });
      fs.writeFileSync(outputPath, Buffer.from(imgResponse.data));
    }

    // Return image URL
    const imageUrl = `/generated-images/${fileName}`;
    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('生成图片失败:', error);
    return NextResponse.json({ error: '生成图片失败，请稍后重试' }, { status: 500 });
  }
}

// Helper function to find image data in response
function findImageData(obj) {
  if (typeof obj === 'object' && obj !== null) {
    // Look for inline_data with data
    const inline = obj.inline_data || obj.inlineData;
    if (inline && typeof inline === 'object' && inline.data) {
      return { type: 'base64', data: inline.data };
    }

    // Look for direct data field
    if (obj.data && typeof obj.data === 'string' && obj.data.length > 100) {
      return { type: 'base64', data: obj.data };
    }

    // Look for URL
    if (obj.url && typeof obj.url === 'string' && obj.url.startsWith('http')) {
      return { type: 'url', data: obj.url };
    }

    // Recurse
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const result = findImageData(obj[key]);
        if (result) return result;
      }
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = findImageData(item);
      if (result) return result;
    }
  }
  return null;
}