# Auth 页面设计规范（登录 / 注册）

> 覆盖 `/login`、`/register`、`/forgot-password`、`/reset-password`  
> 母版：[MASTER.md](../MASTER.md) · 架构：[docs/auth-architecture.md](../../../docs/auth-architecture.md)

---

## 1. 布局

### 1.1 页面骨架

```
┌─────────────────────────────────────────────┐
│  ← 返回首页          MediaFlow Logo（可选）   │  顶栏：高 56px，bg-mf-surface，border-b
├─────────────────────────────────────────────┤
│                                             │
│         ┌─────────────────────┐           │
│         │     AuthCard          │           │  居中卡片 max-w-md (448px)
│         │  标题 + 表单 + 操作    │           │  bg-mf-surface mf-card 圆角 mf-radius-lg
│         └─────────────────────┘           │
│                                             │
│              页脚链接（条款/隐私）            │  text-xs text-mf-muted
└─────────────────────────────────────────────┘
```

- 背景：`bg-mf-canvas` 全屏 `min-h-[100dvh]`
- **不用** 全屏渐变、不用紫色 AI 风
- 移动端：卡片左右 `px-4`，宽度 `w-full max-w-md`

### 1.2 与 SubPageHeader 的关系

认证页使用 **轻量顶栏**（非 `SubPageHeader`），仅：返回箭头 + 可选 Logo，避免副标题占用垂直空间。

---

## 2. AuthCard 组件

| 属性 | 规范 |
|------|------|
| 内边距 | `p-6 md:p-8` |
| 阴影 | `mf-card`（`--mf-shadow-md`） |
| 标题 | `font-mono text-xl font-semibold text-mf-text` |
| 副标题 | `text-sm text-mf-muted mt-1` |

### 2.1 登录页 `/login`

**标题：** 登录 MediaFlow  
**副标题：** 使用邮箱或第三方账号继续

**表单字段：**

| 字段 | 组件 | 规则 |
|------|------|------|
| 邮箱 | `Input` `type=email` | 必填，Ant Form 校验 |
| 密码 | `Input.Password` | 必填 |
| 记住我 | `Checkbox` | 映射 session maxAge |

**主按钮：** `Button type=primary block` 文案「登录」，`h-10`，主色 `#2563EB`

**次链接行：**

```
忘记密码？          还没有账号？注册
text-mf-cta         text-mf-cta
```

**OAuth 区（P1）：**

```
────────── 或 ──────────   （Divider + text-mf-muted text-xs）

[ GitHub 继续 ]  [ Google 继续 ]
outline Button，图标左对齐，block 间距 space-y-2
```

### 2.2 注册页 `/register`

**标题：** 创建账号  
**副标题：** 游客文生图每日 2 次试用；注册后额度提升  
**字段：** 邮箱、密码、确认密码  
**密码提示：** `text-xs text-mf-muted` — 至少 8 位，含字母与数字  

**勾选：** `我已阅读并同意 服务条款 与 隐私政策`（链接 `text-mf-cta`）

**主按钮：** 「注册」

**底部：** `已有账号？登录`

### 2.3 忘记 / 重置密码

- `/forgot-password`：仅邮箱 + 「发送重置链接」
- `/reset-password`：新密码 + 确认密码 + 「更新密码」
- 成功态：Ant `Result` `status=success`，按钮回登录

---

## 3. 表单交互

| 规则 | 实现 |
|------|------|
| 提交中 | 主按钮 `loading`，禁止重复提交 |
| 错误 | Form 顶部 `Alert type=error`，或字段下 `help` 红色 |
| 聚焦 | 输入框 `mf-focus-ring`（globals 已有） |
| 密码可见 | Ant `Input.Password` 自带 |
| 无障碍 | `label` 关联、`aria-invalid` on error |

**错误文案示例：**

- 邮箱或密码错误（不区分，防枚举）
- 登录尝试过多，请 15 分钟后再试
- 该邮箱已注册

---

## 4. UserMenu（已登录全局）

位置：首页顶栏右侧、`/chat` `SubPageHeader.actions` 内。

```
┌──────────────────┐
│  [头像] 昵称 ▾   │  Dropdown
├──────────────────┤
│  账号设置         │  → /settings
│  今日配额 12/20   │  仅 chat，text-mf-muted text-xs
│  ─────────────   │
│  退出登录         │  danger text
└──────────────────┘
```

- 头像：有 `image` 用圆角图，无则 `UserOutlined` + `bg-mf-accent-soft`
- 昵称截断 `max-w-[120px] truncate`

---

## 5. AuthPromptCard（对话内引导）

当 API 返回 `429 QUOTA_EXCEEDED`：

```
┌─────────────────────────────────────┐
│ ⚠ 今日免费对话次数已用完              │
│ 登录后可获得更高额度，并保存对话记录。   │
│ [ 立即登录 ]  [ 注册 ]               │
└─────────────────────────────────────┘
```

- 容器：`rounded-xl border border-mf-border bg-mf-accent-soft/50 p-4`
- 按钮：主按钮登录，次按钮 outline 注册
- 可做成 A2UI `Alert` + `Button` Surface（与 P3 一致）

---

## 6. Settings 页 `/settings`（P1 简版）

布局：左侧 `SubPageHeader` + 主区 `max-w-lg` 卡片分组。

| 区块 | 内容 |
|------|------|
| 资料 | 昵称、头像 URL（或上传） |
| 账号 | 邮箱（只读）、修改密码链接 |
| 配额 | 今日对话/转换/文生图 进度条 Ant `Progress` |
| 危险区 | 退出所有设备（P2）、注销账号（P3） |

---

## 7. 响应式

| 断点 | 调整 |
|------|------|
| `< sm` | OAuth 按钮全宽；顶栏仅返回键 |
| `≥ md` | 卡片垂直居中 `flex items-center justify-center min-h-[calc(100dvh-56px)]` |

---

## 8. 反模式

- ❌ 全屏视频/3D 背景（影响性能与可读性）
- ❌ 微信绿、支付宝蓝作为主 CTA（保持 Studio Blue）
- ❌ 注册页强制手机号为唯一标识（首期不做）
- ❌ 登录弹窗 Modal 嵌套在工具页（独立路由利于 SEO 与回调）

---

## 9. 实现检查清单

- [ ] 使用 `mf-*` / Ant `ConfigProvider` 已有 token
- [ ] `cursor-pointer` + `transition` 200ms 于所有链接按钮
- [ ] 图标用 `@ant-design/icons`，不用 emoji
- [ ] `callbackUrl` 登录后回跳来源页
- [ ] 表单 `autoComplete`：`email` `current-password` `new-password`
