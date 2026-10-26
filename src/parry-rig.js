import * as T from 'three';

const V = () => new T.Vector3();
const Q = () => new T.Quaternion();

export function findBone(root, suffix) {
  let found;
  root.traverse((node) => {
    if (node.isBone && node.name.toLowerCase().replace(/[^a-z0-9]/g, '').endsWith(suffix.toLowerCase())) found = node;
  });
  return found;
}

function setWorldRotation(bone, rotation) {
  bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(rotation));
  bone.updateWorldMatrix(false, false);
}

function aimBone(bone, child, target) {
  bone.updateWorldMatrix(true, false);
  const origin = bone.getWorldPosition(V());
  const from = child.getWorldPosition(V()).sub(origin).normalize();
  const to = target.clone().sub(origin).normalize();
  setWorldRotation(bone, bone.getWorldQuaternion(Q()).premultiply(Q().setFromUnitVectors(from, to)));
}

export function poseArm(upper, lower, hand, target, pole) {
  upper.updateWorldMatrix(true, false);
  const shoulder = upper.getWorldPosition(V());
  const a = shoulder.distanceTo(lower.getWorldPosition(V()));
  const b = lower.getWorldPosition(V()).distanceTo(hand.getWorldPosition(V()));
  const axis = target.clone().sub(shoulder);
  const distance = T.MathUtils.clamp(axis.length(), Math.abs(a - b) + .005, a + b - .005);
  axis.normalize();
  // Both joints must aim at the same reachable endpoint, including overextended attacks.
  const reachable = shoulder.clone().addScaledVector(axis, distance);
  const reach = (a * a - b * b + distance * distance) / (2 * distance);
  const spread = Math.sqrt(Math.max(0, a * a - reach * reach));
  const bend = pole.clone().sub(shoulder).addScaledVector(axis, -pole.clone().sub(shoulder).dot(axis));
  if (bend.lengthSq() < 1e-8) bend.crossVectors(axis, Math.abs(axis.y) < .9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0));
  bend.normalize();
  const elbow = shoulder.clone().addScaledVector(axis, reach).addScaledVector(bend, spread);
  aimBone(upper, lower, elbow);
  aimBone(lower, hand, reachable);
  return hand.getWorldPosition(V());
}

export function createHandGrip(root, side) {
  const [upper, lower, hand] = ['Arm', 'ForeArm', 'Hand'].map((part) => findBone(root, side + part));
  if (!upper || !lower || !hand) throw new Error(`${side} sword arm is missing from the knight rig`);
  const fingers = ['Index', 'Middle', 'Ring', 'Pinky'].map((name) => [1, 2, 3].map((joint) => findBone(root, `${side}Hand${name}${joint}`)));
  const index = fingers[0][0], middle = fingers[1][0], pinky = fingers[3][0];
  hand.updateWorldMatrix(true,true);
  const inverseHand=hand.getWorldQuaternion(Q()).invert();
  const forward = middle ? middle.position.clone().normalize() : hand.getWorldPosition(V()).sub(lower.getWorldPosition(V())).normalize().applyQuaternion(inverseHand);
  const across = pinky && (index||middle) ? (index||middle).position.clone().sub(pinky.position) : V().crossVectors(new T.Vector3(0,0,1).applyQuaternion(inverseHand),forward);
  across.addScaledVector(forward, -across.dot(forward)).normalize();
  const normal = V().crossVectors(forward, across).normalize();
  const firstFingerDirection = middle ? new T.Vector3(0, 1, 0).applyQuaternion(middle.quaternion) : new T.Vector3(0,0,1).applyQuaternion(inverseHand);
  const palm = normal.clone().multiplyScalar(firstFingerDirection.dot(normal) < 0 ? -1 : 1);
  const socket = new T.Object3D();
  socket.name = `${side}SwordGrip`;
  socket.position.copy(middle ? middle.position.clone().multiplyScalar(.85) : forward.clone().multiplyScalar(.065)).addScaledVector(palm, .026);
  socket.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(forward, across, normal));
  hand.add(socket);
  // A closed grip is constant in hand space. Bake it once instead of solving 24
  // finger joints (and their descendant matrices) on every rendered frame.
  const worldCurlAxis = V().crossVectors(forward, palm).normalize().applyQuaternion(hand.getWorldQuaternion(Q()));
  for (const finger of fingers) for (let i = 0; i < finger.length; i++) {
    const bone = finger[i];
    if (bone) setWorldRotation(bone, bone.getWorldQuaternion(Q()).premultiply(Q().setFromAxisAngle(worldCurlAxis, [.65, 1.1, .8][i])));
  }
  return { upper, lower, hand, socket, fingers };
}

export function poseHandGrip(grip, target, rotation, pole) {
  const { upper, lower, hand, socket } = grip;
  hand.updateWorldMatrix(true, false);
  const handRotation = rotation.clone().multiply(socket.quaternion.clone().invert());
  const offset = socket.position.clone().multiply(hand.getWorldScale(V())).applyQuaternion(handRotation);
  poseArm(upper, lower, hand, target.clone().sub(offset), pole);
  setWorldRotation(hand, handRotation);
  return socket.getWorldPosition(V());
}

export function attachSword(grip, blade) {
  const mount = new T.Group();
  const worldScale = grip.hand.getWorldScale(V());
  mount.scale.set(1 / worldScale.x, 1 / worldScale.y, 1 / worldScale.z);
  grip.socket.add(mount);
  // The primary palm sits above the second hand on the existing 22 cm handle.
  blade.position.set(0, -.035, 0);
  mount.add(blade);
  return blade;
}
