// Meshy geometry -> game-ready barrel. This changes real triangles, not a painted illusion.
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { SLOTS } from '../src/pirate/config.js';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node tools/drill-pirate-barrel.mjs input.glb output.glb');
const io = new NodeIO(), doc = await io.read(input);
const meshes = doc.getRoot().listMeshes();
if (meshes.length !== 1 || meshes[0].listPrimitives().length !== 1) throw new Error('Inspect new barrel layout before processing');
const mesh = meshes[0], primitive = mesh.listPrimitives()[0], pos = primitive.getAttribute('POSITION');
const min = pos.getMin([]), max = pos.getMax([]), sy = 2.25 / (max[1] - min[1]), sr = 2.03 / Math.max(max[0] - min[0], max[2] - min[2]);
const geometry = new THREE.BufferGeometry();
for (const [semantic, name, width] of [['POSITION', 'position', 3], ['NORMAL', 'normal', 3], ['TEXCOORD_0', 'uv', 2]]) {
  const accessor = primitive.getAttribute(semantic); geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(accessor.getArray()), width));
}
geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(primitive.getIndices().getArray()), 1));
const transform = new THREE.Matrix4().makeScale(sr, sy, sr);
transform.setPosition(-(min[0] + max[0]) / 2 * sr, -min[1] * sy, -(min[2] + max[2]) / 2 * sr); geometry.applyMatrix4(transform);
const outside = new THREE.MeshStandardMaterial(), inside = new THREE.MeshStandardMaterial();
let barrel = new Brush(geometry, outside); barrel.updateMatrixWorld(true);
const evaluator = new Evaluator(); evaluator.attributes = ['position', 'normal', 'uv']; evaluator.useGroups = true; evaluator.consolidateGroups = true;
const cuts = [];
// Deepen the top opening so the character is actually inside a hollow barrel.
const cavity = new Brush(new THREE.CylinderGeometry(.70, .70, 2.8, 40), inside); cavity.position.y = 1.8; cavity.updateMatrixWorld(true); cuts.push(cavity);
for (const slot of SLOTS) {
  const drill = new Brush(new THREE.CylinderGeometry(.117, .117, 1.15, 20), inside);
  drill.position.set(...slot.position); drill.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...slot.normal)); drill.updateMatrixWorld(true); cuts.push(drill);
}
for (const cut of cuts) { barrel.updateMatrixWorld(true); barrel = evaluator.evaluate(barrel, cut, SUBTRACTION); }
const result = barrel.geometry, buffer = doc.getRoot().listBuffers()[0], oldMaterial = primitive.getMaterial();
const cutMaterial = doc.createMaterial('Cut oak interior').setBaseColorFactor([.23, .105, .035, 1]).setRoughnessFactor(.9).setDoubleSided(true);
const resultMaterials = Array.isArray(barrel.material) ? barrel.material : [barrel.material];
const shared = Object.fromEntries([['POSITION', 'position', 'VEC3'], ['NORMAL', 'normal', 'VEC3'], ['TEXCOORD_0', 'uv', 'VEC2']].map(([semantic, name, type]) => [semantic, doc.createAccessor(`drilled-${name}`).setType(type).setArray(new Float32Array(result.attributes[name].array)).setBuffer(buffer)]));
mesh.removePrimitive(primitive);
for (const group of result.groups) {
  const p = doc.createPrimitive(); for (const [semantic, accessor] of Object.entries(shared)) p.setAttribute(semantic, accessor);
  const source = result.index ? result.index.array.subarray(group.start, group.start + group.count) : Uint32Array.from({ length: group.count }, (_, i) => group.start + i);
  p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(source)).setBuffer(buffer));
  p.setMaterial(resultMaterials[group.materialIndex] === outside ? oldMaterial : cutMaterial); mesh.addPrimitive(p);
}
primitive.dispose();
for (const node of doc.getRoot().listNodes()) node.setMatrix(new THREE.Matrix4().toArray());
doc.getRoot().setExtras({ ...doc.getRoot().getExtras(), noltap: { source: 'Meshy web', drilledSlots: 16, cavity: true } });
await io.write(output, doc);
console.log(JSON.stringify({ output, triangleCount: result.index ? result.index.count / 3 : result.attributes.position.count / 3, materials: result.groups.length, drilledSlots: 16 }));
