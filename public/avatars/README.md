# 3D 数字人模型

当前默认模型：`public/avatars/media-s.vrm`（MediaFlow 助手）

替换为其他 **VRM 1.0** 模型时，放到本目录并在 `.env.local` 配置：

```bash
NEXT_PUBLIC_AVATAR_VRM_URL=/avatars/your-model.vrm
```

未设置环境变量时使用 `/avatars/media-s.vrm`。

若模型仍显示背面，在 `.env.local` 添加：

```bash
NEXT_PUBLIC_AVATAR_CAMERA_Z_SIGN=-1
```
