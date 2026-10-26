export const GAME = { slots: 16, rounds: 10, safePoints: 20, winPoints: 100, insertMs: 430, thinkMinMs: 700, thinkMaxMs: 1300, popMs: 1450 };
const modelUrl = (name) => `${import.meta.env.BASE_URL}models/${name}?v=20261027-bounded-load`;
export const COLORS = [
  ['red', '빨강', '#ed5149'], ['blue', '파랑', '#269ee9'], ['yellow', '노랑', '#ffce3f'], ['green', '초록', '#63bf53'],
  ['purple', '보라', '#9a6de5'], ['pink', '분홍', '#ed79af'], ['orange', '주황', '#f69c37'], ['black', '검정', '#424d5a'],
];
// Local coordinates: Y is up; the knife's +Z points out of the barrel.
export const SLOTS = Array.from({ length: GAME.slots }, (_, id) => {
  const angle = (id % 8) * Math.PI / 4;
  const y = id < 8 ? 1.47 : .82;
  return { id, position: [Math.sin(angle) * 1.035, y, Math.cos(angle) * 1.035], normal: [Math.sin(angle), 0, Math.cos(angle)] };
});
export const MODELS = {
  barrel: { url: modelUrl('barrel.glb'), height: 2.25, position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, drilled: true },
  pirate: { url: modelUrl('pirate.glb'), height: 2.05, position: [0, 1.18, 0], previewPosition: [0, 1.87, 0], rotation: [0, 0, 0], scale: 1, animation: null },
  knife: { url: modelUrl('knife.glb'), height: .9, position: [0, 0, .05], rotation: [-Math.PI / 2, 0, 0], scale: 1, tintMaterials: ['handle', 'grip'] },
};
export const SCENE = { popHeight: 2.35, popSpin: .65, insertFrom: 1, insertDepth: .14, mobilePixelRatio: 1.25, desktopPixelRatio: 1.5 };
