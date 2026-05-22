# 需求分析 · 20260522T084619

**需求**: AI对话助手支持生成PDF并提供下载  
**分析时间**: 2026-05-22  
**设计稿**: 无（沿用 Chat 现有布局）  
**设计规范**: `02-design-spec.md`

---

## 1. 问题陈述

用户在与 AI 对话后，需要将对话内容以 PDF 形式保存或分享，当前仅支持页面内阅读，无法一键导出。

## 2. 现状与约束

- 对话：`ChatPanel`（`/chat`）+ `AiChatAssistant`（悬浮），SSE 流式 `/api/chat`
- 无既有 PDF 库；需在 Node 运行时生成并支持中文
- Vercel 部署需可重复获取中文字体（本地 `public/fonts` + build 脚本）

## 3. 方案对比

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| A 服务端 pdfkit + OTF | 真文本 PDF、中文可控 | 需字体文件 (~16MB) | ✅ |
| B 客户端 jspdf | 无服务端依赖 | 中文字体打包复杂 | |
| C html2canvas 截图 | 实现快 | 栅格图、体积大 | |

## 4. 推荐方案

### 架构

- `POST /api/chat/pdf`：接收 `{ title, messages, includeThinking }`，返回 `application/pdf`
- `generate-chat-pdf.js`：pdfkit 排版，Noto Sans CJK 字体
- `chat-pdf-client.js`：fetch + Blob 下载
- `ChatPdfButton`：整段 / 单条两种 mode

### 路由 / 页面

- 无新路由；在 `ChatPanel` 底栏与消息气泡内增加按钮
- `AiChatAssistant` 同步接入并改用 `useChatStream`

### API

| 路径 | 说明 |
|------|------|
| `/api/chat/pdf` | Node runtime，maxDuration 60s |

### 字体策略

- 优先 `public/fonts/NotoSansSC-Regular.otf`（gitignore）
- `scripts/ensure-chat-pdf-font.mjs` 在 `pnpm build` 前执行
- CDN 回退

## 5. 实现任务拆分（已完成）

1. ✅ API + pdfkit 生成
2. ✅ ChatPdfButton + 双端 UI
3. ✅ 字体 ensure 脚本 + .gitignore
4. ✅ 依赖 `pdfkit`

## 6. 风险与回滚

| 风险 | 缓解 |
|------|------|
| 首次构建下载字体慢 | ensure 脚本仅缺失时下载 |
| 冷启动字体 CDN 失败 | 本地字体优先 |
| PDF 过大 | 消息数/字数上限 |
