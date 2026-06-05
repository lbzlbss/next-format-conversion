# Neon Postgres 配置（Vercel Marketplace）

MediaFlow 通过 Vercel 集成 Neon，为后续 **Auth.js 用户表 / 对话历史** 提供数据库。

## 已接入（本项目）

| 项 | 值 |
|----|-----|
| 集成 | Vercel Marketplace → **Neon** |
| 资源名 | `neon-charcoal-horizon` |
| 驱动 | `@neondatabase/serverless` |
| 代码 | `src/lib/db/client.js` |
| 健康检查 | `GET /api/health/db` |

## CLI 安装步骤

```bash
# 1. 接受条款（首次）
vercel integration accept-terms neon --yes

# 2. 创建并连接到当前项目
vercel integration add neon/neon

# 3. 本地同步环境变量
vercel env pull .env.local
```

## 环境变量（Vercel 自动注入）

| 变量 | 用途 |
|------|------|
| `DATABASE_URL` | **推荐**：连接池 URL，Serverless 函数用这个 |
| `DATABASE_URL_UNPOOLED` | 直连，适合迁移脚本 |
| `POSTGRES_URL` | 与 DATABASE_URL 等价别名 |
| `NEON_PROJECT_ID` | Neon 控制台项目 ID |
| `PGHOST` / `PGUSER` / `PGPASSWORD` | 分解字段（一般不必单独用） |

应用代码统一通过 `getDatabaseUrl()` 读取，兼容 `DATABASE_URL` 与 `POSTGRES_URL`。

## 本地开发

```bash
pnpm add @neondatabase/serverless   # 已安装
vercel env pull .env.local
pnpm dev
curl -s http://localhost:3000/api/health/db
```

期望响应：

```json
{ "ok": true, "database": "neondb", "serverTime": "..." }
```

## 生产验证

```bash
curl -s https://nextformat.aiblank.top/api/health/db
```

部署后若 503，在 Vercel Dashboard **Redeploy** 一次以加载新环境变量。

## 控制台

- Vercel：**Storage** → Neon → Open in Neon Console  
- Dashboard：[Vercel Integrations → Neon](https://vercel.com/dashboard/integrations)

## 下一步（Auth P1）

1. `pnpm add next-auth@beta @auth/drizzle-adapter drizzle-orm bcrypt`
2. 在 Neon SQL Editor 或 `scripts/db-migrate.mjs` 创建 Auth.js 表
3. 配置 `AUTH_SECRET`、`AUTH_URL`
4. 开放 `/login` `/register`

详见 [auth-architecture.md](./auth-architecture.md)。

## 故障排查

| 现象 | 处理 |
|------|------|
| `DB_NOT_CONFIGURED` | 运行 `vercel integration add neon/neon` 并 redeploy |
| `DB_CONNECT_FAILED` | 检查 Neon 项目是否暂停（免费档 idle suspend） |
| 本地连不上 | `vercel env pull .env.local` 后重启 dev |
