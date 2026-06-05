import { auth } from '../../../../auth.js';

/**
 * @returns {Promise<{ userId: string, plan: 'free' | 'pro', email?: string|null, name?: string|null } | null>}
 */
export async function getSession() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const plan = session.user.plan === 'pro' ? 'pro' : 'free';
  return {
    userId: session.user.id,
    plan,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  };
}

/**
 * @param {import('next/server').NextRequest} [_request]
 * @param {{ required?: boolean }} [options]
 */
export async function requireUser(_request, options = {}) {
  const session = await getSession();
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
