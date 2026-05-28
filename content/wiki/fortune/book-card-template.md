---
title: 命理/风水书目卡片模板
slug: fortune-book-card-template
category: fortune
tags: [命理, 风水, 书目, 模板]
updatedAt: 2026-05-28
---

用于统一录入命理/风水书目条目的模板。

## 推荐字段

```yaml
author: 作者
title: 书名
publisher: 出版社
isbn: 书号（优先录入）
editionYear: 版次年份
sourceUrl:
  - 参考链接1
  - 参考链接2
note: 备注（如待核验信息）
```

## 示例

```text
author: 张三
title: 某某风水学
publisher: 某某出版社
isbn: 9781234567890
editionYear: 2022
sourceUrl:
  - https://example.com/book-detail
note: 版本信息待复核
```

## 录入原则

- 优先保留可独立核验的信息（ISBN、出版社、版次）。
- 对“合集/影印本/电商散卖”信息不直接作为核心来源。
- 至少保留 1 个可访问的公开来源链接。
