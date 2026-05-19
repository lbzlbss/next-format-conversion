# AI 对话页

> 覆盖 `src/app/chat/page.jsx`、`components/chat/*`。

## 结构

- `SubPageHeader`：标题、副标题、知识库链接
- `ChatPanel variant="page"`：消息列表 + 底部输入

## 消息样式

| 角色 | 样式 |
|------|------|
| 用户 | `bg-mf-cta` 气泡，头像 `!bg-mf-cta` |
| 助手 | `bg-mf-surface` + `ring-mf-border`，头像 `!bg-mf-sidebar` |
| 思考块 | `bg-mf-accent-soft` + `text-mf-accent-soft-fg` |

## 发送区

- 底栏 `border-mf-border bg-mf-surface`
- 主按钮 Ant Design `type="primary"`（主题色 `#22C55E`）

## 禁止

- 紫靛渐变头像/按钮（旧版 AI 风格）
