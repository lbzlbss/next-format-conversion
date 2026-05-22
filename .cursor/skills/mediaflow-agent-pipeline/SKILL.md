---
name: mediaflow-agent-pipeline
description: MediaFlow 全流程 Agent 闭环 — 一句话需求、分析设计、代码与 Figma 还原、自测自愈、测试归档、Git、Vercel 性能报告。Use when 用户要搭建 agent、全流程、闭环、自测修复、或 /agent-pipeline。
---

# MediaFlow Agent 全流程闭环

将「一句话需求」驱动到「合并主分支 + Tag + Vercel 性能报告」的端到端流水线。**必须自测并根据异常自行修复**，直至 `agent:verify` 通过。

## 快速启动

```bash
pnpm agent:run -- "一句话需求"
# 或
pnpm agent:intake -- "需求"
pnpm agent:design -- <runId>
# 实现代码后 — 测试修复闭环（核心）
pnpm agent:verify -- <runId> --prod https://nextformat.aiblank.top/
pnpm agent:loop -- <runId> --prod https://nextformat.aiblank.top/   # 多轮直到通过
```

Cursor：**`/agent-pipeline`** + 一句话需求。

---

## 测试-修复闭环（强制）

每次改代码后 **必须** 运行验证；失败则 **必须** 读报告、改代码、重跑，**不得** 带着失败项合并。

```bash
pnpm agent:verify -- <runId> [--prod <url>] [--skip-build] [--full-lint]
```

| 检查项 | 说明 |
|--------|------|
| ESLint | 默认仅 `chat` / `pdf` / `chat-pdf-client` 范围 |
| Build | `pnpm build` |
| PDF 本地 | `generateChatPdfBuffer` 冒烟（无 pdfkit AFM） |
| PDF 线上 | `POST /api/chat/pdf`（`--prod` 时） |
| /chat 页面 | GET 可达（`--prod` 时） |

**失败产物**: `docs/agent/runs/<runId>/04-verify-report.md` + `04-verify-report.json`（含 `hint` 修复方向）

### Agent 自愈协议（必须遵守）

1. 运行 `pnpm agent:verify -- <runId> --prod https://nextformat.aiblank.top/`
2. 若 exit code ≠ 0：打开 `04-verify-report.md`，逐条处理 **失败详情与修复提示**
3. 修改代码（根因修复，禁止只改报告糊弄）
4. 再次 `agent:verify`，最多循环 **5 轮**（可用 `agent:loop`）
5. **仅当全部 ✅** 后：写 `03-test-report.md`、`agent:git -- check`、合并（需用户确认）

### 常见异常 → 修复

| 错误特征 | 修复 |
|----------|------|
| `Helvetica.afm` / `ENOENT` + pdfkit | 已弃用 pdfkit，用 `pdf-lib`；`serverExternalPackages` 含 pdf-lib |
| 字体 / 无法加载中文 | `pnpm chat-pdf:font`，build 含 ensure 脚本 |
| PDF API 非 200 | 查 `src/app/api/chat/pdf/route.js` 与 Vercel 日志 |
| Build 失败 | 按构建日志修导入/类型/Next 配置 |
| /chat 5xx | 查部署与环境变量 |

---

## 五阶段协议

### 阶段 1 · Intake

`pnpm agent:intake -- "<需求>"` → 补充 `01-requirement.md` 验收标准

### 阶段 2 · Analyze

`pnpm agent:design -- <runId>` → 完善 `02-requirement-analysis.md`

### 阶段 3 · Implement + Verify

1. `pnpm agent:git -- branch <runId>`
2. 实现功能
3. **`pnpm agent:verify` → 失败则修复 → 直至通过**
4. `pnpm agent:test -- <runId> --prod https://nextformat.aiblank.top/`
5. 填写 `03-test-report.md` 实现备注

### 阶段 4 · Git

```bash
pnpm agent:git -- check <runId>    # 内含 verify + 线上冒烟
pnpm agent:git -- merge <runId> --tag v0.x.x --confirm   # 需用户确认
```

### 阶段 5 · Deploy

```bash
pnpm agent:perf -- <runId> https://nextformat.aiblank.top/
pnpm agent:archive -- <runId>
```

---

## 状态机

| phase | status |
|-------|--------|
| verify | pending → completed / **needs-fix** |
| implement | 依赖 verify 通过 |

`state.phases.verify` 记录 `attempt` 与 `summary`。

---

## 反模式

- 未跑 verify 就合并
- 验证失败不读 `04-verify-report` 硬提交
- 跳过线上 `--prod` 冒烟（PDF 类需求必测）
- 无 `--confirm` 合并主分支
