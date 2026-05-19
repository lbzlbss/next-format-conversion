---
title: Prompt 与 ControlNet 指南
slug: prompt-guide
category: ai
tags: [prompt, controlnet, seed, 文生图, 图生图]
updatedAt: 2026-05-19
---

## Prompt 结构

推荐公式：**主体 + 环境 + 风格 + 细节 + 质量词**。

示例：
`年轻女性肖像，城市夜景背景，赛博朋克风格，霓虹灯光，8k，细节丰富`

## ControlNet

**ControlNet** 用于约束构图、姿态或边缘，常见类型：
- **Canny**：保留线稿结构。
- **Depth**：保留空间深度关系。
- **OpenPose**：控制人物姿态。

使用步骤：上传参考图 → 选择 ControlNet 类型 → 设置权重（通常 0.5–1.0）→ 生成。

## Seed 值

**Seed值** 决定随机噪声初值。固定 Seed 可复现相近结果；探索阶段用 `-1` 随机。找到满意图后记录 Seed 便于微调。

## 图生图要点

- **重绘幅度（Denoising）**：0.3–0.5 保留原图结构；0.6–0.8 较大改动；0.75+ 接近重绘风格。
- 参考图清晰度直接影响输出质量。
