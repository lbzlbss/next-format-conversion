import * as THREE from 'three';
import { AVATAR_CAMERA_Z_SIGN } from './constants.js';

/** @typedef {'idle' | 'thinking' | 'speaking'} AvatarAnimState */
/** @typedef {Record<string, { x?: number, y?: number, z?: number }>} EulerMap */

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

/**
 * media-s.vrm 标定（FK 网格搜索，见 scripts/calibrate-vrm-poses.mjs）
 * normalized 骨骼轴语义：z = 抬/落（左 +z 抬、右 -z 抬），y = 前后摆，x = 拧转。
 */

/** 待机：双臂自然下垂、微外张 */
const HANG_EULER = {
  leftUpperArm: { z: -1.18, y: -0.08 },
  leftLowerArm: { z: 0.12, y: 0.1 },
  rightUpperArm: { z: 1.18, y: 0.08 },
  rightLowerArm: { z: -0.12, y: -0.1 },
};

/** 思考：左手托腮（手贴下巴）+ 右臂抱胸托肘 + 微低头 */
const THINKING_EULER = {
  leftUpperArm: { z: -0.49, y: -1.1, x: 0.12 },
  leftLowerArm: { z: 2.89, y: 0.31 },
  leftHand: { z: 0.18 },
  rightUpperArm: { z: 0.87, y: 0.84 },
  rightLowerArm: { z: 0.42, y: 1.74 },
  rightHand: { z: 0.1 },
  neck: { x: 0.08, z: -0.05 },
  head: { x: 0.05, z: 0.04 },
};

/** 说话：前臂抬至腰前，准备做手势 */
const SPEAKING_EULER = {
  leftUpperArm: { z: -0.98, y: -0.2 },
  leftLowerArm: { z: 0.7 },
  rightUpperArm: { z: 0.98, y: 0.2 },
  rightLowerArm: { z: -0.7 },
};

const POSE_EULERS = { idle: HANG_EULER, thinking: THINKING_EULER, speaking: SPEAKING_EULER };

/** 所有可能被驱动的骨骼（其余骨骼保持 rest） */
const POSE_BONES = Array.from(
  new Set([
    ...Object.keys(HANG_EULER),
    ...Object.keys(THINKING_EULER),
    ...Object.keys(SPEAKING_EULER),
    'spine',
    'chest',
    'upperChest',
    'neck',
    'head',
  ]),
);

/** 过渡时间常数（秒），越小越快 */
const TRANSITION_SEC = 0.5;

function getCameraZSign() {
  return AVATAR_CAMERA_Z_SIGN >= 0 ? 1 : -1;
}

/**
 * 直接驱动 normalized 骨骼欧拉角，并用四元数指数平滑做状态过渡。
 * 不走 getNormalizedPose/setNormalizedPose 往返，避免姿势丢失。
 */
export class AvatarPoseController {
  /** @param {import('@pixiv/three-vrm').VRM} vrm */
  constructor(vrm) {
    this.vrm = vrm;
    /** @type {AvatarAnimState} */
    this.state = 'idle';
    /** 每根骨骼当前已应用的四元数 @type {Map<string, THREE.Quaternion>} */
    this.current = new Map();

    const init = this.buildTargetEulers('idle', 0);
    for (const bone of POSE_BONES) {
      const e = init[bone] ?? { x: 0, y: 0, z: 0 };
      _euler.set(e.x ?? 0, e.y ?? 0, e.z ?? 0);
      this.current.set(bone, new THREE.Quaternion().setFromEuler(_euler));
    }
  }

  /**
   * 组合「基础姿势 + 程序化呼吸/手势」得到目标欧拉角。
   * @param {AvatarAnimState} state
   * @param {number} t
   * @returns {EulerMap}
   */
  buildTargetEulers(state, t) {
    const base = POSE_EULERS[state] ?? HANG_EULER;
    /** @type {EulerMap} */
    const out = {};
    for (const bone of POSE_BONES) {
      const b = base[bone];
      out[bone] = { x: b?.x ?? 0, y: b?.y ?? 0, z: b?.z ?? 0 };
    }

    const add = (bone, dx = 0, dy = 0, dz = 0) => {
      const o = out[bone] ?? (out[bone] = { x: 0, y: 0, z: 0 });
      o.x += dx;
      o.y += dy;
      o.z += dz;
    };

    if (state === 'idle') {
      const breath = Math.sin(t * 1.3) * 0.02;
      add('spine', breath);
      add('chest', breath * 0.5);
      add('upperChest', breath * 0.3);
      add('head', 0, Math.sin(t * 0.6) * 0.03);
      add('leftUpperArm', 0, 0, Math.sin(t * 0.9) * 0.02);
      add('rightUpperArm', 0, 0, -Math.sin(t * 0.9) * 0.02);
    } else if (state === 'thinking') {
      add('head', Math.sin(t * 0.9) * 0.015, Math.sin(t * 0.7) * 0.02);
      add('spine', Math.sin(t * 1.1) * 0.006);
      add('leftLowerArm', 0, 0, Math.sin(t * 1.4) * 0.01);
    } else {
      // speaking：双臂做幅度适中的手势 + 点头
      const wave = Math.sin(t * 3.4);
      const wave2 = Math.sin(t * 2.7 + 0.8);
      const nod = Math.sin(t * 2.5) * 0.05;
      add('head', 0.03 + nod, Math.sin(t * 1.6) * 0.02);
      add('neck', nod * 0.4);
      add('spine', nod * 0.1);
      add('leftUpperArm', 0, wave2 * 0.06, wave * 0.05);
      add('leftLowerArm', 0, 0, 0.12 + wave * 0.16);
      add('rightUpperArm', 0, -wave2 * 0.06, -wave * 0.05);
      add('rightLowerArm', 0, 0, -0.12 - wave2 * 0.16);
    }

    return out;
  }

