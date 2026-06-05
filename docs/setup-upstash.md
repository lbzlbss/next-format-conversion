# Upstash Redis 配置（游客配额）

MediaFlow 使用 Upstash 记录游客/用户的日配额（文生图 2 次/日等）。

## 已接入方式（推荐）

通过 **Vercel Marketplace → Upstash for Redis** 一键绑定项目后，会自动注入：

| 变量 | 说明 |
|------|------|
| `KV_REST_API_URL` | REST 端点 |
| `KV_REST_API_TOKEN` | 读写 Token |
| `KV_REST_API_READ_ONLY_TOKEN` | 只读（本项目未用） |
| `REDIS_URL` / `KV_URL` | TCP URL（本项目 REST 即可） |

代码同时兼容 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`（Upstash 控制台手动命名）。

## CLI 安装（已完成示例）

```bash
# 1. 接受 Marketplace 条款（首次）
vercel integration accept-terms upstash --yes

# 2. 为当前项目创建并连接 Redis
vercel integration add upstash/upstash-kv

# 3. 拉取到本地
vercel env pull .env.local
```

当前项目资源名：`upstash-kv-citrine-bell`  
Dashboard：[Vercel Integrations → Upstash](https://vercel.com/dashboard/integrations)

## 本地开发

```bash
vercel env pull .env.local   # 含 KV_*
pnpm dev
curl -s 'http://localhost:3000/api/quota/usage?metric=imageGen'
```

## 生产

集成连接项目后，变量已写入 **Production / Preview / Development**。需 **重新部署** 后线上函数才能读到新环境变量：

```bash
git push origin master
# 或在 Vercel Dashboard → Deployments → Redeploy
```

## 验证

```bash
# 应返回 tier/limit/remaining，而非 503
curl -s 'https://nextformat.aiblank.top/api/quota/usage?metric=imageGen'
```

## 故障排查

| 现象 | 处理 |
|------|------|
| `QUOTA_STORE_UNAVAILABLE` 503 | 生产未配置 KV_*，检查 Vercel → Settings → Environment Variables |
| 本地无限额 | 无 KV_* 时用内存计数，仅单进程 dev 有效 |
| 变量名不一致 | 确保 `redis.js` 已支持 KV_* 与 UPSTASH_REDIS_REST_* |

## 可选

- `QUOTA_SALT`：游客 IP 哈希盐，多环境建议 Production 单独设置
