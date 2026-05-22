# Agent 全流程闭环

执行 **MediaFlow Agent Pipeline**（`.cursor/skills/mediaflow-agent-pipeline/SKILL.md`）。

## 用户输入

用户应提供 **一句话需求**（可选 Figma 链接）。

## 你必须执行

1. **读取 Skill**：`.cursor/skills/mediaflow-agent-pipeline/SKILL.md`（完整五阶段）
2. **若尚无 runId**：运行  
   `pnpm agent:intake -- "<用户的一句话需求>"`  
   （有 Figma 则加 `--figma <url>`）
3. **按 Skill 当前阶段推进**，每阶段结束汇报产物路径与下一步命令
4. **阶段 3** 写代码前：`pnpm agent:git -- branch <runId>`
5. **阶段 3 结束**：`pnpm agent:test -- <runId>` 并完善测试报告
6. **阶段 4**：仅当用户明确要求合并时，`pnpm agent:git -- merge <runId> --tag <ver> --confirm`
7. **阶段 5**：部署后 `pnpm agent:perf -- <runId> <url>` 与 `pnpm agent:archive -- <runId>`

## 约束

- 合并主分支、打 tag 必须用户确认
- UI 改动遵循 `design.md` 与 figma-to-code-sync
- 用中文汇报阶段进度
