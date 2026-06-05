'use client';

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import {
  ASSISTANT_AVATAR_PORTRAIT_SIZE,
  DEFAULT_AVATAR_VRM_URL,
} from '../../lib/digital-human/constants.js';
import {
  AvatarPoseController,
  frameVrmPortrait,
} from '../../lib/digital-human/vrm-pose-engine.js';

/** @type {Promise<string | null> | null} */
let portraitCachePromise = null;

/**
 * 全局单例：从同一 VRM 渲染一次胸像，供对话气泡头像复用
 * @param {string} [modelUrl]
 */
function loadPortraitDataUrl(modelUrl = DEFAULT_AVATAR_VRM_URL) {
  if (!portraitCachePromise) {
    portraitCachePromise = new Promise((resolve) => {
      if (typeof document === 'undefined') {
        resolve(null);
        return;
      }

      const size = ASSISTANT_AVATAR_PORTRAIT_SIZE;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xeef2f7);

      const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 20);
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(size, size, false);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(1, 2, 2);
      scene.add(key);

      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));

      loader.load(
        modelUrl,
        (gltf) => {
          const vrm = gltf.userData.vrm;
          if (!vrm) {
            renderer.dispose();
            resolve(null);
            return;
          }
          if (vrm.meta?.metaVersion === '0') {
            VRMUtils.rotateVRM0(vrm);
          }
          scene.add(vrm.scene);

          const poseCtrl = new AvatarPoseController(vrm);
          poseCtrl.update('idle', 0, 1);
          vrm.expressionManager?.setValue('happy', 0.12);
          vrm.expressionManager?.setValue('relaxed', 0.4);
          vrm.expressionManager?.update();
          vrm.update(0);

          frameVrmPortrait(vrm, camera, 1);
          renderer.render(scene, camera);

          const url = renderer.domElement.toDataURL('image/png');
          vrm.dispose?.();
          renderer.dispose();
          resolve(url);
        },
        undefined,
        () => {
          renderer.dispose();
          resolve(null);
        },
      );
    });
  }
  return portraitCachePromise;
}

/**
 * @param {{ size?: number, className?: string }} props
 */
export default function AssistantAvatarPortrait({ size = 40, className = '' }) {
  const [src, setSrc] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    let alive = true;
    loadPortraitDataUrl().then((url) => {
      if (alive && url) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-full bg-mf-canvas ring-1 ring-mf-border ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className="size-full object-cover object-[center_18%]"
        />
      ) : (
        <span
          className="grid size-full place-items-center bg-gradient-to-br from-mf-accent-soft to-mf-sidebar text-[10px] font-semibold text-mf-text"
          style={{ fontSize: Math.max(10, size * 0.28) }}
        >
          MF
        </span>
      )}
    </span>
  );
}
