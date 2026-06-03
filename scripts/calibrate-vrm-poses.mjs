// Headless FK probe/calibration for VRM normalized humanoid bones.
// Usage: node scripts/calibrate-vrm-poses.mjs [probe|thinking|hang]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.self = globalThis;

const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const { VRMLoaderPlugin } = await import('@pixiv/three-vrm');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VRM_PATH = path.resolve(__dirname, '../public/avatars/media-s.vrm');

function loadVrm() {
  const data = fs.readFileSync(VRM_PATH);
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', (gltf) => resolve(gltf.userData.vrm), reject);
  });
}

const BONES = [
  'head', 'neck', 'chest', 'spine', 'hips',
  'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightUpperArm', 'rightLowerArm', 'rightHand',
];

function worldPos(vrm, name) {
  const node = vrm.humanoid.getNormalizedBoneNode(name);
  if (!node) return null;
  const v = new THREE.Vector3();
  node.getWorldPosition(v);
  return v;
}

function applyEulers(vrm, map) {
  vrm.humanoid.resetNormalizedPose();
  for (const [name, rot] of Object.entries(map)) {
    const node = vrm.humanoid.getNormalizedBoneNode(name);
    if (!node) continue;
    node.rotation.set(rot.x ?? 0, rot.y ?? 0, rot.z ?? 0);
  }
  vrm.humanoid.update(0);
  vrm.scene.updateWorldMatrix(true, true);
}

function snapshot(vrm) {
  const out = {};
  for (const b of BONES) {
    const p = worldPos(vrm, b);
    if (p) out[b] = [round(p.x), round(p.y), round(p.z)];
  }
  return out;
}

const round = (n) => Math.round(n * 1000) / 1000;

const vrm = await loadVrm();
vrm.scene.updateWorldMatrix(true, true);

const mode = process.argv[2] ?? 'probe';

if (mode === 'probe') {
  console.log('=== REST POSE world positions ===');
  applyEulers(vrm, {});
  console.log(JSON.stringify(snapshot(vrm), null, 2));

  // Probe each axis on leftUpperArm individually to learn semantics.
  for (const axis of ['x', 'y', 'z']) {
    applyEulers(vrm, { leftUpperArm: { [axis]: 1.0 } });
    const h = worldPos(vrm, 'leftHand');
    console.log(`leftUpperArm.${axis}=+1.0 -> leftHand`, [round(h.x), round(h.y), round(h.z)]);
  }
  for (const axis of ['x', 'y', 'z']) {
    applyEulers(vrm, { leftLowerArm: { [axis]: 1.0 } });
    const h = worldPos(vrm, 'leftHand');
    console.log(`leftLowerArm.${axis}=+1.0 -> leftHand`, [round(h.x), round(h.y), round(h.z)]);
  }
  for (const axis of ['x', 'y', 'z']) {
    applyEulers(vrm, { rightUpperArm: { [axis]: 1.0 } });
    const h = worldPos(vrm, 'rightHand');
    console.log(`rightUpperArm.${axis}=+1.0 -> rightHand`, [round(h.x), round(h.y), round(h.z)]);
  }
  for (const axis of ['x', 'y', 'z']) {
    applyEulers(vrm, { rightLowerArm: { [axis]: 1.0 } });
    const h = worldPos(vrm, 'rightHand');
    console.log(`rightLowerArm.${axis}=+1.0 -> rightHand`, [round(h.x), round(h.y), round(h.z)]);
  }
}

if (mode === 'search') {
  // Search left-arm (chin rest) then right-arm (across chest supporting elbow).
  applyEulers(vrm, {});
  const head = worldPos(vrm, 'head');
  // Left cheek/chin target: slightly left of center, slightly forward, chin height.
  const target = new THREE.Vector3(head.x + 0.06, head.y - 0.06, head.z + 0.06);

  let best = null;
  const range = (a, b, step) => {
    const out = [];
    for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  };

  for (const uz of range(-1.4, -0.3, 0.07)) {
    for (const uy of range(-1.1, 0.1, 0.07)) {
      for (const lz of range(1.0, 3.0, 0.07)) {
        for (const ly of range(-0.6, 0.8, 0.07)) {
          applyEulers(vrm, {
            leftUpperArm: { z: uz, y: uy },
            leftLowerArm: { z: lz, y: ly },
          });
          const hand = worldPos(vrm, 'leftHand');
          const elbow = worldPos(vrm, 'leftLowerArm');
          // hard filter: elbow must be below shoulder (natural tucked elbow)
          if (elbow.y > 1.2) continue;
          const d = hand.distanceTo(target);
          if (!best || d < best.d) best = { d: round(d), uz, uy, lz, ly, hand: hand.toArray().map(round), elbow: elbow.toArray().map(round) };
        }
      }
    }
  }
  console.log('LEFT chin-rest target', target.toArray().map(round));
  console.log(JSON.stringify(best, null, 2));

  // Right arm: forearm across the chest, hand resting near opposite ribs (reachable).
  const rTarget = new THREE.Vector3(0.0, 1.1, 0.13);
  let rBest = null;
  for (const uz of range(0.1, 0.9, 0.07)) {
    for (const uy of range(0.0, 0.9, 0.07)) {
      for (const lz of range(0.0, 1.6, 0.07)) {
        for (const ly of range(0.2, 1.8, 0.07)) {
          applyEulers(vrm, {
            rightUpperArm: { z: uz, y: uy },
            rightLowerArm: { z: lz, y: ly },
          });
          const hand = worldPos(vrm, 'rightHand');
          const elbow = worldPos(vrm, 'rightLowerArm');
          if (elbow.y > 1.25) continue;
          const d = hand.distanceTo(rTarget);
          if (!rBest || d < rBest.d) rBest = { d: round(d), uz, uy, lz, ly, hand: hand.toArray().map(round), elbow: elbow.toArray().map(round) };
        }
      }
    }
  }
  console.log('RIGHT support target', rTarget.toArray().map(round));
  console.log(JSON.stringify(rBest, null, 2));
}

if (mode === 'thinking') {
  // Target: left hand near left cheek; values searched separately, just report.
  const map = JSON.parse(process.argv[3] ?? '{}');
  applyEulers(vrm, map);
  const head = worldPos(vrm, 'head');
  const hand = worldPos(vrm, 'leftHand');
  const elbow = worldPos(vrm, 'leftLowerArm');
  console.log('head ', [round(head.x), round(head.y), round(head.z)]);
  console.log('hand ', [round(hand.x), round(hand.y), round(hand.z)]);
  console.log('elbow', [round(elbow.x), round(elbow.y), round(elbow.z)]);
  console.log('hand-head dist', round(hand.distanceTo(head)));
  const rhand = worldPos(vrm, 'rightHand');
  const relbow = worldPos(vrm, 'rightLowerArm');
  console.log('rhand', [round(rhand.x), round(rhand.y), round(rhand.z)]);
  console.log('relbow', [round(relbow.x), round(relbow.y), round(relbow.z)]);
}
