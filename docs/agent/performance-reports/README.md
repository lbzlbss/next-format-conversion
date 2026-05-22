# HTML 性能审计报告

本目录存放 Agent 流水线生成的 **Frontend Performance Audit** HTML，版式参考团队 `performance-audit-*.html` 模板（深色 GitHub 风格）。

## 命名规则

```
performance-audit-<需求slug>-YYYYMMDD.html
```

示例：

- `performance-audit-ai对话助手支持生成pdf并提供下载-20260522.html`

## 生成方式

```bash
pnpm agent:perf -- <runId> https://nextformat.aiblank.top/
```

数据来源：Lighthouse（Performance / A11y / Best Practices / SEO），含页面截图（若可用）。

## 章节结构


| 章节                           | 说明                      |
| ---------------------------- | ----------------------- |
| Overall Assessment           | 总分卡片、Grade              |
| Core Web Vitals              | FCP / LCP / TBT / CLS 等 |
| Resource Overview            | 体积、请求数、DOM              |
| Issues by Severity           | 未通过审计项                  |
| Positive Findings            | 已通过项                    |
| Optimization Recommendations | Opportunity 表           |
| Quick Wins                   | 优先优化建议                  |


Markdown 摘要见对应 Run：`docs/agent/runs/<runId>/05-perf-report.md`。