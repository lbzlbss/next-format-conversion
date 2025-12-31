# 多媒体格式转换工具

这是一个基于 Next.js 构建的多媒体格式转换和处理工具，提供了多种常用的媒体文件转换、压缩和处理功能。

## 功能特性

### 📁 支持的功能

1. **GIF 转 WebP**
   - 将 GIF 动画转换为更高效的 WebP 格式
   - 可调节质量、编码速度等参数
   - 支持批量转换

2. **MP4 压缩**
   - 压缩 MP4 视频文件大小
   - 可选择质量级别、编码预设、音频比特率
   - 支持调整视频分辨率
   - 批量压缩支持

3. **GIF 转 MP4**
   - 将 GIF 动画转换为 MP4 视频格式
   - 可调节质量、帧率等参数
   - 支持批量转换

4. **MP4 获取首帧**
   - 提取 MP4 视频的第一帧作为图片
   - 支持输出 WebP 或 PNG 格式
   - 可调节输出质量

5. **图片压缩**
   - 压缩 JPEG、PNG、WebP、GIF、SVG 等图片格式
   - 可调节压缩质量
   - 支持调整图片尺寸
   - 可选择输出格式
   - 支持保留或删除元数据

## 技术栈

- **框架**: Next.js 16
- **UI 组件库**: Ant Design
- **视频处理**: ffmpeg
- **图片处理**: sharp
- **开发语言**: JavaScript/TypeScript

## 快速开始

### 环境要求

- Node.js 18.x 或更高版本
- npm、yarn 或 pnpm 包管理器

### 安装依赖

```bash
# 使用 pnpm（推荐）
pnpm install

# 或使用 npm
npm install

# 或使用 yarn
yarn install
```

### 开发模式

```bash
# 使用 pnpm
pnpm dev

# 或使用 npm
npm run dev

# 或使用 yarn
yarn dev
```

应用将在 `http://localhost:3000` 启动

### 生产构建

```bash
# 构建项目
pnpm build

# 启动生产服务器
pnpm start
```

## 配置选项

### 1. GIF 转 WebP

- **质量** (1-100): 控制输出 WebP 文件的质量
- **编码速度** (0-9): 0 表示最佳压缩，9 表示最快编码
- **近无损模式**: 启用后可在几乎无损的情况下压缩文件

### 2. MP4 压缩

- **质量级别**:
  - 高质量 (18): 接近原始画质
  - 中等质量 (23): 平衡画质和文件大小
  - 低质量 (28): 较大压缩率
  - 超低质量 (32): 最大压缩率

- **编码预设**:
  - ultrafast、superfast、veryfast、faster、fast、medium、slow、slower、veryslow

- **音频比特率**: 控制音频质量，默认为 128k

- **最大宽度/高度**: 限制输出视频的最大分辨率

### 3. GIF 转 MP4

- **质量级别**: 同 MP4 压缩选项
- **编码预设**: 同 MP4 压缩选项
- **音频比特率**: 控制音频质量（如果有）

### 4. MP4 获取首帧

- **输出格式**: WebP 或 PNG
- **质量** (1-100): 控制输出图片的质量
- **编码速度** (0-6): 0 表示最快编码，6 表示最佳压缩

### 5. 图片压缩

- **质量** (1-100): 控制输出图片的质量
- **输出格式**: 保持原格式、JPEG、PNG 或 WebP
- **最大宽度/高度**: 限制输出图片的最大分辨率
- **保留 EXIF 信息**: 是否保留图片的元数据
- **删除元数据**: 是否删除所有元数据

## 使用说明

1. **选择功能**: 在顶部标签页中选择您需要的功能
2. **上传文件**: 点击上传区域或拖拽文件到上传区域
3. **配置参数**: 根据需要调整转换/压缩参数
4. **开始处理**: 点击转换/压缩按钮开始处理文件
5. **下载结果**: 处理完成后，点击下载按钮保存结果

## Docker 部署

本项目提供了 Docker 支持，可以通过 Docker Compose 快速部署：

```bash
docker-compose up -d
```

应用将在 `http://localhost:8090` 启动

## 项目结构

```
src/
├── app/
│   ├── api/            # API 路由
│   │   ├── compress-image/    # 图片压缩 API
│   │   ├── compress-mp4/      # MP4 压缩 API
│   │   ├── convert-gif/       # GIF 转 WebP API
│   │   ├── gif-to-mp4/        # GIF 转 MP4 API
│   │   └── mp4-first-frame/   # MP4 获取首帧 API
│   ├── components/     # React 组件
│   │   ├── GifToWebp.jsx      # GIF 转 WebP 组件
│   │   ├── GifToMp4.jsx       # GIF 转 MP4 组件
│   │   ├── ImageCompress.jsx  # 图片压缩组件
│   │   ├── Mp4Compress.jsx    # MP4 压缩组件
│   │   └── Mp4FirstFrame.jsx  # MP4 获取首帧组件
│   ├── layout.jsx      # 页面布局
│   └── page.jsx        # 主页面
└── public/             # 静态资源
    └── ffmpeg/         # ffmpeg 可执行文件
```

## 贡献

欢迎提交 Issues 和 Pull Requests！

## 许可证

MIT License
