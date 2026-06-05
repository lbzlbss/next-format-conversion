# Next.js 生产镜像（pnpm + Node 20）
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat ffmpeg \
  build-base gcc autoconf automake libtool nasm zlib-dev
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# 依赖
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 构建
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# 运行
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat ffmpeg
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/data ./data
COPY --from=builder /app/content ./content

RUN chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000

CMD ["pnpm", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
