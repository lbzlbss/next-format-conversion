# 多媒体格式转换工具

一个功能强大的多媒体格式转换和压缩工具，支持GIF转WebP、MP4压缩、GIF转MP4、MP4获取首帧、图片压缩和GIF压缩等功能。

## 功能特性

- ✅ GIF 转 WebP
- ✅ MP4 压缩
- ✅ GIF 转 MP4
- ✅ MP4 获取首帧
- ✅ 图片压缩
- ✅ GIF 压缩

## 快速开始

### 方法一：本地开发环境

#### 1. 安装依赖

```bash
cd next-format-conversion
npm install
```

#### 2. 启动开发服务器

```bash
npm run dev
```

#### 3. 访问应用

打开浏览器，访问 http://localhost:3000

### 方法二：Docker 容器化部署

#### 1. 构建和启动容器

```bash
cd next-format-conversion
docker-compose up -d
```

#### 2. 访问应用

打开浏览器，访问 http://localhost:3000

### 方法三：一键启动脚本

#### 1. 运行启动脚本

```bash
cd next-format-conversion
chmod +x start.sh
./start.sh
```

#### 2. 访问应用

打开浏览器，访问 http://localhost:3000

## 技术栈

- **前端**：React 19, Next.js 16, Ant Design 6
- **后端**：Next.js API Routes
- **图像处理**：Sharp, FFmpeg
- **构建工具**：Tailwind CSS 4

## 项目结构

```
next-format-conversion/
├── src/
│   ├── app/
│   │   ├── api/              # API路由
│   │   │   ├── compress-gif/   # GIF压缩
│   │   │   ├── compress-image/ # 图片压缩
│   │   │   ├── compress-mp4/   # MP4压缩
│   │   │   ├── convert-gif/     # GIF转WebP
│   │   │   ├── gif-to-mp4/      # GIF转MP4
│   │   │   └── mp4-first-frame/ # MP4获取首帧
│   │   ├── components/        # 前端组件
│   │   └── page.jsx           # 主页面
├── Dockerfile
├── docker-compose.yml
├── start.sh                   # 一键启动脚本
├── package.json
└── README.md
```

## 使用指南

### 1. GIF 转 WebP

1. 点击「GIF 转 WebP」标签
2. 点击「选择多个 GIF 文件」按钮
3. 选择要转换的 GIF 文件
4. 调整转换参数（可选）
5. 点击「批量转换为 WebP」按钮
6. 转换完成后，点击「下载」按钮保存文件

### 2. MP4 压缩

1. 点击「MP4 压缩」标签
2. 点击「选择 MP4 文件」按钮
3. 选择要压缩的 MP4 文件
4. 调整压缩参数（可选）
5. 点击「压缩 MP4」按钮
6. 压缩完成后，点击「下载」按钮保存文件

### 3. GIF 转 MP4

1. 点击「GIF 转 MP4」标签
2. 点击「选择 GIF 文件」按钮
3. 选择要转换的 GIF 文件
4. 点击「转换为 MP4」按钮
5. 转换完成后，点击「下载」按钮保存文件

### 4. MP4 获取首帧

1. 点击「MP4 获取首帧」标签
2. 点击「选择 MP4 文件」按钮
3. 选择要处理的 MP4 文件
4. 点击「获取首帧」按钮
5. 处理完成后，点击「下载」按钮保存图片

### 5. 图片压缩

1. 点击「图片压缩」标签
2. 点击「选择图片文件」按钮
3. 选择要压缩的图片文件
4. 调整压缩参数（可选）
5. 点击「压缩图片」按钮
6. 压缩完成后，点击「下载」按钮保存文件

### 6. GIF 压缩

1. 点击「GIF 压缩」标签
2. 点击「选择多个 GIF 文件」按钮
3. 选择要压缩的 GIF 文件
4. 调整压缩参数（可选）
5. 点击「批量压缩 GIF」按钮
6. 压缩完成后，点击「下载」按钮保存文件

## 注意事项

1. **文件大小限制**：建议处理不超过100MB的文件
2. **处理时间**：较大的文件可能需要较长的处理时间
3. **系统要求**：需要足够的内存和CPU资源来处理多媒体文件
4. **依赖项**：某些功能依赖于FFmpeg和Sharp库

## 故障排除

### 1. 依赖安装失败

- 确保网络连接正常
- 尝试使用 `npm install --legacy-peer-deps`
- 检查Node.js版本（建议使用v18+）

### 2. 启动失败

- 检查端口3000是否被占用
- 查看终端错误信息
- 确保所有依赖已正确安装

### 3. 处理失败

- 检查文件格式是否正确
- 确保文件未损坏
- 尝试减小文件大小

## 未来计划

- [ ] 支持更多文件格式
- [ ] 增加批量处理功能
- [ ] 优化处理速度
- [ ] 添加更多压缩选项
- [ ] 支持云存储集成

## 许可证

MIT

## 贡献

欢迎提交Issue和Pull Request！
