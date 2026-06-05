# MediaFlow 数字人需求技术文档

> 版本：v1.0  
> 页面：`/chat`  
> 生产环境：https://nextformat.aiblank.top/chat  
> 最后更新：2026-06-03

---

## 1. 背景与目标

在 AI 对话助手全页 `/chat` 左侧嵌入 **3D VRM 数字人**，作为 MediaFlow 助手的视觉化身。数字人需随对话流状态实时切换动作与表情，增强「正在思考 / 正在回复」的感知，并与右侧聊天区形成左右分栏布局。

**核心目标：**

| 目标 | 说明 |
|------|------|
| 状态联动 | 数字人动作与 AI 对话状态（待机 / 思考 / 说话）同步 |
| 自然动作 | 待机垂臂、思考托腮、说话手势 + 点头 |
| 平滑过渡 | 状态切换约 0.5s 四元数插值，避免动作跳变 |
| 布局对齐 | 左侧数字人与右侧对话区等高，输入框贴底 |
| 容错降级 | WebGL / 模型加载失败时回退 2D 占位 |
| 可替换模型 | 支持通过环境变量切换 VRM 文件 |

---

## 2. 功能需求

### 2.1 展示范围

- **仅 `/chat` 全页模式**（`ChatPanel variant="page"`）展示数字人
- **lg 及以上断点**显示左侧栏（`≥1024px`），移动端隐藏
- 左侧栏宽度：`min(36vw, 340px)`
- 底部状态条显示：`MediaFlow 助手 · 待机 / 思考中 / 回复中`

### 2.2 三种动画状态

| 状态 | 触发条件 | 姿势 | 表情 |
|------|----------|------|------|
| `idle` | 无流式输出、无工具运行 | 双臂自然下垂，微呼吸 + 轻微摆头 | relaxed + happy，周期性眨眼 |
| `thinking` | `busy` / `toolRunning` / `streamingThinking` | 左手托腮 + 右臂抱胸，微低头 | relaxed + lookUp，关闭 lookAt |
| `speaking` | `streamingContent` 有内容 | 双臂抬至腰前，手势摆动 + 点头 | relaxed，口型 `Aa` 随正弦波开合 |

### 2.3 状态优先级

```
thinking > speaking > idle
```

映射逻辑见 `src/app/hooks/useDigitalHumanState.js`：

```javascript
if (busy || toolRunning || streamingThinking) return 'thinking';
if (streamingContent) return 'speaking';
return 'idle';
```

### 2.4 关联能力（非数字人本体，但影响状态）

- **流式暂停**：`useChatStream.stopStreaming()` 通过 `AbortController` 中断 SSE，暂停后状态回到 `idle`
- **工具调用**：站内工具（如 GIF→WebP）执行期间保持 `thinking`

---

## 3. 技术架构

### 3.1 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 16 App Router（Client Component） |
| 3D 渲染 | Three.js `0.184` + `@pixiv/three-vrm` `3.5.3` |
| 模型格式 | VRM 1.0（默认 `media-s.vrm`，VRoid Hub 导出） |
| 样式 | Tailwind CSS v4 + MediaFlow Design Tokens |

### 3.2 模块分层

```text
/chat/page.jsx
  └─ ChatPanel.jsx
       ├─ useDigitalHumanState ← useChatStream / useChatComposer
       └─ DigitalHumanStage.jsx
            ├─ DigitalHumanViewport → DigitalHumanCanvas.jsx
            │                              ├─ vrm-pose-engine.js
            │                              └─ public/avatars/media-s.vrm
            └─ DigitalHumanStatusBar
                 └─ (失败) Avatar2DFallback.jsx

scripts/calibrate-vrm-poses.mjs  → FK 标定 → vrm-pose-engine.js
```

### 3.3 文件结构

```text
src/app/
├── chat/page.jsx
├── components/
│   ├── chat/ChatPanel.jsx
│   └── digital-human/
│       ├── DigitalHumanCanvas.jsx
│       ├── DigitalHumanStage.jsx
│       └── Avatar2DFallback.jsx
├── hooks/
│   └── useDigitalHumanState.js
└── lib/digital-human/
    ├── constants.js
    └── vrm-pose-engine.js

public/avatars/
├── media-s.vrm
└── README.md

scripts/calibrate-vrm-poses.mjs
```

---

## 4. 渲染管线

### 4.1 初始化流程

1. 创建 Scene / PerspectiveCamera(FOV 36°) / WebGLRenderer
2. 注册 `VRMLoaderPlugin`，加载 VRM
3. VRM 0.x 模型执行 `VRMUtils.rotateVRM0()`
4. 实例化 `AvatarPoseController`，**先吸附到 idle 姿势**
5. 调用 `frameVrmFullBody()` 取景（避免 T-pose 宽包围盒）
6. 配置 `lookAt.target = camera.position`
7. 启动 `requestAnimationFrame` 主循环

