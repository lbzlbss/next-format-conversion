---
title: A2UI 对话界面
slug: a2ui-guide
category: getting-started
tags: [a2ui, 参数表单, 对话, 界面]
updatedAt: 2026-06-05
---

对话助手支持 A2UI 结构化界面：工具结果卡片、参数确认表单、Wiki 参考链接等。

## 参数表单

当意图较模糊（如「压缩一下」）时，助手可能弹出 **参数表单** Surface：

1. 查看建议的 quality、CRF、格式等字段。
2. 修改后点击 **确认执行**。
3. 系统调用对应 API 并在对话中展示结果卡片。

关闭参数表单：环境变量 `NEXT_PUBLIC_A2UI_PARAM_FORM=0` 可回退为纯文本确认。

## 工具结果卡片

文件处理完成后，以 A2UI 卡片展示：

- 输入/输出文件名
- 关键参数摘要
- 下载按钮

回退开关：`NEXT_PUBLIC_A2UI_ENABLED=0` 使用经典 ToolResultCard。

## Wiki 参考（WikiRef）

回答底部可能出现 **参考 Wiki** 链接，点击跳转对应文档章节（含锚点）。

## LLM 生成界面（P2）

服务端 `A2UI_LLM_ENABLED=1` 时，助手可额外生成简单布局 Surface；需符合 `mediaflow-chat-v1` 组件目录。

## 常见问题

- **没看到表单**：可能意图已足够明确，或已关闭 PARAM_FORM。
- **表单字段不对**：在消息中补充具体参数，或改在首页工具页手动设置。
