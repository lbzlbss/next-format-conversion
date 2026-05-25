# 性能与项目检测报告 · 20260525T063045

| 项 | 值 |
|----|-----|
| 需求 | 首页性能优化：提升 Lighthouse Performance、LCP、CLS，减少首屏 JS/CSS 与阻塞资源 |
| 生成时间 | 2026-05-25T06:36:18.185Z |

---

## 构建与体积

✅ `pnpm build` 通过

.next 产物约 1098.65 MB（含本地缓存，生产以 Vercel 为准）

## 正式环境

**域名**: [https://nextformat.aiblank.top/](https://nextformat.aiblank.top/)

最近部署:
```
https://next-format-conversion-48cne8rj9-lbzlbss-projects.vercel.app
https://next-format-conversion-c3ykyk2wq-lbzlbss-projects.vercel.app
https://ai-time-record-i91hri527-lbzlbss-projects.vercel.app
https://next-format-conversion-fozkrvjqo-lbzlbss-projects.vercel.app
https://ai-time-record-onv0sewjb-lbzlbss-projects.vercel.app
```


## Lighthouse

Lighthouse 未成功（可手动: npx lighthouse https://nextformat.aiblank.top/ --view）
Command failed: npx lighthouse "https://nextformat.aiblank.top/" --only-categories=performance,accessibility,best-practices,seo --output=json --output-path="/Users/lbz/Desktop/povision_code/next-format-conversion/docs/agent/runs/20260525T063045/lighthouse-report.json" --quiet --chrome-flags="--headless --no-sandbox" 2>/dev/null

## 建议优化项

详见 HTML 报告中的 **Issues / Recommendations / Quick Wins** 章节。

- 首页工具组件 `dynamic()` 懒加载，降低 Performance 分数压力
- 大图使用 `next/image`，字体 `display=swap`
- `/api/chat/pdf` Node 运行时注意冷启动与字体体积

