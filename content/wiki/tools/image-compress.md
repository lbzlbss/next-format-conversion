---
title: 图片压缩
slug: image-compress
category: tools
tags: [jpeg, png, webp, 图片, 压缩, 照片]
toolKey: imageCompress
updatedAt: 2026-06-05
---

压缩 JPEG / PNG / WebP 静态图体积，可选转换输出格式。

## 操作步骤

### AI 对话助手

1. `/chat` 上传 JPG/PNG/WebP。
2. 输入 `压缩图片 质量 80` 或 `转成 webp 并压缩`。
3. 确认参数后下载。

## 参数说明

- **quality**：1–100，推荐 75–85 平衡画质与体积。
- **outputFormat**：`original` 保持原格式，或指定 `webp` / `jpeg` / `png`。
- **maxWidth / maxHeight**：限制长边可显著减小体积（如 1280、1920）。

## 适用场景

- 站点配图、商品图、聊天传图前的瘦身。
- 批量导出前统一质量档位。

## 注意事项

- PNG 照片类素材转 WebP 通常比 PNG 压缩率更高。
- 含文字/线条的图建议 quality ≥ 80，避免锯齿。
