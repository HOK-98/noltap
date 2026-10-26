import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { COLORS, GAME, MODELS, SCENE, SLOTS } from './config.js';

const up = new THREE.Vector3(0, 1, 0), forward = new THREE.Vector3(0, 0, 1);
const ease = t => 1 - (1 - t) ** 3;
function material(color, roughness = .5, metalness = 0) { return new THREE.MeshStandardMaterial({ color, roughness, metalness }); }
function mesh(geometry, mat, position = [0, 0, 0]) { const m = new THREE.Mesh(geometry, mat); m.position.set(...position); m.castShadow = true; m.receiveShadow = true; return m; }
function woodTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 512;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#c68b41'; ctx.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 100; i++) {
    const x = (i * 43.7) % 128; ctx.strokeStyle = i % 3 ? '#6e371b20' : '#ffe0a936'; ctx.lineWidth = i % 4 ? 1 : 2;
    ctx.beginPath(); ctx.moveTo(x, 0); for (let y = 0; y <= 512; y += 16) ctx.lineTo(x + Math.sin(y / 75 + i) * 2.8, y); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; return texture;
}
// Meshy packs steel, gold and the red grip into Material_0's texture atlas.
// Give each player-color material its own texture, changing only red texels.
function recolorGrip(source, hex) {
  const image = source.map?.image;
  if (!image || !image.width || !image.height) return null;
  try {
    const canvas = document.createElement('canvas');
    const ratio = Math.min(1, 512 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rgb = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
      if (r > 45 && r > g * 1.4 && r > b * 1.35) {
        const shade = Math.min(1.25, Math.max(.2, r / 200));
        for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = Math.min(255, rgb[channel] * shade);
      }
    }
    ctx.putImageData(pixels, 0, 0);
    const map = source.map.clone();
    map.image = canvas;
    map.name = `knife-grip-${hex}`;
    map.needsUpdate = true;
    return map;
  } catch {
    return null;
  }
}
function piratePlaceholder() {
  const g = new THREE.Group(), skin = material('#f4b881'), dark = material('#302a35'), red = material('#c9433a'), white = material('#ffecd0');
  const head = mesh(new THREE.SphereGeometry(.3, 24, 16), skin, [0, .46, 0]); head.scale.set(1, 1.05, .88); g.add(head);
  g.add(mesh(new THREE.CapsuleGeometry(.22, .27, 4, 12), material('#237b9a'), [0, -.02, 0]));
  const scarf = mesh(new THREE.TorusGeometry(.24, .065, 6, 24), red, [0, .18, 0]); scarf.rotation.x = Math.PI / 2; g.add(scarf);
  const hat = mesh(new THREE.SphereGeometry(.36, 16, 12), dark, [0, .69, -.015]); hat.scale.set(1.5, .58, 1); g.add(hat);
  const brim = mesh(new THREE.SphereGeometry(.38, 16, 8), dark, [0, .63, .04]); brim.scale.set(1.7, .15, .95); g.add(brim);
  const band = mesh(new THREE.TorusGeometry(.295, .025, 6, 24), material('#edba56'), [0, .63, 0]); band.rotation.x = Math.PI / 2; g.add(band);
  g.add(mesh(new THREE.SphereGeometry(.06, 12, 8), white, [0, .73, .29]));
  for (const x of [-.115, .115]) {
    g.add(mesh(new THREE.SphereGeometry(.067, 12, 8), white, [x, .48, .23]));
    g.add(mesh(new THREE.SphereGeometry(.036, 10, 8), dark, [x, .48, .286]));
    const brow = mesh(new THREE.BoxGeometry(.14, .025, .035), dark, [x, .58, .245]); brow.rotation.z = -Math.sign(x) * .14; g.add(brow);
  }
  g.add(mesh(new THREE.SphereGeometry(.066, 12, 8), skin, [0, .405, .29]));
  const smile = mesh(new THREE.TorusGeometry(.105, .026, 6, 16, Math.PI), white, [0, .35, .235]); smile.rotation.z = Math.PI; g.add(smile);
  const ear = mesh(new THREE.TorusGeometry(.055, .012, 6, 16), material('#ffd66e', .25, .65), [-.31, .39, 0]); g.add(ear);
  for (const side of [-1, 1]) { const arm = mesh(new THREE.CapsuleGeometry(.075, .27, 4, 8), red, [side * .33, .05, 0]); arm.rotation.z = side * .5; g.add(arm); }
  return g;
}
function knifePlaceholder(color) {
  const g = new THREE.Group(), steel = material('#dcebf0', .22, .75), grip = material(color, .32, .15);
  // The point is at local z=-.54, handle extends toward +Z, away from the barrel.
  const shape = new THREE.Shape(); shape.moveTo(-.07, .05); shape.lineTo(-.07, -.4); shape.lineTo(0, -.55); shape.lineTo(.07, -.4); shape.lineTo(.07, .05); shape.closePath();
  const blade = mesh(new THREE.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 1, steps: 1 }), steel);
  blade.rotation.x = Math.PI / 2; g.add(blade);
  g.add(mesh(new THREE.BoxGeometry(.32, .095, .1), grip, [0, 0, .08]));
  const handle = mesh(new THREE.CapsuleGeometry(.065, .28, 4, 8), grip, [0, 0, .29]); handle.rotation.x = Math.PI / 2; g.add(handle);
  g.add(mesh(new THREE.SphereGeometry(.085, 12, 8), grip, [0, 0, .49]));
  return g;
}

