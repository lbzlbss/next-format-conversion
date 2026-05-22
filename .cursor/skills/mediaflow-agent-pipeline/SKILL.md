---
name: mediaflow-agent-pipeline
description: MediaFlow 全流程 Agent 闭环 — 一句话需求、分析设计、代码与 Figma 还原、测试归档、Git 分支合并打 tag、Vercel 部署后性能报告。Use when 用户要搭建 agent、全流程、闭环、需求到上线、或 /agent-pipeline。
---

# MediaFlow Agent 全流程闭环

将「一句话需求」驱动到「合并主分支 + Tag + Vercel 性能报告」的端到端流水线。脚本负责可重复步骤；Cursor Agent 负责分析、编码与 Figma 对齐。

## 快速启动

```bash
# 1) 创建 Run + 需求单 + 设计分析
pnpm agent:run -- "在侧栏增加 WebP 转 AVIF 工具"

# 或分步
pnpm agent:intake -- "一句话需求" [--figma <url>]
pnpm agent:design -- <runId>
```

在 Cursor 输入 **`/agent-pipeline`** 并附上同一句话需求，Agent 按下方五阶段执行。

---

## 五阶段协议（必须按序）

### 阶段 1 · 一句话需求（Intake）

**脚本**: `pnpm agent:intake -- "<需求>"`

**Agent 必做**:

1. 确认 `docs/agent/runs/<runId>/01-requirement.md` 已生成
2. 补充「需求拆解」「验收标准」三节（具体、可测）
3. 若用户给了 Figma 链接，写入 `state.json` 的 `figmaUrl`

**产出**: `01-requirement.md`, `state.json`

---

### 阶段 2 · 需求分析 + 设计方案（Analyze）

**脚本**: `pnpm agent:design -- <runId>`

**Agent 必做**:

1. 阅读 `01-requirement.md` 与 `02-design-spec.md`
2. 完善 `02-requirement-analysis.md`：问题陈述、方案对比、推荐方案、任务拆分
3. 若涉及 UI，运行 ui-ux-pro-max（Skill 已脚本化）；必要时更新 `design.md` / `design-system/mediaflow/pages/*.md`
4. 有 Figma 时 **先读 MCP**（`.cursor/skills/figma-to-code-sync`），输出 Figma 同步清单

**产出**: `02-requirement-analysis.md`, `02-design-spec.md`

---

### 阶段 3 · 代码实现 + 设计还原 + 测试报告（Implement）

**Agent 必做**（本阶段无全自动脚本，由 Agent 写代码）:

1. 从 `main`/`master` 切功能分支: `pnpm agent:git -- branch <runId>`
2. 按分析文档实现；UI 遵循 `.cursor/rules/mediaflow-ui-design.mdc`
3. Figma 还原：MCP → token → 组件，禁止凭感觉补值
4. 实现完成后运行: `pnpm agent:test -- <runId>`
5. 在 `03-test-report.md` 填写「Agent 实现备注」：改动文件、决策、已知限制
6. 用户确认后 `git add` + `git commit`（遵循仓库 commit 风格）

**产出**: 代码变更 + `03-test-report.md`

---

### 阶段 4 · Git 分支、检查、合并、Tag（Git）

```bash
pnpm agent:git -- check <runId>          # lint + build 预检
# 用户明确要求合并时:
pnpm agent:git -- merge <runId> --tag v0.1.0 --confirm
```

**Agent 规则**:

- **禁止** 未经用户确认执行 `merge --confirm`
- 合并前必须 `check` 通过
- Tag 建议语义化：`v<major>.<minor>.<patch>` 或与用户约定
- 合并后提示: `git push origin main --tags`

**产出**: 合并记录写入 `state.json.phases.git`

---

### 阶段 5 · Vercel 构建后项目检测 + 性能报告（Deploy）

```bash
# 部署完成后（或提供预览 URL）
pnpm agent:perf -- <runId> https://your-app.vercel.app
pnpm agent:archive -- <runId>
```

**Agent 必做**:

1. 确认 Vercel 部署成功（`vercel ls` / 用户提供 URL）
2. 阅读 `05-perf-report.md`，补充「建议优化项」
3. 运行 `pnpm agent:archive -- <runId>` 归档到 `docs/agent/archive/<runId>/`

**产出**: `05-perf-report.md`, `docs/agent/archive/<runId>/INDEX.md`

---

## 状态机

读取 `docs/agent/runs/<runId>/state.json`：

| phase | phases.*.status |
|-------|-----------------|
| intake | completed |
| analyze | pending → completed |
| implement | pending → completed / needs-fix |
| git | pending → in-progress → completed |
| deploy | pending → completed |

当前阶段字段: `state.phase`

---

## 技能依赖

| 场景 | Skill |
|------|-------|
| UI/设计系统 | `.cursor/skills/ui-ux-pro-max` |
| Figma 还原 | `.cursor/skills/figma-to-code-sync` |
| UI 规则 | `.cursor/rules/mediaflow-ui-design.mdc` |
| Vercel 部署/CLI | Vercel `vercel-cli` skill |
| 合并前 CI | `pnpm agent:git -- check` |

---

## 对话模板（给用户）

```
【Agent 流水线 · Run {runId}】
✅ 阶段 N 完成: <摘要>
📁 产物: docs/agent/runs/{runId}/...
⏭ 下一步: <命令或需用户确认的操作>
```

---

## 反模式

- 跳过 `01-requirement.md` 验收标准直接写代码
- 未跑 `agent:test` 就合并
- 无 `--confirm` 合并到主分支
- Figma 未读 MCP 就硬编码 hex
- 把 `docs/agent/runs/*` 里的 secrets 提交进 Git
