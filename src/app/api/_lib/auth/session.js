/**
 * 会话解析（P1 接入 Auth.js 后替换为 auth()）
 * @param {import('next/server').NextRequest} [_request]
 * @returns {Promise<{ userId: string | null, plan: 'free' | 'pro', email?: string | null } | null>}
 */
export async function getSession(_request) {
  // TODO: Auth.js — const session = await auth(); return session?.user
  return null;
}

/**
 * @param {import('next/server').NextRequest} request
 * @param {{ required?: boolean }} [options]
 */
export async function requireUser(request, options = {}) {
  const session = await getSession(request);
  if (!session?.userId) {
    if (options.required) {
      const { ApiError } = await import('../guard.js');
      throw new ApiError('UNAUTHORIZED', '请先登录', 401, {
        loginUrl: '/login',
      });
    }
    return null;
  }
  return session;
}