export class PirateScene {
  constructor(host, labels, callbacks) {
    this.host = host; this.labels = labels; this.callbacks = callbacks; this.time = 0; this.rotation = .05; this.targetRotation = .05;
    this.canPick = false; this.used = new Set(); this.jobs = new Set(); this.mixers = []; this.disposed = false;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(35, 1, .1, 50); this.camera.position.set(0, 3.45, 6.7); this.camera.lookAt(0, 1.35, 0);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label', '3D 해적 통. 구멍을 눌러 칼을 꽂거나 드래그로 회전하세요.'); host.prepend(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#f2f8ff', '#94714c', 2.8));
    const sun = new THREE.DirectionalLight('#fff1c9', 3.6); sun.position.set(-3, 7, 5); sun.castShadow = true; sun.shadow.mapSize.set(512, 512); sun.shadow.camera.left = -3; sun.shadow.camera.right = 3; sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -2; sun.shadow.bias = -.002; this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#8ce9ed', 2); rim.position.set(3, 3, -3); this.scene.add(rim);
    this.root = new THREE.Group(); this.scene.add(this.root); this.barrelRoot = new THREE.Group(); this.root.add(this.barrelRoot);
    this.wood = woodTexture(); this.gold = material('#e9b655', .3, .65); this.iron = material('#4a4b4b', .35, .55);
    this.buildBarrel(); this.buildStage(); this.buildSlots();
    this.pirate = new THREE.Group(); this.pirate.add(piratePlaceholder()); this.pirate.position.set(...(MODELS.pirate.previewPosition || MODELS.pirate.position)); this.barrelRoot.add(this.pirate);
    this.knifeTemplate = null; this.knifeMaterials = new Map(); this.pirateBase = this.pirate.position.clone(); this.knives = []; this.buildParticles(); this.installInteraction();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host); this.resize();
    this.lastFrame = 0; this.frame = this.frame.bind(this); this.frameId = requestAnimationFrame(this.frame);
    this.visibility = () => { this.lastFrame = 0; if (!document.hidden && !this.frameId) this.frameId = requestAnimationFrame(this.frame); };
    document.addEventListener('visibilitychange', this.visibility);
    this.loadModels();
  }
  buildStage() {
    const top = mesh(new THREE.CylinderGeometry(1.65, 1.75, .17, 64), material('#9e6330'), [0, -.12, 0]); top.receiveShadow = true; this.root.add(top);
    this.root.add(mesh(new THREE.CylinderGeometry(1.67, 1.67, .04, 64), material('#d8a860'), [0, -.015, 0]));
    for (const radius of [1.57, 1.7]) { const ring = mesh(new THREE.TorusGeometry(radius, .035, 6, 64), this.gold, [0, -.015, 0]); ring.rotation.x = Math.PI / 2; this.root.add(ring); }
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; this.root.add(mesh(new THREE.SphereGeometry(.035, 6, 6), this.gold, [Math.sin(a) * 1.65, .035, Math.cos(a) * 1.65])); }
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128; const ctx = shadowCanvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64); gradient.addColorStop(0, '#23170bcc'); gradient.addColorStop(1, '#23170b00'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    const shadow = mesh(new THREE.PlaneGeometry(5, 4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }), [0, -.23, 0]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false; this.root.add(shadow);
  }
  buildBarrel() {
    this.placeholderBarrel = new THREE.Group(); this.barrelRoot.add(this.placeholderBarrel);
    const points = [[.81, .06], [.87, .2], [.99, .65], [1.015, 1.1], [.99, 1.55], [.91, 2.05], [.86, 2.18]].map(p => new THREE.Vector2(...p));
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(.085, .55, .37 + (i % 4) * .035), map: this.wood, roughness: .52 });
      this.placeholderBarrel.add(mesh(new THREE.LatheGeometry(points, 6, i * Math.PI / 8 + .008, Math.PI / 8 - .016), mat));
    }
    for (const [y, radius] of [[.25, .9], [1.1, 1.035], [2.01, .94]]) {
      const ring = mesh(new THREE.CylinderGeometry(radius, radius, .15, 64, 1, true), this.iron, [0, y, 0]); this.placeholderBarrel.add(ring);
      for (const edge of [-.075, .075]) { const trim = mesh(new THREE.TorusGeometry(radius, .022, 6, 64), this.gold, [0, y + edge, 0]); trim.rotation.x = Math.PI / 2; this.placeholderBarrel.add(trim); }
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; this.placeholderBarrel.add(mesh(new THREE.SphereGeometry(.035, 6, 6), this.gold, [Math.sin(a) * (radius + .006), y, Math.cos(a) * (radius + .006)])); }
    }
    const rim = mesh(new THREE.TorusGeometry(.855, .07, 8, 64), material('#d5a163'), [0, 2.17, 0]); rim.rotation.x = Math.PI / 2; this.placeholderBarrel.add(rim);
    const inside = mesh(new THREE.CylinderGeometry(.8, .8, .15, 48), material('#36291f'), [0, 2.02, 0]); this.placeholderBarrel.add(inside);
  }
  buildSlots() {
    this.anchors = []; this.targets = [];
    for (const slot of SLOTS) {
      const anchor = new THREE.Group(); anchor.position.set(...slot.position); anchor.quaternion.setFromUnitVectors(forward, new THREE.Vector3(...slot.normal)); this.barrelRoot.add(anchor); this.anchors.push(anchor);
      const center = mesh(new THREE.CircleGeometry(.105, 20), material('#23180e')); center.position.z = .008; center.userData.slot = slot.id; center.castShadow = false; anchor.add(center); this.targets.push(center);
      const rim = mesh(new THREE.TorusGeometry(.111, .025, 6, 24), material('#d59d4e', .3, .45)); anchor.add(rim);
      const label = document.createElement('button'); label.className = 'slot-number'; label.type = 'button'; label.textContent = slot.id + 1; label.setAttribute('aria-label', `구멍 ${slot.id + 1}에 칼 꽂기`); label.style.pointerEvents = 'none'; label.hidden = true;
      // Pointer uses the 3D raycast; this equivalent control allows keyboard access.
      label.addEventListener('click', () => this.callbacks.pick(slot.id)); this.labels.append(label); anchor.userData.label = label;
    }
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2(); this.worldPos = new THREE.Vector3(); this.worldNormal = new THREE.Vector3(); this.cameraDirection = new THREE.Vector3();
  }
  buildParticles() {
    const positions = new Float32Array(70 * 3), colors = new Float32Array(70 * 3); this.particleData = [];
    for (let i = 0; i < 70; i++) { const c = new THREE.Color(i % 3 ? '#ffe18b' : '#fff9dc'); c.toArray(colors, i * 3); this.particleData.push({ x: Math.sin(i * 2.4) * (1 + i % 4 / 3), y: 1 + (i % 7) / 4, z: Math.cos(i * 2.4) * (1 + i % 3 / 3) }); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({ size: .055, vertexColors: true, transparent: true, depthWrite: false })); this.particles.visible = false; this.scene.add(this.particles);
  }
  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 600 ? SCENE.mobilePixelRatio : SCENE.desktopPixelRatio));
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.position.z = this.camera.aspect < .95 ? 8.2 : 6.7; this.camera.updateProjectionMatrix();
  }
  async loadModels() {
    const loader = new GLTFLoader(); const status = {};
    await Promise.all(Object.entries(MODELS).map(async ([name, config]) => {
      try {
        // Missing GLBs use a complete, playable procedural preview.
        const response = await fetch(config.url, { method: 'HEAD' }); if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error('Model missing');
        const gltf = await loader.loadAsync(config.url); if (this.disposed) return;
        const wrapper = new THREE.Group(), model = gltf.scene; wrapper.add(model);
        model.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
        const scale = config.height / Math.max(size.y, .001); model.scale.multiplyScalar(scale); model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        wrapper.scale.setScalar(config.scale); wrapper.rotation.set(...config.rotation);
        model.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
        if (name === 'barrel') {
          wrapper.position.set(...config.position); this.placeholderBarrel.visible = false; this.barrelRoot.add(wrapper);
          if (config.drilled) for (const target of this.targets) { target.material.transparent = true; target.material.opacity = 0; target.material.depthWrite = false; }
        }
        else if (name === 'pirate') {
          this.pirate.clear(); this.pirate.add(wrapper); this.pirate.position.set(...config.position); this.pirateBase.copy(this.pirate.position);
          if (gltf.animations.length) { const mixer = new THREE.AnimationMixer(model); const clip = gltf.animations.find(a => a.name === config.animation) || gltf.animations[0]; mixer.clipAction(clip).play(); this.mixers.push(mixer); }
        } else { wrapper.position.set(...config.position); this.knifeTemplate = wrapper; }
        status[name] = 'loaded';
      } catch { status[name] = 'placeholder'; }
    }));
    if (!this.disposed) this.callbacks.models(status);
  }
  installInteraction() {
    const canvas = this.renderer.domElement; this.drag = null;
    this.down = event => { if (event.button !== 0 || this.drag) return; this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, moved: false }; canvas.setPointerCapture(event.pointerId); };
    this.move = event => {
      if (this.drag?.id === event.pointerId) { if (Math.hypot(event.clientX - this.drag.x, event.clientY - this.drag.y) > 7) this.drag.moved = true; if (this.drag.moved) this.targetRotation += (event.clientX - this.drag.lastX) * .009; this.drag.lastX = event.clientX; }
      else { const id = this.hit(event); canvas.style.cursor = this.canPick && id != null && !this.used.has(id) ? 'pointer' : 'grab'; }
    };
    this.release = event => {
      if (this.drag?.id !== event.pointerId) return;
      const tap = !this.drag.moved && Math.hypot(event.clientX - this.drag.x, event.clientY - this.drag.y) < 8; this.drag = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (tap && this.canPick) { const id = this.hit(event); if (id != null && !this.used.has(id)) this.callbacks.pick(id); }
    };
    this.cancel = () => { this.drag = null; };
    canvas.addEventListener('pointerdown', this.down); canvas.addEventListener('pointermove', this.move); canvas.addEventListener('pointerup', this.release); canvas.addEventListener('pointercancel', this.cancel);
    canvas.addEventListener('lostpointercapture', this.cancel);
  }
  hit(event) {
    const rect = this.renderer.domElement.getBoundingClientRect(); this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const hit of this.raycaster.intersectObjects(this.targets)) {
      const id = hit.object.userData.slot; if (this.frontFacing(this.anchors[id])) return id;
    }
    return null;
  }
  frontFacing(anchor) {
    anchor.getWorldPosition(this.worldPos); anchor.getWorldQuaternion(this._quat ||= new THREE.Quaternion()); this.worldNormal.copy(forward).applyQuaternion(this._quat);
    this.cameraDirection.copy(this.camera.position).sub(this.worldPos).normalize(); return this.worldNormal.dot(this.cameraDirection) > .27;
  }
  setInput(enabled, used) { this.canPick = enabled; this.used = new Set(used); }
  rotate(direction) { this.targetRotation += direction * Math.PI / 4; }
  faceSlot(id) { this.targetRotation = -Math.atan2(SLOTS[id].normal[0], SLOTS[id].normal[2]); this.rotation = this.targetRotation; }
  tween(ms, update) {
    return new Promise(resolve => this.jobs.add({ start: this.time, duration: ms / 1000, update, resolve }));
  }
  async insert(id, colorIndex) {
    const anchor = this.anchors[id], color = COLORS[colorIndex]?.[2] || COLORS[0][2]; let knife;
    if (this.knifeTemplate) {
      knife = clone(this.knifeTemplate);
      const tinted = source => {
        const key = `${source.uuid}:${color}`; if (this.knifeMaterials.has(key)) return this.knifeMaterials.get(key);
        const mat = source.clone();
        if (MODELS.knife.tintMaterials.some(name => mat.name.toLowerCase().includes(name))) mat.color.set(color);
        else {
          const gripMap = recolorGrip(source, color);
          if (gripMap) { mat.map = gripMap; mat.userData.gripMap = gripMap; }
          else mat.color.set(color);
        }
        this.knifeMaterials.set(key, mat); return mat;
      };
      knife.traverse(node => { if (node.isMesh) node.material = Array.isArray(node.material) ? node.material.map(tinted) : tinted(node.material); });
    } else knife = knifePlaceholder(color);
    const holder = new THREE.Group(); holder.add(knife); holder.position.z = SCENE.insertFrom; anchor.add(holder); this.knives.push(holder); this.used.add(id);
    const done = await this.tween(GAME.insertMs, t => { holder.position.z = SCENE.insertFrom + ease(t) * (SCENE.insertDepth - SCENE.insertFrom); holder.rotation.z = Math.sin(t * Math.PI) * .1; });
    if (done) { this.shakeAt = this.time; this.shakeStrength = .025; } return done;
  }
  async pop() {
    this.popAt = this.time; this.shakeAt = this.time; this.shakeStrength = .08; this.particles.visible = true;
    return this.tween(GAME.popMs, t => {
      const jump = Math.sin(Math.min(1, t / .75) * Math.PI);
      this.pirate.position.y = this.pirateBase.y + jump * SCENE.popHeight; this.pirate.rotation.z = Math.sin(t * Math.PI * 2) * SCENE.popSpin;
      this.particles.material.opacity = Math.max(0, 1 - t); const array = this.particles.geometry.attributes.position.array;
      this.particleData.forEach((p, i) => { array[i * 3] = p.x * t; array[i * 3 + 1] = 2.3 + p.y * t * 2 - t * t * 3; array[i * 3 + 2] = p.z * t; }); this.particles.geometry.attributes.position.needsUpdate = true;
    });
  }
  reset() {
    for (const job of this.jobs) job.resolve(false); this.jobs.clear();
    for (const knife of this.knives) { knife.removeFromParent(); knife.traverse(n => { if (n.isMesh && !this.knifeTemplate) { n.geometry.dispose(); for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.dispose(); } }); }
    this.knives = []; this.used.clear(); this.particles.visible = false; this.pirate.position.copy(this.pirateBase); this.pirate.rotation.set(0, 0, 0); this.targetRotation = this.rotation = .05;
  }
  frame(timestamp) {
    this.frameId = null; if (this.disposed || document.hidden) { this.lastFrame = 0; return; }
    const delta = this.lastFrame ? (timestamp - this.lastFrame) / 1000 : 0; this.lastFrame = timestamp; this.time += delta;
    this.rotation += (this.targetRotation - this.rotation) * (1 - Math.exp(-delta * 12)); this.barrelRoot.rotation.y = this.rotation;
    const shakeAge = this.time - (this.shakeAt ?? -2); this.barrelRoot.rotation.z = shakeAge < .28 ? Math.sin(shakeAge * 90) * this.shakeStrength * (1 - shakeAge / .28) : 0;
    for (const job of this.jobs) { const t = Math.min(1, (this.time - job.start) / job.duration); job.update(t); if (t === 1) { this.jobs.delete(job); job.resolve(true); } }
    for (const mixer of this.mixers) mixer.update(Math.min(delta, .05));
    this.scene.updateMatrixWorld();
    for (const anchor of this.anchors) {
      const label = anchor.userData.label, id = this.anchors.indexOf(anchor); const visible = this.frontFacing(anchor); label.hidden = !visible;
      if (visible) {
        this.worldPos.project(this.camera); label.style.left = `${(this.worldPos.x * .5 + .5) * 100}%`; label.style.top = `${(-this.worldPos.y * .5 + .5) * 100}%`;
        label.disabled = !this.canPick || this.used.has(id); label.classList.toggle('used', this.used.has(id));
      }
    }
    this.renderer.render(this.scene, this.camera); this.frameId = requestAnimationFrame(this.frame);
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frameId); this.resizeObserver.disconnect(); document.removeEventListener('visibilitychange', this.visibility); this.reset();
    const geometries = new Set(), materials = new Set(); this.scene.traverse(node => { if (node.geometry) geometries.add(node.geometry); if (node.material) for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m); });
    for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const m of this.knifeMaterials.values()) { m.userData.gripMap?.dispose(); m.dispose(); } this.wood.dispose(); this.renderer.dispose();
  }
}
