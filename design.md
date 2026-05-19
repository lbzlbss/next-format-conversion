# MediaFlow 设计规范

> 基于 [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) 生成并落地。  
> 机器可读主文件：`design-system/mediaflow/MASTER.md`  
> Cursor Skill：`.cursor/skills/ui-ux-pro-max/`

---

## 1. 产品定位

| 项 | 说明 |
|---|---|
| 产品 | MediaFlow — 浏览器端多媒体格式转换工具台 |
| 类型 | Developer Tool / 效率工具 Dashboard |
| 模式 | 深色侧栏 + 浅色工作区（双区布局） |
| 技术栈 | Next.js 16 · React 19 · Ant Design 6 · Tailwind CSS 4 |

---

## 2. 设计原则

1. **工具优先**：主区域留给上传、预览、转换，减少装饰性干扰。
2. **状态清晰**：当前工具、参数面板、进行中的任务一眼可辨。
3. **开发者气质**：Fira Sans 正文 + Fira Code 标题/标签，绿色强调「运行/执行」。
4. **可访问**：对比度 ≥ 4.5:1，可见 focus，尊重 `prefers-reduced-motion`。
5. **禁止 AI 紫粉渐变**：不使用典型「AI 产品」紫粉渐变作为主视觉。

---

## 3. 色彩系统

| Token | CSS 变量 | 值 | 用途 |
|-------|----------|-----|------|
| 侧栏背景 | `--mf-bg-sidebar` | `#0F172A` | 导航、品牌区 |
| 画布背景 | `--mf-bg-canvas` | `#F1F5F9` | 页面底色 |
| 表面 | `--mf-surface` | `#FFFFFF` | 卡片、顶栏 |
| 主色 | `--mf-primary` | `#1E293B` | 标题、强调文字 |
| CTA | `--mf-cta` | `#2563EB` | 主按钮、激活态、徽章（Studio Blue） |
| CTA Hover | `--mf-cta-hover` | `#1D4ED8` | 悬停 |
| 正文 | `--mf-text` | `#0F172A` | 主内容 |
| 弱化 | `--mf-text-muted` | `#64748B` | 说明、占位 |
| 侧栏字 | `--mf-text-sidebar` | `#94A3B8` | 导航未选中 |
| 边框 | `--mf-border` | `#E2E8F0` | 卡片、分割 |
| 提示底 | `--mf-accent-soft` | `#DBEAFE` | 提示块背景 |
| 提示字 | `--mf-accent-soft-fg` | `#1E40AF` | 提示块文字 |
| 侧栏字 | `--mf-text-sidebar` | `#E2E8F0` | 深色侧栏主文字 |

Tailwind 映射：`bg-mf-canvas`、`text-mf-text`、`border-mf-border`、`bg-mf-cta` 等（见 `globals.css` @theme）。

---

## 4. 字体

```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

| 层级 | 字体 | 用途 |
|------|------|------|
| 标题 / 工具名 | Fira Code | 页面标题、Logo 旁产品名 |
| 正文 | Fira Sans | 说明、表单、按钮 |

---

## 5. 布局结构

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (288px, dark)  │  Header (sticky, white)      │
│  - Logo                 │  - 标题 + 搜索 + 操作        │
│  - 工具导航              ├──────────────────────────────┤
│  - AI 助手入口           │  Tool Canvas    │ Settings │
│  - 底部信息（可选）       │  (主内容卡片)    │ (360px)  │
└─────────────────────────────────────────────────────────┘
```

- **断点**：`md` 及以上显示侧栏；小屏顶栏使用工具 `Select` 切换。
- **间距**：区块 `gap-8`，卡片内 `p-4 md:p-6`，圆角 `16px`（`--mf-radius-lg`）。

---

## 6. 组件规范

### 按钮

- 主操作：Ant Design `type="primary"`（已映射 `--mf-cta`）
- 所有可点击元素：`cursor-pointer`，过渡 `200ms`
- 禁止仅用颜色区分状态，需配合字重/边框

### 卡片 `.mf-card`

- 白底、细边框、轻阴影
- 可选 `.mf-card-hover`：悬停时边框带绿色透明、阴影加深

### 提示 `.mf-tip`

- 浅绿底 + 深绿字，用于参数说明、Wiki 链接区

### 侧栏导航 `.mf-sidebar-nav-btn`

- 默认字色 `--mf-text-sidebar`（`#E2E8F0`）
- 当前项 `.is-active`：蓝色半透明底 + 左侧 3px 品牌条

### 子页面顶栏

- 使用 `SubPageHeader`（`/chat`、`/wiki`）
- 返回、标题、右侧操作区对齐 `max-w-5xl`

---

## 7. 页面清单

| 路由 | 说明 | 页面级覆盖 |
|------|------|------------|
| `/` | 工具台主页 | 默认 MASTER |
| `/chat` | AI 对话 | 见 `design-system/mediaflow/pages/chat.md`（待补充） |
| `/wiki` | 知识库索引 | 见 `design-system/mediaflow/pages/wiki.md`（待补充） |
| `/wiki/[slug]` | 文档详情 | 同 wiki |

构建页面时：**先读** `design-system/mediaflow/pages/<page>.md`，无则 **仅用** `MASTER.md`。

---

## 8. 反模式（禁止）

- ❌ Emoji 充当图标（用 Ant Design Icons / SVG）
- ❌ 无 `cursor-pointer` 的可点击 div
- ❌ 悬停 scale 导致布局抖动
- ❌ 正文对比度不足
- ❌ 无 focus 样式
- ❌ 典型 AI 紫粉大面积渐变
- ❌ 纯装饰性假数据模块干扰主流程（如云存储占位可逐步移除）

---

## 9. 交付前检查清单

- [ ] 响应式：375 / 768 / 1024 / 1440
- [ ] 键盘 Tab 可遍历主要操作
- [ ] `prefers-reduced-motion` 已处理
- [ ] 图标风格统一（Ant Design Icons）
- [ ] 与 `design-system/mediaflow/MASTER.md` 一致

---

## 10. 维护命令

```bash
# 重新生成设计系统（修改产品描述后）
python3 .cursor/skills/ui-ux-pro-max/scripts/search.py \
  "media format conversion developer tool SaaS dashboard" \
  --design-system --persist -p "MediaFlow" -f markdown --stack nextjs

# 更新 Skill（可选）
npx uipro-cli update
```

---

**版本**：1.0 · 2026-05-19 · 生成工具：ui-ux-pro-max-skill v2.x
