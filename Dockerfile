# 使用官方Node.js镜像作为基础
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 安装pnpm
RUN npm install -g pnpm

# 复制package.json和pnpm-lock.yaml文件
COPY package.json pnpm-lock.yaml ./

# 安装项目依赖
RUN pnpm install

# 复制项目源代码
COPY . .

# 构建项目
RUN pnpm build

# 设置环境变量
ENV NODE_ENV=production

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["pnpm", "start"]