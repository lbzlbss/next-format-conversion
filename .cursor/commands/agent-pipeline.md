# Agent 全流程闭环（含自测自愈）

阅读 `.cursor/skills/mediaflow-agent-pipeline/SKILL.md`。

## 强制：测试-修复闭环

实现或修 bug 后 **必须**：

```bash
pnpm agent:verify -- <runId> --prod https://nextformat.aiblank.top/
```

失败则：

1. 读 `docs/agent/runs/<runId>/04-verify-report.md`
2. **根据异常自行修复代码**
3. 重跑 verify，直至全部通过（最多 5 轮，可用 `pnpm agent:loop`）

**禁止** 在 verify 失败时合并主分支。

## 流程

1. `pnpm agent:intake -- "<需求>"`（无 runId 时）
2. `pnpm agent:design -- <runId>`
3. 写代码 → **verify 循环**
4. `pnpm agent:test -- <runId> --prod https://nextformat.aiblank.top/`
5. 用户确认后 `pnpm agent:git -- merge ... --confirm`
6. `pnpm agent:perf` + `pnpm agent:archive`

正式域名：**https://nextformat.aiblank.top/**
