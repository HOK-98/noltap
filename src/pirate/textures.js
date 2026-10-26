import * as THREE from 'three';

// Texture.clone() shares its Source with the original. Create a fresh CanvasTexture
// so tinting one player's knife can never alter the source used by later knives.
export function makeIndependentTexture(source, image) {
  const texture = new THREE.CanvasTexture(image);
  texture.name = source.name;
  texture.mapping = source.mapping;
  texture.channel = source.channel;
  texture.wrapS = source.wrapS;
  texture.wrapT = source.wrapT;
  texture.magFilter = source.magFilter;
  texture.minFilter = source.minFilter;
  texture.anisotropy = source.anisotropy;
  texture.colorSpace = source.colorSpace;
  texture.flipY = source.flipY;
  texture.generateMipmaps = source.generateMipmaps;
  texture.premultiplyAlpha = source.premultiplyAlpha;
  texture.unpackAlignment = source.unpackAlignment;
  texture.offset.copy(source.offset);
  texture.repeat.copy(source.repeat);
  texture.center.copy(source.center);
  texture.rotation = source.rotation;
  texture.matrix.copy(source.matrix);
  texture.matrixAutoUpdate = source.matrixAutoUpdate;
  texture.needsUpdate = true;
  return texture;
}

