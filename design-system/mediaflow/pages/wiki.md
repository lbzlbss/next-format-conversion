# 知识库

> 覆盖 `src/app/wiki/**`、`components/wiki/*`。

## 列表页 `/wiki`

- 顶栏：`SubPageHeader` +「去对话」
- 搜索：标题、描述、标签
- 分类区块 + 双列卡片（`mf-card-hover`）
- 空索引：构建指引 `pnpm wiki:build`

## 文章页 `/wiki/[slug]`

- 顶栏：标题 + 摘要/更新日期
- 标签：分类 + 文档 tags
- 正文：`mf-card` + `.wiki-prose`
- 桌面右侧：目录锚点 + 同分类相关阅读
- 移动：顶部目录胶囊
- 底部：返回工具台、就此提问（`/chat?wiki=slug`）

## Markdown 渲染

支持：`##/###`、列表、表格、`` `code` ``、`**bold**`、引用块；首行 `#` 与页标题去重。
