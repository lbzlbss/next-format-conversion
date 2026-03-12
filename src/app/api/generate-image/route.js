import { NextResponse } from 'next/server';
import * as dotenv from 'dotenv';

dotenv.config();

export async function POST(request) {
  try {
    let prompt, mode, imageFile;
    const contentType = request.headers.get('content-type');

    if (contentType && contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      prompt = formData.get('prompt');
      mode = formData.get('mode') || 'text2image';
      const imageFiles = [];
      for (const [key, value] of formData.entries()) {
        if (key === 'image' && value && typeof value.arrayBuffer === 'function') imageFiles.push(value);
      }
      imageFile = imageFiles.length > 0 ? (imageFiles.length === 1 ? imageFiles[0] : imageFiles) : null;
    } else if (contentType && contentType.includes('application/json')) {
      const jsonData = await request.json();
      prompt = jsonData.prompt;
      mode = jsonData.mode || 'text2image';
    } else {
      return NextResponse.json({ error: '不支持的请求格式' }, { status: 400 });
    }

    prompt = typeof prompt === 'string' ? prompt : (prompt ? String(prompt) : '');
    mode = typeof mode === 'string' ? mode : (mode ? String(mode) : 'text2image');

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: '提示词不能为空' }, { status: 400 });
    }

    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ARK_API_KEY 环境变量未设置' }, { status: 500 });
    }

    const url = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
    const payload = {
      model: 'doubao-seedream-5-0-260128',
      prompt,
      sequential_image_generation: 'disabled',
      response_format: 'url',
      size: '2K',
      stream: false,
      watermark: true,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    let arkData;
    try {
      arkData = await response.json();
    } catch (_) {
      arkData = {};
    }

    if (!response.ok) {
      console.error('[generate-image] Ark error:', response.status, arkData);
      return NextResponse.json(
        { error: arkData?.error?.message || `Ark 接口错误: ${response.status}` },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    // 直接使用 Ark 返回的图片 URL，不落盘
    let imageUrl = null;
    if (arkData?.data?.[0]) {
      const first = arkData.data[0];
      if (first.url && typeof first.url === 'string') {
        imageUrl = first.url;
      } else if (first.b64_json) {
        imageUrl = `data:image/png;base64,${first.b64_json}`;
      }
    }

    if (!imageUrl) {
      return NextResponse.json({ error: '无法从API响应中提取图片数据' }, { status: 500 });
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('生成图片失败:', error);
    return NextResponse.json({ error: '生成图片失败，请稍后重试' }, { status: 500 });
  }
}
