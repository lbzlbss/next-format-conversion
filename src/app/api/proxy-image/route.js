import { NextResponse } from 'next/server';

/** 允许代理的图片域名白名单，防止滥用 */
const ALLOWED_ORIGINS = [
  'https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com',
  'https://ark.cn-beijing.volces.com',
];

function isAllowedUrl(href) {
  try {
    const u = new URL(href);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return ALLOWED_ORIGINS.some((allowed) => u.origin === allowed);
  } catch {
    return false;
  }
}

/**
 * GET /api/proxy-image?url=...&filename=generated.png
 * 代理图片并返回带 Content-Disposition 的下载流，便于浏览器按文件名保存
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const filename = searchParams.get('filename') || `generated_${Date.now()}.png`;

    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: '缺少有效 url 参数' }, { status: 400 });
    }

    if (!isAllowedUrl(url)) {
      return NextResponse.json({ error: '不允许代理该地址' }, { status: 403 });
    }

    const res = await fetch(url, { headers: { Accept: 'image/*' } });
    if (!res.ok) {
      return NextResponse.json({ error: `拉取图片失败: ${res.status}` }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || 'image/png';
    const buffer = await res.arrayBuffer();
    const safeName = filename.replace(/[^\w.\-]+/g, '_').slice(0, 200) || 'image.png';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[proxy-image]', error);
    return NextResponse.json({ error: '代理下载失败' }, { status: 500 });
  }
}
