# 数字人文档

MediaFlow `/chat` 页 3D VRM 数字人相关文档。

| 文档 | 用途 |
|------|------|
| [tech-spec.md](./tech-spec.md) | 内部技术规格：需求、架构、姿势标定、配置、验收 |
| [../articles/digital-human-vrm-juejin.md](../articles/digital-human-vrm-juejin.md) | 掘金发布稿：VRoid Studio → Next.js 全链路教程 |

**代码入口**

- 渲染：`src/app/components/digital-human/DigitalHumanCanvas.jsx`
- 姿势引擎：`src/app/lib/digital-human/vrm-pose-engine.js`
- 标定脚本：`scripts/calibrate-vrm-poses.mjs`
- 模型：`public/avatars/media-s.vrm`

**线上 Demo**：https://nextformat.aiblank.top/chat
