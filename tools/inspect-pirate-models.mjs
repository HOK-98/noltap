import { NodeIO } from '@gltf-transform/core';
const io = new NodeIO();
for (const name of ['barrel', 'pirate', 'knife']) {
  const doc = await io.read(`public/models/${name}.glb`);
  console.log(name, JSON.stringify({
    nodes: doc.getRoot().listNodes().map(n => ({ name: n.getName(), translation: n.getTranslation(), rotation: n.getRotation(), scale: n.getScale() })),
    meshes: doc.getRoot().listMeshes().map(m => m.listPrimitives().map(p => ({
      attributes: p.listSemantics(), vertices: p.getAttribute('POSITION').getCount(),
      min: p.getAttribute('POSITION').getMin([]), max: p.getAttribute('POSITION').getMax([]),
    }))),
    textures: doc.getRoot().listTextures().map(t => ({ name: t.getName(), size: t.getSize() })),
  }));
}
