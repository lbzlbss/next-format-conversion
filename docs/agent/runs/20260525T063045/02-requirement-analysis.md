# 需求分析 · 20260525T063045

**需求**: 首页性能优化：提升 Lighthouse Performance、LCP、CLS，减少首屏 JS/CSS 与阻塞资源  
**分析时间**: 2026-05-25T06:30:51.719Z

---

## 1. 问题陈述

首页 `page.jsx` 同步 import 全部 10+ 工具组件（含 SVGA/VAP/WebGL），导致首屏 JS 体积过大、Lighthouse Performance 偏低（生产约 39）。Google Fonts 通过 CSS `@import` 阻塞渲染，影响 LCP。

## 2. 现状与约束

- 单页多工具切换，默认仅展示 `gifToWebp`
- 须保持现有交互与 Ant Design 主题
- 构建须通过 `pnpm build`；合并前 `agent:verify`

## 3. 方案对比

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| A. `next/dynamic` 按工具 code-split | 改动集中、首屏只加载默认工具 | 切换工具有短暂加载 | ✅ |
| B. 每工具独立路由 | 首屏最轻 | 破坏单页体验、改动大 | |
| C. 仅优化字体 | LCP 改善有限 | 不解决 JS 主因 | 作补充 |

## 4. 推荐方案

### 架构

- `lazy-tools.jsx`：`dynamic(..., { ssr: false })` + 固定高度 `ToolPanelSkeleton`
- `SvgaWorkspace` / `VapWorkspace`：重型工具独立 chunk
- `next/font` 自托管 Fira Sans/Code，移除 `fonts.googleapis.com` CSS import

### 验收

1. 首屏不再打包 SVGA/VAP/其余未选工具
2. `next build` 通过
3. `agent:perf` 后 Performance 分数提升（部署后对比）

## 5. 实现任务

1. ✅ 工具 dynamic import + 骨架屏
2. ✅ `src/app/fonts.js` + layout 变量
3. ✅ 更新 globals.css 字体 token
4. verify + perf 报告
