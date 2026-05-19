---
title: GIF 转 WebP
slug: gif-to-webp
category: tools
tags: [gif, webp, 转换, 动图]
toolKey: gifToWebp
updatedAt: 2026-05-19
---

将 GIF 动图转换为 WebP 格式，在保持动画的同时显著减小体积。

## 操作步骤

1. 在首页选择 **GIF 转 WebP**。
2. 上传 GIF 文件。
3. 在右侧面板调整 **Quality（质量）**、**Effort**、**Speed** 等参数。
4. 点击转换并下载 WebP 文件。

## 质量参数说明

- **Quality（1–100）**：推荐 **75–85**。低于 60 可能出现明显色带；高于 90 体积增大明显。
- **Effort（1–6）**：编码努力程度，越高压缩率越好但耗时更长，日常推荐 **4**。
- **Speed（1–10）**：编码速度，数值越大越快，推荐 **5** 平衡速度与体积。
- **Near Lossless**：开启后更接近无损，适合线条/simple 动图，体积会增大。

## 适用场景

- 网页动图瘦身，提升 LCP 与带宽表现。
- 需要 WebP 动画格式的下游流程（如部分 CDN/小程序）。

## 注意事项

- 极复杂 GIF（大分辨率、长时长）处理时间较长。
- 若动画颜色极少，可尝试提高 Quality 或开启 Near Lossless。