  /**
   * @param {AvatarAnimState} state
   * @param {number} t
   * @param {number} delta
   */
  update(state, t, delta) {
    this.state = state;
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const targets = this.buildTargetEulers(state, t);
    const step = Math.min(1, delta / TRANSITION_SEC);

    for (const bone of POSE_BONES) {
      const node = humanoid.getNormalizedBoneNode(bone);
      if (!node) continue;
      const e = targets[bone] ?? { x: 0, y: 0, z: 0 };
      _euler.set(e.x ?? 0, e.y ?? 0, e.z ?? 0);
      _quat.setFromEuler(_euler);
      const cur = this.current.get(bone) ?? new THREE.Quaternion();
      cur.slerp(_quat, step);
      this.current.set(bone, cur);
      node.quaternion.copy(cur);
    }
  }
}

/**
 * 取景：脚踩地面，头部贴近画面顶部，尽量减少上方空白。
 * @param {import('@pixiv/three-vrm').VRM} vrm
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} [aspect=0.55]
 */
export function frameVrmFullBody(vrm, camera, aspect = 0.55) {
  vrm.scene.rotation.set(0, 0, 0);
  vrm.scene.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(vrm.scene);
  const center = box.getCenter(new THREE.Vector3());

  vrm.scene.position.set(-center.x, -box.min.y, -center.z);
  vrm.scene.updateWorldMatrix(true, true);

  const framed = new THREE.Box3().setFromObject(vrm.scene);
  const size = framed.getSize(new THREE.Vector3());
  const topY = framed.max.y;

  const vFovRad = (camera.fov * Math.PI) / 180;
  const safeAspect = Math.max(aspect, 0.3);
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * safeAspect);

  const margin = 1.08;
  const distForHeight = (size.y * margin * 0.5) / Math.tan(vFovRad / 2);
  const distForWidth = (size.x * margin * 0.5) / Math.tan(hFovRad / 2);
  const distance = Math.max(distForHeight, distForWidth, 0.4);

  // 把镜头中心放在「头顶下方半个视高」处，使头部贴近顶部、身体向下铺满
  const visHalfHeight = Math.tan(vFovRad / 2) * distance;
  const topPad = visHalfHeight * 0.05;
  const lookY = topY - visHalfHeight + topPad;

  camera.position.set(0, lookY, getCameraZSign() * distance);
  camera.lookAt(0, lookY, 0);
  camera.updateProjectionMatrix();
}

/**
 * 胸像取景：用于对话列表等小尺寸头像
 * @param {import('@pixiv/three-vrm').VRM} vrm
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} [aspect=1]
 */
export function frameVrmPortrait(vrm, camera, aspect = 1) {
  vrm.scene.rotation.set(0, 0, 0);
  vrm.scene.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(vrm.scene);
  const center = box.getCenter(new THREE.Vector3());
  vrm.scene.position.set(-center.x, -box.min.y, -center.z);
  vrm.scene.updateWorldMatrix(true, true);

  const head = vrm.humanoid.getNormalizedBoneNode('head');
  const headY = new THREE.Vector3();
  if (head) {
    head.getWorldPosition(headY);
  } else {
    headY.set(0, box.max.y * 0.88, 0);
  }

  camera.fov = 22;
  const vFovRad = (camera.fov * Math.PI) / 180;
  const distance = 0.42;
  const lookY = headY.y - 0.06;

  camera.aspect = Math.max(aspect, 0.5);
  camera.position.set(0, lookY, getCameraZSign() * distance);
  camera.lookAt(0, lookY - 0.02, 0);
  camera.updateProjectionMatrix();
}

/** @param {import('@pixiv/three-vrm').VRM} vrm @param {AvatarAnimState} from @param {AvatarAnimState} to @param {number} t01 */
export function blendExpression(vrm, from, to, t01) {
  const em = vrm.expressionManager;
  if (!em) return;

  const presets = {
    idle: { relaxed: 0.45, happy: 0.08, lookUp: 0, aa: 0 },
    thinking: { relaxed: 0.45, happy: 0, lookUp: 0.25, aa: 0 },
    speaking: { relaxed: 0.2, happy: 0, lookUp: 0, aa: 0 },
  };

  const a = presets[from];
  const b = presets[to];
  const lerp = (x, y) => x + (y - x) * t01;

  em.setValue('relaxed', lerp(a.relaxed, b.relaxed));
  em.setValue('happy', lerp(a.happy, b.happy));
  em.setValue('lookUp', lerp(a.lookUp, b.lookUp));
  em.setValue('aa', lerp(a.aa, b.aa));
  em.setValue('blink', 0);
}
