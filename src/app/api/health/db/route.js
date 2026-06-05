import { getSql, isDatabaseConfigured } from '../../../../lib/db/client.js';

/**
 * GET /api/health/db — Neon 连通性探测（不暴露连接串）
 */
export async function GET() {
  if (!isDatabaseConfigured()) {
    return Response.json(
      { ok: false, code: 'DB_NOT_CONFIGURED', message: 'DATABASE_URL 未设置' },
      { status: 503 },
    );
  }

  try {
    const sql = getSql();
    const rows = await sql`SELECT 1 AS ok, current_database() AS db, now() AS ts`;
    const row = rows[0] ?? {};
    return Response.json(
      {
        ok: true,
        database: row.db ?? null,
        serverTime: row.ts ?? null,
        projectId: process.env.NEON_PROJECT_ID || null,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    console.error('[health/db]', error);
    return Response.json(
      {
        ok: false,
        code: 'DB_CONNECT_FAILED',
        message: '数据库连接失败',
      },
      { status: 503 },
    );
  }
}
