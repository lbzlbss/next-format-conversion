# MediaFlow AI 对话助手 · A2UI 落地设计文档

> **版本**：v0.5  
> **状态**：P0–P3 已落地  
> **关联页面**：`/chat`、悬浮窗 `AiChatAssistant`  
> **协议基准**：[A2UI v0.9](https://a2ui.org/)（声明式 Generative UI）  
> **最后更新**：2026-06-03

---

## 1. 背景与目标

### 1.1 现状

MediaFlow 对话助手已具备：

| 能力 | 实现位置 |
|------|----------|
| SSE 流式文本 / 思考链 | `src/app/api/chat/route.js` → `useChatStream.js` |
| Wiki RAG 引用 | `sources` 事件 → `WikiSources.jsx` |
| 站内工具调用 | `useChatComposer.js` → `chat-tools/registry.js` |
| 工具结果卡片 | `ToolResultCard.jsx`（硬编码 React） |
| 附件上传 | `ChatAttachmentBar.jsx` |
| 3D 数字人状态 | `useDigitalHumanState.js`（idle / thinking / speaking） |
| PDF 导出 | `ChatPdfButton.jsx` |

工具执行流程为：**客户端识别工具 → 调 API 转换 → 固定卡片展示 → 再调 LLM 解说**。UI 与工具类型强绑定，每新增工具需改 `ToolResultCard` 与相关 JSX。

### 1.2 引入 A2UI 的目标

1. **Agent 按场景生成 UI**：参数表单、结果卡、对比表、操作按钮由 JSON 描述，减少「一种工具一张卡片」的维护成本。  
2. **保持 MediaFlow 视觉一致**：由客户端 Catalog 映射到现有 Tailwind + Ant Design + Design Tokens（`design-system/mediaflow/MASTER.md`）。  
3. **安全可控**：仅渲染白名单组件，禁止 Agent 下发可执行代码。  
4. **渐进落地**：不推翻现有 `ToolResultCard`，分阶段共存。  
5. **与数字人联动**：用户操作 A2UI 表单时，数字人保持 `thinking`；流式解说时 `speaking`。

### 1.3 非目标（本期不做）

- 不引入完整 AG-UI / CopilotKit 替换现有聊天栈  
- 不在首期支持远程 A2A 子 Agent  
- 不做移动端独立 App（Flutter GenUI）  
- 不替换首页工具页的固定表单（仅对话场景）

---

## 2. 总体架构

### 2.1 分层图

```text
┌─────────────────────────────────────────────────────────────┐
│  UI 层（Client）                                             │
│  ChatPanel / AiChatAssistant                                 │
│    ├─ ChatMessageList（文本 + Wiki + ToolResultCard  legacy）│
│    ├─ A2uiSurfaceHost（新增：渲染 A2UI Surface）              │
│    ├─ DigitalHumanCanvas（状态联动）                          │
│    └─ ChatInputArea                                          │
├─────────────────────────────────────────────────────────────┤
│  状态层                                                      │
│  useChatStream（扩展 a2ui 事件）                              │
│  useA2uiSurfaces（新增：surface 状态机）                     │
│  useChatComposer / useDigitalHumanState                      │
├─────────────────────────────────────────────────────────────┤
│  渲染层                                                      │
│  src/app/lib/a2ui/catalog.mediaflow.json（组件白名单）        │
│  src/app/lib/a2ui/renderer/（A2UI JSON → React 映射）        │
├─────────────────────────────────────────────────────────────┤
│  协议层（SSE 扩展）                                           │
│  event: a2ui → createSurface | updateComponents | ...       │
├─────────────────────────────────────────────────────────────┤
│  Agent 层                                                    │
│  /api/chat/route.js（LLM 输出解析 + A2UI 校验）               │
│  可选：/api/chat/a2ui-tool（工具结果 → A2UI 模板）          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 与现有 SSE 事件的关系

当前事件（`useChatStream.consumeSseStream`）：

| event | payload | 用途 |
|-------|---------|------|
| `sources` | `{ items }` | Wiki 引用 |
| `thinking` | `{ content }` | 思考链 |
| `content` | `{ content }` | 正文流 |
| `error` | `{ error }` | 错误 |
| `done` | `{}` | 结束 |

**新增**：

| event | payload | 用途 |
|-------|---------|------|
| `a2ui` | A2UI v0.9 消息体（单条） | UI 结构 / 数据更新 |
| `a2ui_action` | （客户端 → 服务端，HTTP 二次请求或同一连接上行） | 用户点击、表单提交 |

首期采用 **SSE 下行 + HTTP POST 上行**（与现有 `/api/chat` 分离），避免改造 SSE 双向通道。

---

## 3. MediaFlow 组件 Catalog 设计

### 3.1 设计原则

- Catalog ID：`https://mediaflow.local/catalogs/chat/v1.json`（仓库内静态 JSON）  
- 仅包含对话场景需要的组件，映射到现有 UI 风格  
- 每个组件定义：`props schema` + `allowed actions` + `renderer` 组件名

### 3.2 首期 Catalog（P0）

| A2UI 组件 | 渲染为 | 典型场景 |
|-----------|--------|----------|
| `Text` | `<p>` / 标题 | 说明、步骤 |
| `Card` | `mf` 圆角卡片容器 | 工具结果外框 |
| `Button` | Ant Design `Button`（`mf-cta`） | 下载、重试、确认 |
| `Tag` | Ant Design `Tag` | 压缩率、状态 |
| `Image` | `<img>` + 预览 | 转换预览、文生图 |
| `Progress` | 进度条 | 工具执行中 |
| `Row` / `Column` | Flex 布局 | 多列对比 |
| `ToolResult` | **封装现有 `ToolResultCard` 数据模型** | 兼容 legacy |
| `DownloadLink` | 下载按钮 + 文件名 | 与 Blob URL 配合 |
| `ParamForm` | 质量 Slider、格式 Select 等 | 转换前确认参数 |

### 3.3 二期 Catalog（P1）

| 组件 | 场景 |
|------|------|
| `Table` | 多文件批量结果 |
| `Alert` | 错误 / 警告提示 |
| `Steps` | 分步引导（命理 / 工具教程） |
| `WikiRef` | 替代部分 `WikiSources` 内联展示 |
| `Divider` | 区块分割 |

### 3.4 Catalog 文件结构（拟新增）

```text
src/app/lib/a2ui/
├── catalogs/
│   └── mediaflow-chat-v1.json    # 组件 schema + 描述（给 LLM）
├── catalog-rules.txt             # 写入 system prompt 的生成规则
├── validator.js                  # JSON Schema 校验 + 自愈提示
├── types.js                      # JSDoc / 常量
├── surfaces-store.js             # 纯函数：apply A2UI message → state
└── renderer/
    ├── A2uiSurfaceHost.jsx       # Surface 容器
    ├── A2uiRenderer.jsx          # 递归渲染组件树
    └── components/
        ├── MfText.jsx
        ├── MfCard.jsx
        ├── MfButton.jsx
        ├── MfToolResult.jsx      # 桥接 ToolCall
        └── ...
```

---

## 4. 消息与数据模型

### 4.1 扩展后的 Message 结构

```typescript
/** 助手消息（扩展） */
interface AssistantMessage {
  id: string;
  role: 'assistant';
  content: string;                    // Markdown 文本（保留）
  thinking?: string;
  sources?: WikiSource[];
  toolCalls?: ToolCall[];             // legacy，逐步迁移
  /** 新增：A2UI surfaces */
  surfaces?: A2uiSurfaceState[];
}

interface A2uiSurfaceState {
  surfaceId: string;
  catalogId: string;
  components: A2uiComponent[];
  dataModel: Record<string, unknown>;
  rootId?: string;
}
```

### 4.2 流式态扩展（`useChatStream`）

```typescript
// 新增 state
streamingSurfaces: A2uiSurfaceState[];

// consumeSseStream 增加分支
if (eventType === 'a2ui') {
  applyA2uiMessage(streamingSurfaces, payload);
  setStreamingSurfaces([...]);
}
```

### 4.3 Data Model 约定（工具场景）

以 GIF→WebP 为例：

```json
{
  "/tool": {
    "toolId": "gif.convertToWebp",
    "status": "success",
    "fileName": "demo.gif",
    "beforeBytes": 2048000,
    "afterBytes": 512000,
    "downloadUrl": "https://...",
    "previewUrl": "https://..."
  },
  "/params": {
    "quality": 75,
    "effort": 4
  }
}
```

组件通过 `value: { "path": "/tool/beforeBytes" }` 绑定，而非在组件树里重复写死数值。

---

## 5. 核心流程设计

### 5.1 流程 A：工具结果 Generative UI（P0 首选）

与现有 `useChatComposer` 兼容，**工具仍由客户端执行**（大文件不走 LLM），仅将结果展示改为 A2UI。

```text
用户上传 GIF +「转成 webp 质量 75」
    │
    ▼
useChatComposer 识别 gif.convertToWebp
    │
    ├─ runChatFileTool() → ToolCall output（不变）
    │
    ├─ buildToolResultA2ui(toolCall)  【新增：确定性模板，非 LLM】
    │     → updateComponents + updateDataModel
    │
    ├─ streamingSurfaces 展示 A2uiSurfaceHost
    │
    └─ stream.sendMessage(..., apiUserContent) → LLM 文字解说（content 事件）
```

**要点**：P0 的 A2UI 由 **服务端/客户端模板函数** 生成，不依赖 LLM 输出合法 JSON，风险最低。

### 5.2 流程 B：参数确认表单（P1）

用户意图模糊时，Agent 先返回参数表单 Surface，用户点「开始转换」后再走流程 A。

```text
用户：「帮我把这个 gif 压一下」
    │
    ▼
LLM 输出 a2ui（ParamForm：quality / effort / speed）
    │
    ▼
用户调整 Slider → dataModel 更新（客户端）
    │
    ▼
用户点击 action: start_convert
    │
    ▼
POST /api/chat/action { surfaceId, action, dataModel }
    │
    ▼
服务端触发工具 / 返回新 a2ui + content 解说
```

### 5.3 流程 C：纯对话 Generative UI（P2）

命理「五行指引」、文生图「风格选择」等，由 LLM 直接生成 Card + Button + Text 组合。

需在 `buildSystemPrompt()` 注入 `catalog-rules.txt` + few-shot 示例；输出经 `validator.js` 校验，失败则 **fallback 纯 Markdown**。

### 5.4 数字人状态映射（扩展）

| 阶段 | `useDigitalHumanState` |
|------|------------------------|
| LLM 思考链 | `thinking` |
| 工具 API 执行 | `thinking`（`toolRunning`，已有） |
| A2UI 表单展示、等待用户点击 | `idle`（新增：`awaitingA2uiAction` 可选细分） |
| 流式正文 | `speaking` |
| 用户提交 A2UI action 后处理中 | `thinking` |

可选在 `useDigitalHumanState` 增加 `awaitingUserInput` 参数，避免「表单已出但仍是托腮」的违和感。

---

## 6. API 设计

### 6.1 扩展 `/api/chat` SSE 下行

`route.js` 在 `push` 辅助函数旁增加模板推送（P0 由服务端在工具链完成后注入；P2 由 LLM 流中解析）：

```javascript
// 示例：工具完成后服务端推送（P0 可由 BFF 层调用）
push("a2ui", {
  version: "v0.9",
  createSurface: {
    surfaceId: `tool-${toolCallId}`,
    catalogId: "/lib/a2ui/catalogs/mediaflow-chat-v1.json",
    sendDataModel: true,
  },
});
push("a2ui", {
  version: "v0.9",
  updateDataModel: { surfaceId, path: "/tool", value: { ... } },
});
push("a2ui", {
  version: "v0.9",
  updateComponents: { surfaceId, components: [ ... ] },
});
```

LLM 流式输出 A2UI（P2）：在 delta 解析层增加「结构化块检测」或改用 Ark `response_format` / tool call 通道输出 JSONL。

### 6.2 新增 `/api/chat/a2ui-action`（P1）

```typescript
// POST
{
  "surfaceId": "tool-xxx",
  "action": { "name": "start_convert", "payload": {} },
  "dataModel": { "/params": { "quality": 80 } },
  "session": { "messageId": "...", "toolId": "gif.convertToWebp" }
}

// Response：SSE 或 JSON
{ "ok": true, "toolCall": { ... }, "a2ui": [ ... ] }
```

鉴权：同源 Cookie / 现有站点策略；校验 `action.name` 在 Catalog 允许列表内。

### 6.3 System Prompt 增补（P2 草案）

在 `buildSystemPrompt()` 追加一节（长度需控制，可引用 wiki slug `a2ui-guide`）：

```text
【Generative UI】当需要表单、结果卡、对比表时，可输出 A2UI v0.9 JSON（event 由系统封装）。
仅可使用 Catalog 内组件：Text, Card, Button, Tag, Image, ParamForm, ToolResult。
禁止输出 HTML/JS。若无法生成合法 UI，改用 Markdown。
```

---

## 7. 前端组件改造点

### 7.1 文件级改动清单

| 文件 | 改动 |
|------|------|
| `useChatStream.js` | 解析 `a2ui` 事件；消息体增加 `surfaces` |
| `useChatComposer.js` | 工具成功后调用 `emitToolResultSurface()` |
| `ChatMessageList.jsx` | 助手气泡内渲染 `<A2uiSurfaceHost surfaces={...} />` |
| `ChatPanel.jsx` / `AiChatAssistant.jsx` | 透传 `streamingSurfaces` |
| `useDigitalHumanState.js` | 可选 `awaitingA2uiAction` |
| `route.js` | P2：LLM A2UI 解析与校验推送 |

### 7.2 UI 布局规则

- A2UI Surface 渲染在 **助手气泡内、正文上方或下方**（与 `ToolResultCard` 同位置）  
- 同一条消息允许多 Surface：`surfaceId` 区分（如 `params` + `result`）  
- `variant="page"` 与 `float` 共用 Renderer，宽度受 `max-w-3xl` 约束  
- 样式：Renderer 内只使用 `mf-*` Tailwind 类，禁止 Agent 指定任意 CSS

### 7.3 与 `ToolResultCard` 共存策略

| 阶段 | 策略 |
|------|------|
| P0 | 新工具结果走 A2UI；`ToolResultCard` 保留作 fallback |
| P1 | Feature flag `NEXT_PUBLIC_A2UI_ENABLED=1` 灰度 |
| P2 | 迁移全部工具；`ToolResultCard` 标记 `@deprecated` |
| P3 | 删除 `ToolResultCard`，仅保留 `MfToolResult` renderer |

---

## 8. 分阶段实施计划

### P0：模板化 A2UI（2–3 天，低风险）✅ 已完成

- [x] 新增 `src/app/lib/a2ui/` 骨架与 `mediaflow-chat-v1.json`  
- [x] 实现 `buildToolResultSurface(toolCall)` 纯函数模板  
- [x] `A2uiSurfaceHost` + 基础 renderer（Text/Card/Button/Tag/Image/Progress/DownloadLink）  
- [x] `useChatComposer` 工具成功后写入 `streamingSurfaces` / `runningSurfaces`  
- [x] `ChatMessageList` + 悬浮窗渲染；无 LLM 参与 UI 生成  
- [x] PDF 导出追加工具结果文字摘要（`generate-chat-pdf.js`）  
- [ ] 验收：GIF→WebP / 文生图 / MP4 压缩结果卡与现版一致或更美（部署后人工确认）

### P1：用户动作回传（3–5 天）✅ 已完成

- [x] `/api/chat/a2ui-action`（动作白名单校验）  
- [x] `ParamForm` + `Slider` / `Select` renderer  
- [x] 模糊意图 → 先表单 → 再执行工具（`shouldShowParamForm`）  
- [x] 数字人 `awaitingA2uiAction` → `idle`  
- [x] `NEXT_PUBLIC_A2UI_PARAM_FORM=0` 关闭参数表单

### P2：LLM 生成 A2UI（5–8 天）✅ 已完成

- [x] `catalog-rules.txt` + 辅助非流式 Ark 请求  
- [x] `validator.js` + 命理 fallback 卡片  
- [x] `route.js` 推送 SSE `a2ui` 事件；`useChatStream` 消费  
- [x] 命理摘要卡 + 教程 `Steps` 试点（`A2UI_LLM_ENABLED=1` 开启）

### P3：生态扩展 ✅ 已完成

- [x] Wiki 引用统一为 `WikiRef` A2UI Surface（`buildWikiSourcesSurface`）  
- [x] `float` 布局过滤宽组件（`Table` 等，`filterSurfaceForVariant`）  
- [x] 新增 `Divider` / `Alert` / `Table` renderer  
- [ ] A2A 远程 Agent UI（待业务需求明确后再接）

---

## 9. 安全与合规

| 风险 | 对策 |
|------|------|
| UI 注入 | 仅 Catalog 白名单；`validator` 拒绝未知 `component` |
| XSS | 不渲染 Agent 提供的 HTML；`Text` 走 React 文本节点 |
| 恶意 URL | `Image`/`DownloadLink` 仅允许 `https:` + 同源 Blob 路径 |
| 大 JSON | 单消息 A2UI 组件数上限（如 50）；超则截断并 fallback |
| 幻觉组件 | LLM 生成必经校验；P0 模板不经 LLM |

---

## 10. 测试与验收

### 10.1 自动化

```text
tests/a2ui/
├── validator.test.js       # 非法 JSON、未知组件
├── surfaces-store.test.js  # message 累积
└── tool-result-surface.test.js  # 与 ToolCall fixture 对齐
```

### 10.2 手工验收（P0）

- [ ] `/chat` 页：GIF→WebP 结果卡由 A2UI 渲染，下载可用  
- [ ] 悬浮窗：同上，窄屏不破版  
- [ ] 流式解说与 Surface 同时出现，暂停后状态正确  
- [ ] 数字人：工具中 thinking → 解说 speaking  
- [ ] `NEXT_PUBLIC_A2UI_ENABLED=0` 回退 `ToolResultCard`  
- [ ] Lighthouse：对话页 LCP 无明显劣化（Renderer 懒加载）

---

## 11. 依赖与配置

### 11.1 npm 依赖（P0 可零依赖）

首期 **不强制** 引入 `@a2ui/react`（避免与 Ant Design 6 / Tailwind v4 样式冲突），自研薄 Renderer。

P2 可评估：

```bash
pnpm add @a2ui/web_core   # 仅类型与校验工具，可选
```

### 11.2 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_A2UI_ENABLED` | `0` | 灰度开关 |
| `A2UI_MAX_COMPONENTS` | `50` | 单 Surface 组件上限 |
| `A2UI_LLM_ENABLED` | `0` | P2：允许 LLM 生成 UI |

---

## 12. 风险与回滚

| 风险 | 缓解 |
|------|------|
| LLM 输出不稳定 | P0/P1 不用 LLM 生成；P2 强校验 + Markdown fallback |
| 包体积增加 | Renderer 动态 `import()`；Catalog JSON 按需加载 |
| 与 PDF 导出冲突 | PDF 仍导出 `content` 纯文本；Surface 截图二期再做 |
| 开发周期拉长 | 严格分 P0/P1，P0 可独立上线 |

**回滚**：`NEXT_PUBLIC_A2UI_ENABLED=0` 即恢复 `ToolResultCard`，无需数据迁移。

---

## 13. 附录

### A. P0 工具结果 A2UI 示例（模板输出）

```json
{
  "version": "v0.9",
  "updateComponents": {
    "surfaceId": "tool-result",
    "components": [
      { "id": "card", "component": "Card", "child": "body" },
      { "id": "title", "component": "Text", "text": "GIF 转 WebP 已完成", "variant": "h4" },
      { "id": "tag", "component": "Tag", "text": "约减小 75%", "color": "green" },
      { "id": "preview", "component": "Image", "src": { "path": "/tool/previewUrl" } },
      { "id": "dl", "component": "DownloadLink", "url": { "path": "/tool/downloadUrl" }, "fileName": { "path": "/tool/fileName" } }
    ]
  }
}
```

### B. 相关文档

- [数字人技术规格](../digital-human/tech-spec.md)  
- [Vercel 部署方案](../articles/vercel-deploy-fullstack-juejin.md)  
- 外部概念：[A2UI 官方](https://a2ui.org/introduction/what-is-a2ui/)  
- 外部：[A2UI 官方](https://a2ui.org/) · [ADK 集成](https://adk.wiki/integrations/a2ui/)

### C. 评审待决问题（已定案 v0.1.1）

#### 问题 1：P0 模板生成放客户端还是服务端？

**结论：P0 放客户端；P1 起采用「客户端为主、服务端可复用」双端共享纯函数。**

| 维度 | 客户端（P0 采用） | 服务端 |
|------|-------------------|--------|
| 与现状契合度 | 工具已在 `useChatComposer` 内执行，`ToolCall` 对象就在客户端 | 需改造 `/api/chat`，工具结果要先上报 |
| 改造量 | 仅 `useChatComposer` + `ChatMessageList` | SSE 协议、会话状态、鉴权都要动 |
| 展示时序 | 转换完成即可渲染 Surface，无需等 LLM 流 | 多一跳网络，卡片晚于工具完成出现 |
| 可测试性 | `buildToolResultSurface(toolCall)` 纯函数单测 | 需集成测 SSE |

**实施方案：**

```text
src/app/lib/a2ui/build-tool-result-surface.js   # 纯函数，双端可 import
         │
         ├─ P0：useChatComposer 工具 success 后调用 → streamingSurfaces
         └─ P1：/api/chat/a2ui-action 服务端同样 import，返回 a2ui 数组
```

不在 P0 改 `route.js`。LLM 解说仍走现有 `content` SSE，与 Surface 展示并行。

---

#### 问题 2：悬浮窗是否首期同步 A2UI？

**结论：同期上线，共用一套 Renderer；用 `variant` 做布局差异，不做两套 UI 代码。**

理由：

- `AiChatAssistant` 与 `ChatPanel` 已共用 `ChatMessageList`、`useChatComposer`、`ToolResultCard`
- 分叉实现会导致「全页有 A2UI、悬浮窗仍是旧卡片」的体验不一致
- 悬浮窗宽度更窄，但 P0 组件（Card / Image / Button）在 `max-w-[85%]` 下可接受

**实施方案：**

```jsx
<A2uiSurfaceHost surfaces={surfaces} variant={variant} />  // 'page' | 'float'
```

| variant | 布局约束 |
|---------|----------|
| `page` | `max-w-[min(85%,720px)]`，预览图 `max-h-48` |
| `float` | `max-w-full`，预览图 `max-h-32`，ParamForm 单列 |

灰度开关 `NEXT_PUBLIC_A2UI_ENABLED` **全局生效**（全页 + 悬浮窗同时开/关）。

**验收优先级**：先测 `/chat` 全页，再测悬浮窗窄屏；不阻塞 P0 合并，但同一 PR 内完成。

---

#### 问题 3：LLM 生成 UI 是否走独立模型 / JSON mode？

**结论：不引入独立模型；主对话保持现有 Ark 流式；UI 生成用「辅助结构化子请求」+ 校验 fallback。**

不推荐的做法：

- 在主 `content` 流里混排 Markdown + A2UI JSON（解析脆弱、暂停/重试难处理）
- 为 UI 单独采购/切换模型（成本与运维复杂度上升）

**推荐架构（P2）：**

```text
用户消息
    │
    ▼
route.js 意图判定（需 UI？）
    │
    ├─ 否 → 现有流式 content（不变）
    │
    └─ 是 → ① 辅助请求（同 ARK_CHAT_MODEL，非流式，短 prompt + catalog-rules）
              → validator.js 校验
              → 失败则跳过 ②，直接流式 Markdown
           ② 主流式 content 解说（与 today 相同）
           ① 成功后 push event:a2ui（在 content 开始前或并行）
```

| 项 | 决策 |
|----|------|
| 模型 | 与主对话相同 `ARK_CHAT_MODEL`，不新增模型配置 |
| 调用方式 | 独立 `fetch` Ark **非流式**，`max_tokens` 限制 2k，仅输出 A2UI JSON 数组 |
| 触发条件 | `A2UI_LLM_ENABLED=1` 且规则命中（命理三段式、教程 Steps、无文件的参数咨询） |
| 工具类 UI | **永不走 LLM**，继续 `buildToolResultSurface` 模板 |
| 失败策略 | 校验失败 → 仅 Markdown，不阻断对话 |

环境变量：

```bash
A2UI_LLM_ENABLED=0          # 默认关，P2 再开
A2UI_LLM_MAX_TOKENS=2048
```

---

#### 问题 4：PDF 导出是否包含 Surface 快照？

**结论：P0/P1 不做快照；导出「结构化文字摘要」；P3 再评估截图/富文本 PDF。**

| 阶段 | PDF 行为 |
|------|----------|
| P0/P1 | 沿用现有 `content` 正文；若消息含 `surfaces`，追加 **附录文字块**（工具名、文件名、体积变化、下载链接纯文本） |
| P2 | 命理 A2UI 中的【卦象简评】等若已在 `dataModel`，映射为固定 Markdown 段落写入 PDF |
| P3（可选） | 服务端 `html-to-pdf` 或 headless 截图；仅在有明确需求时做 |

**不做的原因：**

- Vercel Serverless 不适合跑 Puppeteer 截图
- Surface 含图片/预览，PDF 体积与生成耗时会显著上升
- 用户核心诉求是「留档对话与结论」，文字摘要足够

**P1 实现要点（`generate-chat-pdf.js`）：**

```javascript
function surfaceToPdfLines(surface) {
  const t = surface.dataModel?.['/tool'];
  if (!t) return [];
  return [
    `[工具] ${t.toolId}`,
    t.fileName ? `文件: ${t.fileName}` : null,
    t.beforeBytes && t.afterBytes
      ? `体积: ${formatBytes(t.beforeBytes)} → ${formatBytes(t.afterBytes)}` : null,
    t.downloadUrl ? `下载: ${t.downloadUrl}` : null,
  ].filter(Boolean);
}
```

---

**文档维护**：实现 P0 后更新状态为 v0.2，并补充实际文件路径与截图验收记录。
