import { neon } from '@neondatabase/serverless';

let cachedSql = null;

/**
 * 解析 Neon 连接串（Vercel 集成优先 DATABASE_URL，兼容 POSTGRES_URL）
 */
export function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ''
  );
}

/**
 * @returns {import('@neondatabase/serverless').NeonQueryFunction<boolean, boolean>}
 */
export function getSql() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error('DATABASE_URL 未配置，请在 Vercel 接入 Neon 后执行 vercel env pull');
  }
  if (!cachedSql) {
    cachedSql = neon(url);
  }
  return cachedSql;
}

/** @returns {boolean} */
export function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}
