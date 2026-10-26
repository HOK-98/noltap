import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { poseArm, createHandGrip, poseHandGrip, attachSword } from '../src/parry-rig.js';

const V = (...v) => new T.Vector3(...v);

test('overextended arm aims both joints at its reachable endpoint without stretching', () => {
  const root = new T.Group(), upper = new T.Bone(), lower = new T.Bone(), hand = new T.Bone();
  root.add(upper); upper.add(lower); lower.add(hand);
  lower.position.y = .3; hand.position.y = .28;
  root.position.set(.2, 1.3, -.1); root.rotation.set(.1, .5, -.2); root.updateMatrixWorld(true);
  const shoulder = upper.getWorldPosition(V()), axis = V(.5, -.2, 1).normalize();
  poseArm(upper, lower, hand, shoulder.clone().addScaledVector(axis, 5), shoulder.clone().add(V(1, 0, 0)));
  assert.ok(hand.getWorldPosition(V()).distanceTo(shoulder.clone().addScaledVector(axis, .575)) < 1e-6);
  assert.ok(Math.abs(upper.getWorldPosition(V()).distanceTo(lower.getWorldPosition(V())) - .3) < 1e-6);
  assert.ok(Math.abs(lower.getWorldPosition(V()).distanceTo(hand.getWorldPosition(V())) - .28) < 1e-6);
});

function knightSkeleton() {
  const data = readFileSync(new URL('../public/models/parry-knight.glb', import.meta.url));
  const json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  const joints = new Set(json.skins.flatMap((skin) => skin.joints));
  const nodes = json.nodes.map((node, i) => {
    const object = joints.has(i) ? new T.Bone() : new T.Object3D(); object.name = node.name || '';
    if (node.matrix) object.applyMatrix4(new T.Matrix4().fromArray(node.matrix));
    else {
      if (node.translation) object.position.fromArray(node.translation);
      if (node.rotation) object.quaternion.fromArray(node.rotation);
      if (node.scale) object.scale.fromArray(node.scale);
    }
    return object;
  });
  json.nodes.forEach((node, i) => (node.children || []).forEach((child) => nodes[i].add(nodes[child])));
  const root = new T.Group(); json.scenes[json.scene || 0].nodes.forEach((i) => root.add(nodes[i]));
  root.scale.setScalar(1.2); root.updateMatrixWorld(true);
  return root;
}

test('downloaded knight keeps its sword in the palm throughout four attack directions and unreachable targets', () => {
  const root = knightSkeleton(), enemy = new T.Group(); enemy.add(root);
  const right = createHandGrip(root, 'Right'), left = createHandGrip(root, 'Left');
  const rest = [right,left].flatMap(({upper,lower,hand}) => [upper,lower,hand].map(bone => [bone,bone.quaternion.clone()]));
  const fingers = [right,left].flatMap(grip => grip.fingers.flat().filter(Boolean).map(bone => [bone,bone.quaternion.clone()]));
  const blade = attachSword(right, new T.Group());
  const poses = [
    [V(-.06, 1.35, .32), V(-.25, 1.95, .9)],
    [V(-.22, 1.55, .22), V(-1.15, 2.15, .65)],
    [V(.22, 1.55, .22), V(1.15, 2.15, .65)],
    [V(-.06, 1.9, .16), V(-.1, 3.1, .25)],
    [V(-.06, 1.22, .25), V(-.3, .25, 1.1)],
    [V(-.05, 1.3, .56), V(-.25, 1.5, 2.7)],
    [V(3, 3, 4), V(4, 4, 4)],
  ];
  for (const [i, [hand, tip]] of poses.entries()) {
    for (const [bone, rotation] of rest) bone.quaternion.copy(rotation);
    enemy.position.set(.015, .005, i === 5 ? .2 : 0); enemy.rotation.y = i % 2 ? -.16 : .16; enemy.updateMatrixWorld(true);
    const rotation = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), tip.clone().sub(hand).normalize());
    poseHandGrip(right, hand, rotation, V(-.9, .85, .1));
    const secondary = blade.localToWorld(V(0, -.065, 0));
    const leftPalm = poseHandGrip(left, secondary, rotation, V(.9, .85, .1));
    assert.ok(blade.localToWorld(V(0, .035, 0)).distanceTo(right.socket.getWorldPosition(V())) < 1e-6, `pose ${i}: primary grip detached`);
    assert.ok(blade.getWorldQuaternion(new T.Quaternion()).angleTo(rotation) < 1e-6, `pose ${i}: wrist orientation drifted`);
    if (i < 6) assert.ok(leftPalm.distanceTo(secondary) < .035, `pose ${i}: secondary grip detached by ${leftPalm.distanceTo(secondary)}m`);
    assert.ok(Math.abs(blade.getWorldScale(V()).x - 1) < 1e-6, 'sword inherited the model scale');
    for (const [bone, closedGrip] of fingers) assert.ok(bone.quaternion.angleTo(closedGrip) < 1e-6, 'finger grip changed while the wrist moved');
  }
});
