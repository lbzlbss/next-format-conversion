/** 默认 VRM（public/avatars/media-s.vrm，可用 NEXT_PUBLIC_AVATAR_VRM_URL 覆盖） */
export const DEFAULT_AVATAR_VRM_URL =
  process.env.NEXT_PUBLIC_AVATAR_VRM_URL || '/avatars/media-s.vrm';

/** 相机 Z 方向：VRoid 模型朝 -Z 用 1；若仍见背面可设为 -1 */
export const AVATAR_CAMERA_Z_SIGN = Number(process.env.NEXT_PUBLIC_AVATAR_CAMERA_Z_SIGN) || 1;

/** @typedef {'idle' | 'thinking' | 'speaking'} AvatarAnimState */