### 4.2 每帧更新

```text
poseCtrl.update(state, t, delta)     → 骨骼四元数 slerp
applyExpressions(vrm, state, ...)    → BlendShape 过渡
vrm.update(delta)                    → VRM 内部更新
renderer.render(scene, camera)
```

### 4.3 Hydration 处理

`ChatPanel` 用 `avatarReady`（`useEffect` 后置 `true`）延迟挂载数字人，避免 SSR/CSR 子树不一致导致 Hydration 警告。

---

## 5. 姿势系统

### 5.1 设计原则

- **直接驱动 normalized 骨骼欧拉角**，不走 `getNormalizedPose → setNormalizedPose` 往返（旧方案会导致 T-pose 残留）
- 每帧对目标四元数做 `slerp`，过渡时间常数 `TRANSITION_SEC = 0.5s`
- 基础姿势 + 程序化微动（呼吸、点头、手势）叠加

### 5.2 骨骼轴语义（media-s.vrm 标定）

对 `@pixiv/three-vrm` 的 normalized humanoid：

| 轴 | 左臂语义 | 右臂语义 |
|----|----------|----------|
| `x` | 拧转（位置几乎不变） | 同左 |
| `y` | 前后摆（+y 向后） | 前后摆（+y 向前，镜像） |
| `z` | 抬/落（+z 抬起） | 抬/落（+z 降低，镜像） |

> **关键教训**：早期误用 `x` 轴驱动抬臂，实际只产生拧转，人物保持 T-pose。

### 5.3 标定姿势（当前生产值）

**待机 `HANG_EULER`**

```javascript
leftUpperArm:  { z: -1.18, y: -0.08 }
leftLowerArm:  { z:  0.12, y:  0.1  }
rightUpperArm: { z:  1.18, y:  0.08 }
rightLowerArm: { z: -0.12, y: -0.1  }
```

**思考 `THINKING_EULER`**（FK 网格搜索，手-头距 ≈ 0.126）

```javascript
leftUpperArm:  { z: -0.49, y: -1.1,  x: 0.12 }
leftLowerArm:  { z:  2.89, y:  0.31 }
leftHand:      { z:  0.18 }
rightUpperArm: { z:  0.87, y:  0.84 }
rightLowerArm: { z:  0.42, y:  1.74 }
rightHand:     { z:  0.1  }
neck:          { x:  0.08, z: -0.05 }
head:          { x:  0.05, z:  0.04 }
```

**说话 `SPEAKING_EULER`**

```javascript
leftUpperArm:  { z: -0.98, y: -0.2 }
leftLowerArm:  { z:  0.7  }
rightUpperArm: { z:  0.98, y:  0.2 }
rightLowerArm: { z: -0.7  }
```

### 5.4 程序化微动

| 状态 | 叠加内容 |
|------|----------|
| idle | 脊柱/胸腔呼吸 sin 波；头部左右微摆；上臂 z 轴轻摆 |
| thinking | 头部/脊柱/左前臂微幅 sin 波 |
| speaking | 双臂 y/z 手势波；头颈 nod 点头 |

### 5.5 标定工具

```bash
# 探针：rest pose 坐标 + 单轴旋转效果
node scripts/calibrate-vrm-poses.mjs probe

# 网格搜索托腮 + 抱胸
node scripts/calibrate-vrm-poses.mjs search

# 验证指定欧拉角组合
node scripts/calibrate-vrm-poses.mjs thinking '{"leftUpperArm":{"z":-0.49,...}}'
```

换模型后**必须重新标定**，不同 VRM 的 normalized 轴语义可能不同。

---

## 6. 表情系统

通过 VRM `expressionManager` BlendShape 驱动：

| 状态 | relaxed | happy | lookUp | aa | blink |
|------|---------|-------|--------|-----|-------|
| idle | 0.45 | 0.08 | 0 | 0 | 周期性 |
| thinking | 0.45 | 0 | 0.25 | 0 | 0 |
| speaking | 0.2 | 0 | 0 | 动态 | 0 |

- 状态间表情过渡：0.45s smoothstep 插值
- speaking 口型：`0.2 + 0.45 * |sin(t * 9)|`
- thinking 时 `lookAt.autoUpdate = false`，避免眼球干扰托腮姿态

---

## 7. 相机与取景

`frameVrmFullBody(vrm, camera, aspect)`：

1. 模型脚底对齐 `y = 0`，水平居中
2. 计算包围盒，按 FOV + 宽高比确定相机距离（margin = 1.08）
3. **镜头中心上移至「头顶下方半个视高」**，减少顶部空白
4. 相机 Z 方向由 `AVATAR_CAMERA_Z_SIGN` 控制（VRoid 模型朝 -Z）

