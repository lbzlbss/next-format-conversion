# 性能与项目检测报告 · 20260522T084619

| 项 | 值 |
|----|-----|
| 需求 | AI对话助手支持生成PDF并提供下载 |
| 生成时间 | 2026-05-22T09:03:52.980Z |

---

## 构建与体积

✅ `pnpm build` 通过

.next 产物约 1101.63 MB（含本地缓存，生产以 Vercel 为准）

## 正式环境

**域名**: [https://nextformat.aiblank.top/](https://nextformat.aiblank.top/)

最近部署:
```
https://next-format-conversion-c3ykyk2wq-lbzlbss-projects.vercel.app
https://ai-time-record-i91hri527-lbzlbss-projects.vercel.app
https://next-format-conversion-fozkrvjqo-lbzlbss-projects.vercel.app
https://ai-time-record-onv0sewjb-lbzlbss-projects.vercel.app
https://ai-time-record-p1ck0e25t-lbzlbss-projects.vercel.app
```

## HTML 性能审计报告

已按团队模板生成（参考 performance-audit 样式）：

- **文件**: [`docs/agent/performance-reports/performance-audit-ai对话助手支持生成pdf并提供下载-20260522.html`](../../performance-reports/performance-audit-ai对话助手支持生成pdf并提供下载-20260522.html)
- **打开**: 在浏览器中直接打开上述 HTML 文件

## Lighthouse

- **performance**: 54
- **accessibility**: 81
- **best-practices**: 100
- **seo**: 100

## 建议优化项

详见 HTML 报告中的 **Issues / Recommendations / Quick Wins** 章节。

- 首页工具组件 `dynamic()` 懒加载，降低 Performance 分数压力
- 大图使用 `next/image`，字体 `display=swap`
- `/api/chat/pdf` Node 运行时注意冷启动与字体体积

