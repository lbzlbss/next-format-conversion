# 给 AI 对话页装上 3D 数字人：从 VRoid Studio 建模到 Next.js 姿势标定全链路

> **标签建议**：`Next.js` `Three.js` `VRM` `VRoid` `前端` `AI`  
> **阅读时长**：约 12 分钟  
> **Demo**：[https://nextformat.aiblank.top/chat](https://nextformat.aiblank.top/chat)  
> **项目内部技术规格**：[docs/digital-human/tech-spec.md](../digital-human/tech-spec.md)

---

## 写在前面

做 AI 对话助手时，右侧在疯狂吐字，左侧却一片死寂——用户很难感知「它真的在思考」。

我们在 MediaFlow 的 `/chat` 页左侧接了一个 **3D VRM 数字人**：待机时垂臂呼吸，思考时左手托腮，回复时做手势 + 口型开合。状态跟 SSE 流式输出实时联动。

这篇文章不讲玄学，只讲一条完整链路：

**VRoid Studio 捏人 → 导出 VRM → Next.js + three-vrm 渲染 → FK 标定托腮姿势 → 上线**

踩过的坑也会一并写清楚——尤其是 **「明明写了托腮，人物却一直 T-pose 摊手」** 那个。

---

## 最终效果


| 状态          | 触发时机         | 表现           |
| ----------- | ------------ | ------------ |
| 待机 idle     | 无流式输出        | 双臂下垂、呼吸、眨眼   |
| 思考 thinking | 工具运行 / 思考链输出 | 左手托腮 + 右臂抱胸  |
| 说话 speaking | 正文流式输出       | 手势 + 点头 + 口型 |


布局上，左侧数字人与右侧对话区 **等高**，输入框贴底，移动端（`< lg`）自动隐藏数字人栏。

---

## 一、用 VRoid Studio 创建角色

### 1.1 下载与安装

[VRoid Studio](https://vroid.com/en/studio) 是 pixiv 出品的免费 3D 角色编辑器，导出格式就是 Web 3D avatars 事实标准 **VRM**。

支持 Windows / macOS。装好就能开捏。

### 1.2 建模建议（面向 Web 对话场景）

我们用的是自研助手形象 `media-s`，整体是偏「专业客服 / 知识库向导」风格。几个实用建议：

1. **半身构图友好**：对话页左侧栏宽约 340px，模型不需要复杂场景道具
2. **服装简洁**：过多飘带、多层裙摆会拖慢 SpringBone 演算
3. **表情预设留好**：VRM 自带 `relaxed` / `happy` / `lookUp` / `aa`（张嘴）等 BlendShape，后面口型、思考表情都靠它们
4. **先 A-pose 再导出**：VRoid 默认不是 T-pose，但导出后骨骼 rest 姿态仍会影响你的标定基准

### 1.3 导出 VRM

菜单路径：

```
File → Export VRM
```

关键选项：


| 选项            | 建议                             |
| ------------- | ------------------------------ |
| VRM 版本        | **1.0**（优先，three-vrm 3.x 原生支持） |
| 压缩纹理          | 开启，显著减小体积                      |
| 包含 BlendShape | 必须开启（表情驱动依赖它）                  |


导出后你会得到一个 `.vrm` 文件（我们的约 17MB）。丢进 Next.js 的 `public/avatars/` 即可：

```
public/avatars/media-s.vrm
```

环境变量可覆盖：

```bash
# .env.local
NEXT_PUBLIC_AVATAR_VRM_URL=/avatars/media-s.vrm
```

### 1.4 授权说明（商用必读）

如果模型来自 **VRoid Hub** 下载而非完全自捏，务必读清楚作者的 [Redistribution / 再配布许可](https://hub.vroid.com/)。  
自己用 VRoid Studio 原创的角色，一般可自由用于自有产品，但 **Hub 上他人作品不一定可商用**。

上线前确认两件事：**模型授权** + **是否包含第三方素材**。

---

## 二、Next.js 接入 three-vrm

### 2.1 依赖

```bash
pnpm add three @pixiv/three-vrm
```

### 2.2 最小渲染组件

核心思路：**Client Component + useEffect 搭 Three.js 场景**，不要把 VRM 塞进 RSC。

```jsx
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export default function DigitalHumanCanvas({ state, modelUrl = '/avatars/media-s.vrm' }) {
  const mountRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    mount.appendChild(renderer.domElement);

    // 灯光：环境光 + 主光 + 冷色补光
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(1.2, 2.5, 2);
    scene.add(key);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(modelUrl, (gltf) => {
      const vrm = gltf.userData.vrm;
      if (vrm.meta?.metaVersion === '0') VRMUtils.rotateVRM0(vrm); // 兼容旧版
      scene.add(vrm.scene);
      // ... 姿势控制器、取景、RAF 循环
    });

    return () => {
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [modelUrl]);

  return <div ref={mountRef} className="h-full w-full" />;
}
```

### 2.3 VRoid 模型「看到背面」？

VRoid 角色默认面向 **-Z**，相机要放在 +Z 侧。我们抽了环境变量：

```javascript
export const AVATAR_CAMERA_Z_SIGN =
  Number(process.env.NEXT_PUBLIC_AVATAR_CAMERA_Z_SIGN) || 1;
```

如果上线后仍是背面，设 `-1` 翻转即可。

---

## 三、对话状态 → 数字人状态

数字人本身不懂 SSE，只认三个枚举：

```typescript
type AvatarAnimState = 'idle' | 'thinking' | 'speaking';
```

用一个 Hook 把聊天状态映射过去：

```javascript
export function useDigitalHumanState({
  busy, toolRunning, streamingContent, streamingThinking,
}) {
  return useMemo(() => {
    if (busy || toolRunning || streamingThinking) return 'thinking';
    if (streamingContent) return 'speaking';
    return 'idle';
  }, [busy, toolRunning, streamingContent, streamingThinking]);
}
```

优先级：**thinking > speaking > idle**。  
工具调用、思考链输出期间保持托腮，避免「工具跑着但人已经放下手」的违和感。

ChatPanel 里：

```jsx
const avatarState = useDigitalHumanState({ busy, toolRunning, streamingContent, streamingThinking });

<aside className="hidden lg:flex ...">
  <DigitalHumanViewport state={avatarState} />
  <DigitalHumanStatusBar state={avatarState} />
</aside>
```

---

## 四、姿势系统：我们踩过的最大的坑

### 4.1 需求

产品要三种姿势：

- **待机**：双臂自然下垂
- **思考**：左手托腮，右手抱胸
- **说话**：前臂抬起，配合点头和手势

还要求 **状态切换约 0.5s 平滑过渡**。

### 4.2 第一版为什么失败？

第一版走了 `@pixiv/three-vrm` 的「烘焙姿势」路线：

```javascript
humanoid.resetNormalizedPose();
bone.rotation.set(x, y, z);
const pose = humanoid.getNormalizedPose(); // 烘焙
// 运行时 setNormalizedPose + slerp 混合
```

结果上线后用户反馈：**思考时双臂大开，像 T-pose，根本不是托腮。**

排查后发现两个问题：

**问题 1：欧拉角轴语义搞错了**

对 `media-s.vrm` 的 normalized 骨骼：


| 轴   | 实际效果          |
| --- | ------------- |
| `x` | 拧转（手的位置几乎不变！） |
| `y` | 前后摆           |
| `z` | 抬/落（左右臂符号镜像）  |


我们早期把「抬臂」写在 `leftUpperArm.x` 上——等于只拧了拧大臂，位置纹丝不动。

**问题 2：pose 往返丢姿势**

`getNormalizedPose → setNormalizedPose` 在运行时混合时，部分骨骼回退到 rest 姿态，视觉上就像一直摊着手。

### 4.3 第二版：直接驱动 + FK 标定

**改法：**

1. 每帧直接写 `bone.quaternion`，用 slerp 做状态过渡
2. 写 Node 脚本对 `media-s.vrm` 做 **FK 网格搜索**，以「左手到下巴距离最小」为目标

探针脚本核心逻辑：

```javascript
// scripts/calibrate-vrm-poses.mjs
globalThis.self = globalThis; // Node 环境 shim

for (const uz of range(-1.4, -0.3, 0.07)) {
  for (const uy of range(-1.1, 0.1, 0.07)) {
    for (const lz of range(1.0, 3.0, 0.07)) {
      applyEulers(vrm, {
        leftUpperArm: { z: uz, y: uy },
        leftLowerArm: { z: lz, y: ly },
      });
      const dist = leftHand.distanceTo(chinTarget);
      // 记录最小误差组合
    }
  }
}
```

标定结果（手-头距 ≈ 0.126）：

```javascript
const THINKING_EULER = {
  leftUpperArm:  { z: -0.49, y: -1.1,  x: 0.12 },
  leftLowerArm:  { z:  2.89, y:  0.31 },
  leftHand:      { z:  0.18 },
  rightUpperArm: { z:  0.87, y:  0.84 },
  rightLowerArm: { z:  0.42, y:  1.74 },
  rightHand:     { z:  0.1  },
  neck:          { x:  0.08, z: -0.05 },
  head:          { x:  0.05, z:  0.04 },
};
```

运行时控制器：

```javascript
class AvatarPoseController {
  update(state, t, delta) {
    const targets = this.buildTargetEulers(state, t); // 基础姿势 + sin 微动
    const step = Math.min(1, delta / 0.5); // 0.5s 过渡

    for (const bone of POSE_BONES) {
      _quat.setFromEuler(targets[bone]);
      cur.slerp(_quat, step);
      node.quaternion.copy(cur);
    }
  }
}
```

> **换模型必重标定。** 不同 VRM 的 normalized 轴不一定一致，别直接 copy 数值。

---

## 五、表情与口型

VRM BlendShape 预设：

```javascript
const presets = {
  idle:     { relaxed: 0.45, happy: 0.08, lookUp: 0, aa: 0 },
  thinking: { relaxed: 0.45, happy: 0,    lookUp: 0.25, aa: 0 },
  speaking: { relaxed: 0.2,  happy: 0,    lookUp: 0, aa: 0 },
};
```

- **idle**：每 ~2.8s 触发一次 blink
- **thinking**：开 `lookUp`，同时 `lookAt.autoUpdate = false`，避免眼球乱转破坏托腮
- **speaking**：叠加正弦口型 `aa = 0.2 + 0.45 * |sin(t * 9)|`

目前口型是模拟的，还没接 TTS viseme——够用了，后面可升级。

---

## 六、相机取景：别用 T-pose 算包围盒

又一个隐蔽 bug：模型加载完立刻取景，此时还是 **rest/T-pose**，手臂横展，包围盒偏宽 → 人物被推远 → **顶部大片空白**。

修复：**先吸附到 idle 姿势，再算包围盒**。

```javascript
poseCtrl.update('idle', 0, 1); // 瞬间切到垂臂
vrm.update(0);
frameVrmFullBody(vrm, camera, aspect);
```

取景策略：脚底对齐 y=0，镜头中心上移到「头顶下方半个视高」，让头部贴近容器上沿。

---

## 七、布局：100dvh 高度链

右侧对话区底部空白，通常是 flex 高度链断了。

```jsx
// page.jsx
<div className="flex h-[100dvh] flex-col overflow-hidden">
  <SubPageHeader />
  <main className="min-h-0 flex-1 overflow-hidden">
    <ChatPanel className="h-full" />
  </main>
</div>
```

ChatPanel 内部：

```text
aside（数字人）  h-full flex-col
  ├ Viewport    flex-1 min-h-0
  └ StatusBar   shrink-0

section（对话）  h-full flex-col overflow-hidden
  ├ 消息列表    flex-1 min-h-0 overflow-y-auto
  └ 输入区      shrink-0
```

关键词三连：`**min-h-0` + `flex-1` + `overflow-hidden**`。

### Hydration 注意

Three.js 只能跑在客户端。我们用 `avatarReady`（`useEffect` 后置 true）延迟挂载数字人，SSR 阶段渲染等尺寸占位 aside，避免 hydration mismatch。

---

## 八、降级方案

17MB 的 VRM + WebGL，不可能 100% 成功。

加载失败时切 **2D 占位**：

```jsx
if (failed) return <Avatar2DFallback state={state} />;
```

一个 emoji 头像 + 状态文字 + CSS `animate-pulse/bounce`，体验降级但不中断对话。

---

## 九、性能与部署


| 项    | 做法                                     |
| ---- | -------------------------------------- |
| 像素比  | `Math.min(devicePixelRatio, 1.5)`      |
| 卸载清理 | `vrm.dispose()` + `renderer.dispose()` |
| 静态资源 | VRM 放 `public/`，走 CDN 缓存               |
| 首屏   | 模型大，首次加载 2~5s 正常，可加 loading 态          |


我们部署在 Vercel，push `master` 自动发布。生产地址：

> [https://nextformat.aiblank.top/chat](https://nextformat.aiblank.top/chat)

---

## 十、目录结构一览

```text
src/app/
├── chat/page.jsx
├── components/digital-human/
│   ├── DigitalHumanCanvas.jsx    # Three.js 主循环
│   ├── DigitalHumanStage.jsx     # Viewport + StatusBar
│   └── Avatar2DFallback.jsx
├── hooks/useDigitalHumanState.js
└── lib/digital-human/
    ├── constants.js
    └── vrm-pose-engine.js        # 姿势 / 取景 / 表情

public/avatars/media-s.vrm
scripts/calibrate-vrm-poses.mjs   # FK 标定工具
```

---

## 总结

整条链路可以概括成 6 步：

1. **VRoid Studio** 捏人 → 导出 VRM 1.0 → 确认授权
2. **three-vrm** 加载渲染，注意 VRoid 朝向和 VRM0 兼容
3. **状态机** 把 SSE 流式阶段映射到 idle / thinking / speaking
4. **姿势** 不要盲写欧拉角——用 FK 探针 + 网格搜索标定
5. **取景** 先设 idle 再算包围盒，解决顶部空白
6. **布局** 100dvh + min-h-0 高度链，左右栏等高

最难的不是 Three.js，而是 **「这个模型的 normalized 骨骼，到底哪个轴是抬手」**。  
把标定脚本固化进仓库，换模型时重跑一遍，比肉眼调参省太多时间。

---

## 参考资料

- [VRoid Studio 官网](https://vroid.com/en/studio)
- [@pixiv/three-vrm GitHub](https://github.com/pixiv/three-vrm)
- [VRM 规范](https://vrm.dev/en/)
- [Three.js 文档](https://threejs.org/docs/)

---

**掘金发布小贴士：**

- **封面图**：截一张 `/chat` 页 thinking 状态截图（托腮 + 右侧思考链）
- **摘要**：用 VRoid Studio 导出 VRM，在 Next.js 对话页实现 3D 数字人待机/托腮/说话三态联动，附 FK 姿势标定踩坑记录
- 可配 1 张架构图（UI → Hook → PoseEngine → Canvas）增强可读性

