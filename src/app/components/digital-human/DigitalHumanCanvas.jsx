'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { DEFAULT_AVATAR_VRM_URL } from '../../lib/digital-human/constants.js';
import {
  AvatarPoseController,
  blendExpression,
  frameVrmFullBody,
} from '../../lib/digital-human/vrm-pose-engine.js';
import Avatar2DFallback from './Avatar2DFallback.jsx';

/**
 * @param {{ state: 'idle' | 'thinking' | 'speaking', modelUrl?: string }} props
 */
export default function DigitalHumanCanvas({ state, modelUrl = DEFAULT_AVATAR_VRM_URL }) {
  const containerRef = useRef(null);
  const vrmRef = useRef(null);
  const poseCtrlRef = useRef(/** @type {AvatarPoseController | null} */ (null));
  const exprFromRef = useRef(/** @type {'idle'|'thinking'|'speaking'} */ ('idle'));
  const exprTargetRef = useRef(/** @type {'idle'|'thinking'|'speaking'} */ ('idle'));
  const exprBlendRef = useRef(1);
  const stateRef = useRef(state);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  stateRef.current = state;

  useEffect(() => {
    if (failed || !containerRef.current) return undefined;

    let disposed = false;
    let raf = 0;
    let blinkPhase = 0;
    let blinkOpen = 0;
    const clock = new THREE.Clock();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef2f7);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
    const lookAtTarget = new THREE.Object3D();
    scene.add(lookAtTarget);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const mount = containerRef.current;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(1.2, 2.5, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc7d2fe, 0.35);
    fill.position.set(-2, 1, 1);
    scene.add(fill);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) return;
        const vrm = gltf.userData.vrm;
        if (!vrm) {
          setFailed(true);
          return;
        }
        if (vrm.meta?.metaVersion === '0') {
          VRMUtils.rotateVRM0(vrm);
        }
        scene.add(vrm.scene);

        const poseCtrl = new AvatarPoseController(vrm);
        poseCtrlRef.current = poseCtrl;
        vrmRef.current = vrm;

        // 先把骨骼吸附到待机姿势（手臂下垂），再取景，避免用 T-pose 的宽包围盒导致人物过小
        poseCtrl.update('idle', 0, 1);
        vrm.update(0);

        const aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
        frameVrmFullBody(vrm, camera, aspect);
        lookAtTarget.position.copy(camera.position);

        if (vrm.lookAt) {
          vrm.lookAt.target = lookAtTarget;
          vrm.lookAt.autoUpdate = true;
        }
        setLoading(false);
      },
      undefined,
      () => {
        if (!disposed) setFailed(true);
      },
    );

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      const vrm = vrmRef.current;
      if (vrm) {
        frameVrmFullBody(vrm, camera, w / h);
        lookAtTarget.position.copy(camera.position);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const applyExpressions = (vrm, st, t, delta) => {
      const em = vrm.expressionManager;
      if (!em) return;

      if (st !== exprTargetRef.current) {
        exprFromRef.current = exprTargetRef.current;
        exprTargetRef.current = st;
        exprBlendRef.current = 0;
      }

      exprBlendRef.current = Math.min(1, exprBlendRef.current + delta / 0.45);
      const eased =
        exprBlendRef.current * exprBlendRef.current * (3 - 2 * exprBlendRef.current);

      blendExpression(vrm, exprFromRef.current, exprTargetRef.current, eased);

      if (st === 'speaking') {
        const mouth = 0.2 + 0.45 * Math.abs(Math.sin(t * 9));
        em.setValue(VRMExpressionPresetName.Aa, mouth);
      }

      if (st === 'idle') {
        blinkPhase += delta;
        if (blinkPhase > 2.8) {
          blinkOpen = Math.min(1, blinkOpen + delta * 12);
          em.setValue(VRMExpressionPresetName.Blink, blinkOpen);
          if (blinkOpen >= 1) {
            blinkPhase = 0;
            blinkOpen = 0;
          }
        }
      }

      em.update();
    };

    const loop = () => {
      if (disposed) return;
      raf = requestAnimationFrame(loop);
      const delta = clock.getDelta();
      const t = clock.elapsedTime;
      const vrm = vrmRef.current;
      const poseCtrl = poseCtrlRef.current;
      const st = stateRef.current;

      if (vrm && poseCtrl) {
        if (vrm.lookAt) {
          vrm.lookAt.autoUpdate = st !== 'thinking';
        }
        poseCtrl.update(st, t, delta);
        applyExpressions(vrm, st, t, delta);
        vrm.update(delta);
      }

      renderer.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (vrmRef.current) {
        vrmRef.current.dispose?.();
        vrmRef.current = null;
      }
      poseCtrlRef.current = null;
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [failed, modelUrl]);

  if (failed) {
    return <Avatar2DFallback state={state} />;
  }

  return (
    <div className="relative h-full w-full min-h-0">
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-mf-canvas text-[11px] text-mf-muted">
          加载数字人…
        </div>
      ) : null}
      <div ref={containerRef} className="h-full w-full min-h-0" />
    </div>
  );
}
