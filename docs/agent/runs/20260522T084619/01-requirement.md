# 需求单 · 20260522T084619

| 字段 | 值 |
|------|-----|
| Run ID | `20260522T084619` |
| 创建时间 | 2026-05-22T08:46:19.739Z |
| 功能 Slug | `ai对话助手支持生成pdf并提供下载` |
| Git 分支 | `feat/20260522T084619-ai对话助手支持生成pdf并提供下载` |
| Figma | （未提供 — 复用现有 Chat UI） |

## 一句话需求

> AI对话助手支持生成PDF并提供下载

## 需求拆解（Agent 填写）

### 目标用户 / 场景

- 使用 `/chat` 全页对话或首页右下角悬浮助手的用户
- 需要将 AI 回复或整段对话留存、分享、打印的场景

### 功能范围

- [x] 核心功能：服务端生成 PDF（中文）、浏览器触发下载
- [x] 导出整段对话（跳过欢迎语）
- [x] 单条助手回复导出 PDF
- [x] 包含思考过程、Wiki 参考来源（如有）
- [x] `/chat` 与 `AiChatAssistant` 双入口一致
- [x] 边界：消息条数/总字数上限、字体缺失时友好报错

### 非功能要求

- [x] 符合 `design.md` / MediaFlow token（`ChatPdfButton` 使用 mf-*）
- [x] 可访问性（按钮 aria-label、focus-ring）
- [x] 构建通过 `pnpm lint` + `pnpm build`（含字体 ensure 脚本）

## 验收标准

1. 对话至少一轮后，点击「导出对话 PDF」能下载合法 PDF，中文不乱码
2. 单条助手消息右下角「PDF」可仅导出该条（含思考过程）
3. `POST /api/chat/pdf` 对空消息返回 400；超长内容返回 400

## 关联产物

| 阶段 | 文件 |
|------|------|
| 设计 | `02-design-spec.md` |
| 分析 | `02-requirement-analysis.md` |
| 测试 | `03-test-report.md` |
| 性能 | `05-perf-report.md` |
