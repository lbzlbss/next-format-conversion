import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
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

    const apiKey = process.env.GRSAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GRSAI_API_KEY 环境变量未设置' }, { status: 500 });
    }

    // GrsAI endpoint
    const url = 'https://grsaiapi.com/v1beta/models/nano-banana-2:streamGenerateContent';

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    // Prepare parts for multi-modal input
    const parts = [{ "text": prompt }];

    if (mode === 'image2image' && imageFile) {
      // Handle multiple images for image-to-image generation
      if (Array.isArray(imageFile)) {
        // For multiple images upload
        for (const file of imageFile) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const imageB64 = buffer.toString('base64');
          parts.push({
            "inline_data": {
              "mime_type": file.type || "image/png",
              "data": imageB64
            }
          });
        }
      } else {
        // For single image upload (backward compatibility)
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        const imageB64 = buffer.toString('base64');
        parts.push({
          "inline_data": {
            "mime_type": imageFile.type || "image/png",
            "data": imageB64
          }
        });
      }
    }

    // Request payload following Gemini format
    const payload = {
      "contents": [{
        "parts": parts
      }]
    }

    // Send request to GrsAI API
    const response = await axios.post(url, payload, {
      headers,
      responseType: 'text',
    });

    // Process response
    let imageData = null;
    const responseData = response.data;
    console.log('API Response:', responseData);

    // Handle response data
    let text = responseData;
    if (typeof text === 'string') {
      text = text.trim();
    } else {
      text = JSON.stringify(text);
    }
    
    const results_to_process = [];
    
    try {
      // Try parsing as a single JSON object or list
      const result = JSON.parse(text);
      if (Array.isArray(result)) {
        results_to_process.push(...result);
      } else {
        results_to_process.push(result);
      }
    } catch (e) {
      // Try parsing concatenated JSON objects (common in streams)
      const chunks = [];
      let bracketLevel = 0;
      let currentChunk = '';
      
      for (const char of text) {
        if (char === '{') {
          bracketLevel++;
        }
        if (bracketLevel > 0) {
          currentChunk += char;
        }
        if (char === '}') {
          bracketLevel--;
          if (bracketLevel === 0) {
            chunks.push(currentChunk);
            currentChunk = '';
          }
        }
      }

      for (const chunk of chunks) {
        try {
          const result = JSON.parse(chunk);
          results_to_process.push(result);
        } catch (e) {
          continue;
        }
      }
    }

    // Process results
    for (const res of results_to_process) {
      // Check for explicit error messages from GRS API
      if (res.get && res.get('msg')) {
        console.error('API Message:', res.get('msg'));
        if (res.get('msg').toLowerCase().includes('credits not enough')) {
          return NextResponse.json({ error: 'API 余额不足，请检查账号余额' }, { status: 500 });
        }
      }

      if (res.get && res.get('error')) {
        console.error('API Error:', res.get('error'));
        return NextResponse.json({ error: `API 错误: ${res.get('error')}` }, { status: 500 });
      }

      // Find image data in response
      const found = findImageData(res);
      if (found) {
        imageData = found;
        break;
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