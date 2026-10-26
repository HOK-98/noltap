import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeIndependentTexture } from '../src/pirate/textures.js';

test('each knife color gets a texture source isolated from the GLB template', () => {
  const originalImage = { width: 2, height: 2, label: 'original red grip' };
  const template = new THREE.Texture(originalImage);
  template.colorSpace = THREE.SRGBColorSpace;
  template.flipY = false;
  template.offset.set(.1, .2);
  template.repeat.set(.8, .7);

  const redImage = { width: 2, height: 2, label: 'red grip' };
  const blueImage = { width: 2, height: 2, label: 'blue grip' };
  const red = makeIndependentTexture(template, redImage);
  const blue = makeIndependentTexture(template, blueImage);

  assert.notEqual(red.source, template.source);
  assert.notEqual(blue.source, template.source);
  assert.notEqual(red.source, blue.source);
  assert.equal(template.image, originalImage);
  assert.equal(red.image, redImage);
  assert.equal(blue.image, blueImage);
  assert.equal(blue.colorSpace, THREE.SRGBColorSpace);
  assert.equal(blue.flipY, false);
  assert.deepEqual(blue.offset.toArray(), template.offset.toArray());
  assert.deepEqual(blue.repeat.toArray(), template.repeat.toArray());
});

