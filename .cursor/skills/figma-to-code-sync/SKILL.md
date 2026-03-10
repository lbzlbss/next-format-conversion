---
name: figma-to-code-sync
description: Sync Figma designs to code by reading layout + design tokens via Figma MCP first, then mapping to Tailwind v4 + CSS variables and updating Next.js components. Use when the user mentions Figma, design稿, 设计规范, design tokens, 颜色/圆角/间距对齐, 或“按设计稿还原 UI”.
---

# Figma → Code Sync（MCP 优先）

## 适用范围

- **目标**：把 Figma 的视觉与布局参数（颜色、圆角、阴影、间距、字号、组件结构）同步到代码，实现 1:1 对齐。
- **优先级**：涉及 UI 改动时，**先读 Figma（MCP）**，再改代码；MCP 不可用时再走降级路径（导出/截图/手动录入）。
- **项目假设（本仓库 Next）**：
  - Tailwind v4 通过 `@import "tailwindcss";`（见 `src/app/globals.css`）
  - Token 更推荐落到 **CSS 变量** / `@theme inline`，再用 Tailwind/样式引用。

## 快速开始（工作流）

### 0) 明确同步目标（必须产出一份映射表）

把需求收敛成下面这份“同步清单”，后续步骤都以它为准：

```markdown
## Figma 同步清单
- 页面/组件：<name>
- Figma 来源：<fileKey + nodeId 或链接>
- 需要对齐：
  - [ ] 颜色（背景/文字/边框/状态色）
  - [ ] 字体（字号/行高/字重/字距）
  - [ ] 间距（padding/margin/gap）
  - [ ] 圆角
  - [ ] 阴影
  - [ ] 布局（flex/grid/对齐/断点）
  - [ ] 交互态（hover/active/disabled/loading）
- 产物位置：
  - tokens：`src/app/globals.css`（CSS vars / `@theme inline`）
  - 组件：`src/app/**` 或 `src/components/**`
```

### 1) 先读 Figma（MCP）

1. **先检查 MCP 是否可用**：若 MCP 报错/无权限，记录原因并进入“降级路径”。
2. **拿到节点信息**（最少要拿到以下信息）：
   - **Frame/Component 的尺寸与 Auto Layout**：direction、padding、itemSpacing、alignment
   - **颜色**：fills/strokes（包含 opacity）
   - **圆角**：cornerRadius（含单角）
   - **阴影**：effects（drop shadow / inner shadow）
   - **文字**：fontFamily、fontSize、fontWeight、lineHeight、letterSpacing
3. **把结果整理成结构化 token**（建议 JSON 结构，便于落地）：

```json
{
  "colors": {
    "bg": "#ffffff",
    "fg": "#171717",
    "primary": "#1677ff"
  },
  "radii": { "sm": 6, "md": 10 },
  "space": { "2": 8, "3": 12, "4": 16 },
  "shadow": {
    "card": "0 8px 24px rgba(0,0,0,0.08)"
  },
  "typography": {
    "body": { "size": 14, "lineHeight": 22, "weight": 400 }
  }
}
```

> 关键点：**不要凭感觉补值**。Figma 读不到就标注 unknown，并在降级路径补齐。

### 2) Token 落地（Tailwind v4 友好）

**默认策略**：优先把 token 写成 CSS 变量，再在组件中使用（Tailwind class + `var(--token)`）。

- 将颜色/圆角/阴影等落到 `src/app/globals.css`：
  - `:root` 写基础变量
  - 如项目使用 `@theme inline`，同步更新对应 `--color-*` 等变量
- 对暗色模式：若 Figma 有 dark theme，保持变量命名一致，只在 `prefers-color-scheme: dark` 或主题切换时覆写值。

### 3) 组件结构同步

1. **先确定组件边界**：哪些是可复用组件（Button/Card/Modal），哪些是页面局部结构。
2. **布局优先对齐**：flex/grid、gap、padding、对齐方式先做对；再处理字体与颜色；最后处理阴影/细节。
3. **交互态**：把 hover/active/disabled 从 Figma 读到的颜色/opacity/阴影变化落到 class 或状态样式。

### 4) 校验（必须做）

- **像素级对比**：至少核对尺寸、间距、字体三件套（字号/行高/字重）与主色/背景色。
- **回归检查**：检查暗色模式与响应式断点是否与 Figma 预期一致。

## 降级路径（当 MCP 不可用/读不到关键参数）

按优先级从上到下选择：

1. **Figma 导出**：让用户导出 token（Variables/Styles）或提供节点的 Inspect 面板截图（颜色/字号/间距/圆角/阴影）。
2. **最小可用对齐**：先把布局与字号/间距对齐，颜色用占位 token（如 `--color-primary`），待补齐后再替换真实值。
3. **明确标注缺口**：输出一份缺失项清单（哪些值需要补：primary 色值、shadow 参数等）。

## 输出规范（你必须这样回复用户）

交付时按下面结构输出，避免“改了啥不知道”：

```markdown
## Summary
- 同步了哪些 Figma 节点/组件
- 新增/更新了哪些 tokens（变量名与含义）
- 哪些地方用了 Tailwind class，哪些用了 CSS vars

## Mapping（Figma → Code）
- colors:
  - <figmaName> → `--color-xxx` → 使用位置
- space/radius/shadow/typography: ...

## Notes / Gaps
- MCP 不可用或读不到的字段（及补齐方式）
```

