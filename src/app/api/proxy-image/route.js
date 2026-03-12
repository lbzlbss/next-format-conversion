import { NextResponse } from 'next/server';

/** 允许代理的图片域名：Ark/火山引擎 CDN 相关 */
const ALLOWED_HOSTS = ['volces.com', 'volcengine.com', 'volccdn.com'];

function isAllowedUrl(href) {
  try {
    const u = new URL(href);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
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
