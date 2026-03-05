FROM node:18-alpine

# 安装依赖
RUN apk add --no-cache ffmpeg build-base gcc autoconf automake libtool nasm zlib-dev

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装npm依赖
RUN npm install

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]
