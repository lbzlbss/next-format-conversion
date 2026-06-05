---
title: GIF 转 MP4
slug: gif-to-mp4
category: tools
tags: [gif, mp4, 视频, 转换, 动图]
toolKey: gifToMp4
updatedAt: 2026-06-05
---

将 GIF 动图转为 H.264 MP4，便于视频播放器、剪辑软件或移动端分发。

## 操作步骤

### AI 对话助手

1. `/chat` 上传 GIF，输入 `转成 mp4` 或 `GIF 转视频`。
2. 可在参数表单调整 **CRF**、**FPS** 后执行。

### 首页工具

选择 **GIF 转 MP4**，上传 GIF 并设置编码参数。

## 参数说明

- **CRF（18–32）**：越小画质越高。推荐 23；小体积可试 26–28。
- **FPS**：常用 24 或 30，需与原 GIF 帧率匹配避免快慢异常。
- **preset**：`medium` 为默认；`slow` 同码率画质略好。

## 适用场景

- 需要 `<video>` 标签播放而非 `<img>`。
- 下游流程要求 MP4 容器。

## 注意事项

- 透明背景会转为不透明（通常黑底），需透明请用 WebP/APNG 方案。
