import crypto from 'crypto';

const memoryStore = new Map();

/** Vercel Marketplace 注入 KV_*；Upstash 控制台常用 UPSTASH_REDIS_REST_* */
function getUpstashRestConfig() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    '';
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    '';
  return { url, token };
}

function hasUpstash() {
  const { url, token } = getUpstashRestConfig();
  return Boolean(url && token);
}

async function upstashCommand(command) {
  const { url, token } = getUpstashRestConfig();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    throw new Error(`Upstash error: ${res.status}`);
  }
  const data = await res.json();
  return data.result;
}

/**
 * @param {string} key
 */
async function incr(key) {
  if (hasUpstash()) {
    return Number(await upstashCommand(['INCR', key]));
  }
  const next = (memoryStore.get(key) ?? 0) + 1;
  memoryStore.set(key, next);
  return next;
}

/**
 * @param {string} key
 * @param {number} seconds
 */
async function expire(key, seconds) {
  if (hasUpstash()) {
    await upstashCommand(['EXPIRE', key, String(seconds)]);
    return;
  }
  if (!memoryStore.has(`exp:${key}`)) {
    memoryStore.set(`exp:${key}`, Date.now() + seconds * 1000);
    setTimeout(() => {
      memoryStore.delete(key);
      memoryStore.delete(`exp:${key}`);
    }, seconds * 1000).unref?.();
  }
}

/**
 * @param {string} key
 */
async function get(key) {
  if (hasUpstash()) {
    const val = await upstashCommand(['GET', key]);
    return val == null ? 0 : Number(val);
  }
  return memoryStore.get(key) ?? 0;
}

export function quotaDayKey(actorId, metric) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `mf:quota:${actorId}:${metric}:${day}`;
}

export function secondsUntilUtcMidnight() {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.max(60, Math.floor((next.getTime() - now.getTime()) / 1000));
}

/**
 * @param {string} ip
 */
export function hashGuestActor(ip) {
  const salt = process.env.QUOTA_SALT || 'mediaflow-quota';
  return `g:${crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 20)}`;
}

export async function incrementDaily(actorId, metric) {
  const key = quotaDayKey(actorId, metric);
  const count = await incr(key);
  if (count === 1) {
    await expire(key, secondsUntilUtcMidnight());
  }
  return count;
}

/**
 * @param {string} actorId
 * @param {string} metric
 */
export async function getDailyCount(actorId, metric) {
  const key = quotaDayKey(actorId, metric);
  return get(key);
}

export function isQuotaStoreReady() {
  return hasUpstash() || process.env.NODE_ENV !== 'production';
}
