# 需求单 · 20260525T063045

| 字段 | 值 |
|------|-----|
| Run ID | `20260525T063045` |
| 创建时间 | 2026-05-25T06:30:45.477Z |
| 功能 Slug | `首页性能优化-提升-lighthouse-performance-lcp-cls-减少首屏-js` |
| Git 分支 | `feat/20260525T063045-首页性能优化-提升-lighthouse-performance-lcp-cls-减少首屏-js` |
| Figma | （未提供） |

## 一句话需求

> 首页性能优化：提升 Lighthouse Performance、LCP、CLS，减少首屏 JS/CSS 与阻塞资源

## 需求拆解（Agent 填写）

### 目标用户 / 场景


### 功能范围

- [x] 首屏仅加载默认工具（GIF 转 WebP）相关 chunk
- [x] 切换工具按需加载，骨架屏占位
- [x] 侧栏 / 多工具布局行为不变

### 非功能要求

- [x] MediaFlow token / 布局不变
- [x] 骨架屏 `aria-live` 可访问性
- [x] `pnpm build` + `agent:verify` 通过

## 验收标准

1. 首页不再同步打包全部工具 JS（dynamic import）
2. 字体走 `next/font`，移除阻塞式 Google Fonts CSS import
3. 构建与线上 `/chat`、PDF 冒烟通过；部署后复测 Lighthouse

## 关联产物

| 阶段 | 文件 |
|------|------|
| 设计 | `02-design-spec.md` |
| 分析 | `02-requirement-analysis.md` |
| 测试 | `03-test-report.md` |
| 性能 | `05-perf-report.md` |
