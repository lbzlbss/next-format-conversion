import { getSession } from '../../_lib/auth/session.js';
import { getQuotaStatus } from '../../_lib/quota/index.js';

/**
 * GET /api/quota/usage?metric=imageGen|chat|convert
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get('metric') || 'imageGen';
  const allowed = ['imageGen', 'chat', 'convert'];
  if (!allowed.includes(metric)) {
    return Response.json({ error: '无效的 metric' }, { status: 400 });
  }

  const session = await getSession();
  const status = await getQuotaStatus(request, metric, session ?? {});

  return Response.json(status, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