容器 `ResizeObserver` 触发时重新取景。

---

## 8. 页面布局

### 8.1 高度链

```text
/chat page:     h-[100dvh] overflow-hidden
  └ main:       flex-1 min-h-0 overflow-hidden
      └ ChatPanel: h-full overflow-hidden
          ├ aside (数字人): h-full flex-col
          │   ├ Viewport: flex-1 min-h-0
          │   └ StatusBar: shrink-0
          └ section (对话): h-full flex-col overflow-hidden
              ├ 消息列表: flex-1 min-h-0 overflow-y-auto
              └ 输入区: shrink-0 border-t
```

### 8.2 响应式

| 断点 | 数字人 | 对话区 |
|------|--------|--------|
| `< lg` | 隐藏 | 全宽 |
| `≥ lg` | 左侧 340px | 右侧 flex-1 |

---

## 9. 配置项

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `NEXT_PUBLIC_AVATAR_VRM_URL` | `/avatars/media-s.vrm` | VRM 模型路径 |
| `NEXT_PUBLIC_AVATAR_CAMERA_Z_SIGN` | `1` | 相机 Z 方向；模型背面时设为 `-1` |

`.env.local` 示例：

```bash
NEXT_PUBLIC_AVATAR_VRM_URL=/avatars/your-model.vrm
NEXT_PUBLIC_AVATAR_CAMERA_Z_SIGN=1
```

---

## 10. 降级与容错

| 场景 | 行为 |
|------|------|
| VRM 加载失败 | 切换 `Avatar2DFallback`（emoji + 状态文字 + CSS 动画） |
| WebGL 不可用 | 同上 |
| 加载中 | 「加载数字人…」占位 |
| SSR | 数字人仅客户端挂载，服务端渲染占位 aside |

---

## 11. 性能考量

| 项 | 策略 |
|----|------|
| 模型体积 | `media-s.vrm` ≈ 17MB，首次加载较慢；建议 CDN 缓存 |
| 像素比 | `Math.min(devicePixelRatio, 1.5)` 上限 |
| 渲染 | 单 Canvas RAF 循环，无 React 重渲染参与 Three.js |
| 内存 | 组件卸载时 `vrm.dispose()` + `renderer.dispose()` |
| Bundle | Three/VRM 仅在 Client Component 内加载 |

---

## 12. 部署

- **Commit**：`98f8240` — `feat: /chat 接入 VRM 数字人，支持托腮思考与流式暂停`
- **平台**：Vercel Production，push `master` 自动部署
- **域名**：https://nextformat.aiblank.top
- **静态资源**：`public/avatars/media-s.vrm` 随构建发布

---

## 13. 验收清单

- [ ] `/chat` lg+ 宽度：左侧数字人 + 右侧对话等高，输入框贴底
- [ ] 首次进入：数字人从「加载中」→ idle 垂臂
- [ ] 发送消息 → thinking：左手托腮、右臂抱胸、微低头
- [ ] 流式回复 → speaking：口型开合 + 手势 + 点头
- [ ] 点击「暂停」→ 回到 idle
- [ ] 状态切换平滑（~0.5s），无 T-pose 跳变
- [ ] 顶部空白可控，人物头部贴近视口上沿
- [ ] 模型加载失败时显示 2D 占位

---

## 14. 已知限制与后续方向

| 限制 | 说明 |
|------|------|
| 姿势绑定单模型 | 欧拉角针对 `media-s.vrm` 标定，换模型需重跑标定脚本 |
| 无 SpringBone 物理调参 | 头发/裙摆依赖 VRM 内置 SpringBone |
| 无 TTS 口型同步 | 口型为正弦波模拟，未接真实音频 viseme |
| 移动端无数字人 | 小屏隐藏左侧栏，仅保留对话 |
| 悬浮窗模式 | `AiChatAssistant` 右下角弹窗不含数字人 |

**可选演进：**

1. 模型 CDN 分离 + 懒加载 / 进度条
2. 多模型预设与姿势 JSON 配置化
3. 接入 TTS 驱动 viseme 口型
4. 移动端简化版 2.5D / 半身数字人
5. 标定脚本 GUI 化，支持实时调参预览

---

## 15. 关键 API 速查

```typescript
type AvatarAnimState = 'idle' | 'thinking' | 'speaking';

useDigitalHumanState({ busy, toolRunning, streamingContent, streamingThinking })

class AvatarPoseController {
  constructor(vrm: VRM);
  update(state: AvatarAnimState, t: number, delta: number): void;
}

frameVrmFullBody(vrm, camera, aspect?: number): void
blendExpression(vrm, from, to, t01): void
```

---

## 相关文档

- [掘金发布稿](../articles/digital-human-vrm-juejin.md)
- [模型目录说明](../../public/avatars/README.md)
