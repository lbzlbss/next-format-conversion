# MediaFlow Agent 全流程闭环

从「一句话需求」到「合并主分支 + Tag + Vercel 性能报告」的标准化流水线。

## 架构

```mermaid
flowchart LR
  A[1 一句话需求] --> B[2 分析+设计]
  B --> C[3 代码+Figma+测试]
  C --> D[4 Git分支/合并/Tag]
  D --> E[5 Vercel性能报告]
  E --> F[归档]
```

| 阶段 | 自动化 | Cursor Agent |
|------|--------|--------------|
| 1 Intake | `pnpm agent:intake` | 补充验收标准 |
| 2 Analyze | `pnpm agent:design` | 需求分析文档、Figma 清单 |
| 3 Implement | `pnpm agent:verify` / `agent:loop` | 写代码、**失败则按报告自愈** |
| 3b Test | `pnpm agent:test` | 汇总 verify + 人工清单 |
| 4 Git | `pnpm agent:git` | check 含线上冒烟，确认后合并 |
| 5 Deploy | `pnpm agent:perf` | 解读报告、优化建议 |

## 测试-修复闭环（核心）

```bash
pnpm agent:verify -- <runId> --prod https://nextformat.aiblank.top/
pnpm agent:loop -- <runId> --prod https://nextformat.aiblank.top/   # 最多 5 轮
```

失败时阅读 `docs/agent/runs/<runId>/04-verify-report.md`，Agent **必须** 根据 `hint` 改代码后重跑，直至通过。

## 快速开始

### Cursor（推荐）

```
/agent-pipeline 在 Wiki 顶栏增加搜索快捷键提示
```

### 命令行

```bash
# 一键启动（创建 run + 设计分析，然后由 Agent 实现代码）
pnpm agent:run -- "一句话需求"

# 分步
pnpm agent:intake -- "一句话需求"
pnpm agent:design -- 20260522T120000
# … Agent 实现 …
pnpm agent:test -- 20260522T120000
pnpm agent:git -- branch 20260522T120000
git add -A && git commit -m "feat: ..."
pnpm agent:git -- check 20260522T120000
pnpm agent:git -- merge 20260522T120000 --tag v0.2.0 --confirm
vercel --prod   # 或 push 触发
pnpm agent:perf -- 20260522T120000 https://xxx.vercel.app
pnpm agent:archive -- 20260522T120000
```

## 目录

```
docs/agent/
├── README.md                    # 本文件
├── templates/                   # 文档模板
├── performance-reports/         # HTML 性能审计（参考 performance-audit-*.html 样式）
├── runs/<runId>/                # 进行中产物
└── archive/<runId>/             # 完成后归档
```

### HTML 性能报告

`pnpm agent:perf` 会在 `docs/agent/performance-reports/` 生成：

`performance-audit-<slug>-YYYYMMDD.html`

版式对齐团队参考稿（深色主题、Score Cards、Core Metrics、Issues、Quick Wins），数据来自 Lighthouse。

## 环境

- Node 18+、`pnpm`
- Python 3（ui-ux-pro-max 设计脚本）
- 可选：`vercel` CLI、`npx lighthouse`（线上性能分）

## 相关

- Skill: `.cursor/skills/mediaflow-agent-pipeline/SKILL.md`
- Command: `/agent-pipeline`
