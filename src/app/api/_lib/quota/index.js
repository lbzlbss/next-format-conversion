import { ApiError } from '../guard.js';
import { DAILY_LIMITS, METRIC_LABELS, QUOTA_EXCEEDED_CODE } from './constants.js';
import {
  getDailyCount,
  hashGuestActor,
  incrementDaily,
  isQuotaStoreReady,
  secondsUntilUtcMidnight,
} from './redis.js';

/**
 * @param {import('next/server').NextRequest} request
 */
export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || '127.0.0.1';
}

/**
 * @param {import('next/server').NextRequest} request
 * @param {{ userId?: string | null, plan?: 'free' | 'pro' }} [session]
 */
export function resolveActor(request, session = {}) {
  if (session?.userId) {
    const tier = session.plan === 'pro' ? 'pro' : 'user';
    return { actorId: `u:${session.userId}`, tier };
  }
  const ip = getClientIp(request);
  return { actorId: hashGuestActor(ip), tier: 'guest' };
}

/**
 * @param {'guest' | 'user' | 'pro'} tier
 * @param {string} metric
 */
export function getLimit(tier, metric) {
  return DAILY_LIMITS[tier]?.[metric] ?? 0;
}

/**
 * @param {import('next/server').NextRequest} request
 * @param {string} metric
 * @param {{ userId?: string | null, plan?: 'free' | 'pro' }} [session]
 */
export async function getQuotaStatus(request, metric, session = {}) {
  const { actorId, tier } = resolveActor(request, session);
  const limit = getLimit(tier, metric);
  const used = await getDailyCount(actorId, metric);
  return {
    metric,
    tier,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetInSeconds: secondsUntilUtcMidnight(),
    label: METRIC_LABELS[metric] || metric,
  };
}

/**
 * @param {import('next/server').NextRequest} request
 * @param {string} metric
 * @param {{ userId?: string | null, plan?: 'free' | 'pro' }} [session]
 */
export async function consumeQuota(request, metric, session = {}) {
  if (!isQuotaStoreReady()) {
    console.warn('[quota] Upstash 未配置，生产环境将拒绝计费 API');
    if (process.env.NODE_ENV === 'production') {
      throw new ApiError(
        'QUOTA_STORE_UNAVAILABLE',
        '配额服务未配置，请联系管理员',
        503,
      );
    }
  }

  const { actorId, tier } = resolveActor(request, session);
  const limit = getLimit(tier, metric);
  const usedBefore = await getDailyCount(actorId, metric);

  if (usedBefore >= limit) {
    throw new ApiError(
      QUOTA_EXCEEDED_CODE,
      buildExceededMessage(metric, tier, limit),
      429,
      {
        metric,
        tier,
        limit,
        used: usedBefore,
        remaining: 0,
        resetInSeconds: secondsUntilUtcMidnight(),
        upgradeUrl: tier === 'guest' ? '/register' : '/settings',
        loginUrl: '/login',
      },
    );
  }

  const used = await incrementDaily(actorId, metric);
  return {
    metric,
    tier,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * @param {string} metric
 * @param {'guest' | 'user' | 'pro'} tier
 * @param {number} limit
 */
function buildExceededMessage(metric, tier, limit) {
  const label = METRIC_LABELS[metric] || metric;
  if (metric === 'imageGen' && tier === 'guest') {
    return `今日免费${label}试用已达 ${limit} 次上限。注册登录可获得更多额度。`;
  }
  if (tier === 'guest') {
    return `今日游客${label}次数已用完（${limit} 次/天）。注册登录可提升额度。`;
  }
  return `今日${label}额度已用完（${limit} 次/天），请明日再试或升级套餐。`;
}

export { QUOTA_EXCEEDED_CODE };
