import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { poseHandGrip } from './parry-rig.js';
import { initialPixelRatio, createFrameBudget } from './parry-performance.js';
import { attackMotion, swordTrajectory } from './parry-motion.js';
import { createSword, createGauntlet, metalEnvironment, duelAtmosphere, sparkTexture } from './parry-art.js';
import {createKnightActor,disposeKnightActor,bossAppearance} from './parry-actor.js';

const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const Q = () => new T.Quaternion();
const clamp = T.MathUtils.clamp;
const smooth = (n) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.clone().lerp(b, t);
const assets=new Map();
export function prepareParryAssets(boss=1) {
  const index=bossAppearance(boss);
  if(!assets.has(index)){
    const modelIndex=index===1?2:index===2?1:index;
    const name=modelIndex===1?'parry-knight.glb':`parry-boss-${modelIndex}.glb`;
    assets.set(index,new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${name}`).catch(error=>{assets.delete(index);throw error;}));
  }
  return assets.get(index);
}

function stoneTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#8c9395'; ctx.fillRect(0, 0, 256, 256);
  let seed = 4531;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for(let i=0;i<110;i++) {
    const x=rand()*256,y=rand()*256,r=12+rand()*80;
    const stain=ctx.createRadialGradient(x,y,1,x,y,r);
    stain.addColorStop(0,i%3===0?'#d9d4c825':'#131e2a32');stain.addColorStop(1,'#00000000');ctx.fillStyle=stain;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  for (let i = 0; i < 18000; i++) {
    const n = Math.floor(95 + rand() * 85); ctx.fillStyle = `rgba(${n},${n - 3},${n - 9},.25)`;
    ctx.fillRect(rand() * 256, rand() * 256, rand() * 3 + 1, rand() * 2 + 1);
  }
  for (let i = 0; i < 30; i++) {
    ctx.strokeStyle = '#49493b25'; ctx.lineWidth = rand() * 2;
    const x = rand() * 256, y = rand() * 256; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + rand() * 45 - 20, y + rand() * 30); ctx.stroke();
  }
  const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace; return map;
}

function fireTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 128;
  const c = canvas.getContext('2d');
  const glow = c.createRadialGradient(32,85,3,32,75,57);
  glow.addColorStop(0,'#ffd064a0'); glow.addColorStop(.5,'#ff712825'); glow.addColorStop(1,'#ff410000');
  c.fillStyle = glow; c.fillRect(0,0,64,128);
  const flame = c.createLinearGradient(0,15,0,116);
  flame.addColorStop(0,'#ff873100'); flame.addColorStop(.25,'#ff9031c0'); flame.addColorStop(.7,'#ffba48ee'); flame.addColorStop(1,'#ff6c2000');
  c.fillStyle = flame; c.beginPath(); c.moveTo(32,115); c.bezierCurveTo(4,99,12,79,22,62); c.bezierCurveTo(18,83,30,65,29,43);
  c.bezierCurveTo(28,30,38,25,35,8); c.bezierCurveTo(56,44,35,57,45,72); c.bezierCurveTo(61,96,44,111,32,115); c.fill();
  c.fillStyle = '#fff2ac'; c.beginPath(); c.moveTo(32,110); c.bezierCurveTo(16,97,25,88,30,72); c.bezierCurveTo(37,90,43,96,32,110); c.fill();
  const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace; return map;
}

function hall(scene, mobile) {
  const map = stoneTexture();
  const stone = new T.MeshStandardMaterial({ color: 0x36434f, map, bumpMap: map, bumpScale: .075, roughness: .95 });
  const trim = new T.MeshStandardMaterial({ color: 0x535e67, map, bumpMap:map,bumpScale:.045,roughness: .88 });
  const bronze = new T.MeshStandardMaterial({ color: 0x665744, metalness: .55, roughness: .72 });
  const iron = new T.MeshStandardMaterial({ color: 0x15191a, metalness: .75, roughness: .65 });
  const cube = new RoundedBoxGeometry(1,1,1,2,.045);
  const batches = new Map();
  const box = (x,y,z,sx,sy,sz,mat = stone) => {
    const mesh = new T.Mesh(cube, mat); mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz);
    if (!batches.has(mat)) batches.set(mat, []);
    batches.get(mat).push(mesh); return mesh;
  };
  const floor = new T.InstancedMesh(new RoundedBoxGeometry(.985,.18,.985,1,.02), stone, 400);
  const matrix = new T.Matrix4(); let index = 0;
  for (let x = -10; x < 10; x++) for (let z = -14; z < 6; z++) {
    matrix.makeTranslation(x + .5, -.1 + Math.sin(x * 37 + z * 19) * .004, z + .5);
    floor.setMatrixAt(index, matrix); floor.setColorAt(index++, new T.Color().setHSL(.57,.045,.55 + Math.sin(x * 7 + z * 11) * .085));
  }
  floor.receiveShadow = true; scene.add(floor);
  const cloth = new T.MeshStandardMaterial({ color: 0x4e171c, roughness: 1 });
  for (const side of [-1,1]) {
    box(side * 6.5,3,-4,.9,6,20);
    for (const z of [-1.8,-6,-10]) {
      box(side * 4.7,2.2,z,.65,4.4,.75,trim); box(side * 4.7,.17,z,1.1,.34,1.15,trim); box(side * 4.7,4.4,z,1.05,.3,1.15,trim);
    }
    for (let row = 0; row < 9; row++) for (let col = 0; col < 5; col++) box(side * (2.15 + col * .94 + row % 2 * .1),row * .6 + .3,-6,.915,.575,.65);
    box(side * 3.35,3.55,-5.61,.8,1.65,.025,cloth); box(side * 3.35,4.4,-5.6,1,.045,.07,bronze);
    box(side * 3.35,3.65,-5.58,.045,.45,.02,bronze); box(side * 3.35,3.72,-5.57,.27,.045,.02,bronze);
    box(side * 1.82,1.4,-6,.5,2.8,.85,trim);
    for(const z of [-8.7,-11.5]){box(side*1.65,1.8,z,.26,3.6,.35,trim);box(side*1.65,3.6,z,.48,.18,.55,trim);}
    for(let i=0;i<10;i++){const block=box(side*(3.7+(i%3)*.29),.06+(i%2)*.04,-1.2-i*.39,.16+(i%3)*.08,.14,.22,stone);block.rotation.set(.08*i,i*.7,.11*i);}
    for(const y of [.12,2.75,4.8])box(side*3.95,y,-5.54,3.8,.075,.18,trim);
  }
  for (let i = 0; i <= 14; i++) {
    const a = i / 14 * Math.PI;
    box(Math.cos(a) * 1.82,2.8 + Math.sin(a) * 1.82,-6,.44,.58,.85,trim).rotation.z = a - Math.PI / 2;
  }
  box(0,5.45,-6,13,1.35,1); box(0,2.4,-13,5,5,.5,new T.MeshStandardMaterial({ color: 0x121d25 }));
  for (let step = 0; step < 7; step++) box(0,.11 * step,-6.6 - step * .5,3.15,.2,.52);
  const ring = new T.Mesh(new T.TorusGeometry(1.83,.009,4,96), new T.MeshStandardMaterial({color:0x202b33,metalness:0,roughness:1})); ring.rotation.x = Math.PI / 2; ring.position.set(0,.008,.4); scene.add(ring);
  const second = ring.clone(); second.scale.setScalar(.9); scene.add(second);
  const torches = [];
  const flameMaterial = new T.SpriteMaterial({ map:fireTexture(),transparent:true,depthWrite:false,blending:T.AdditiveBlending,color:0xffc878 });
  for (const side of [-1,1]) for (const z of [-2.5,-5.1]) {
    const x = side * (z === -2.5 ? 3 : 1.9);
    box(x,.75,z,.07,1.5,.07,iron); box(x,.08,z,.42,.16,.42,iron);
    const bowl = new T.Mesh(new T.CylinderGeometry(.22,.12,.16,10), iron); bowl.position.set(x,1.54,z); scene.add(bowl);
    const flame = new T.Sprite(flameMaterial); flame.position.set(x,1.83,z); flame.scale.set(.5,.8,1); scene.add(flame);
    const light = z === -2.5 ? new T.PointLight(0xffa14d,20,11,2) : null;
    if (light) { light.position.set(x,1.95,z); scene.add(light); }
    torches.push({ flame,light,offset:x * 9 + z });
  }
  for (const [material, blocks] of batches) {
    const batch = new T.InstancedMesh(cube, material, blocks.length);
    blocks.forEach((block, i) => { block.updateMatrix(); batch.setMatrixAt(i, block.matrix); });
    batch.castShadow = batch.receiveShadow = true; batch.matrixAutoUpdate = false;
    batch.computeBoundingSphere(); scene.add(batch);
  }
  scene.add(new T.HemisphereLight(0x9cb5cb,0x171312,.85));
  const key = new T.DirectionalLight(0xc4d9f2,2.6); key.position.set(-3,6,3); key.castShadow = true;
  key.shadow.mapSize.set(512,512);
  Object.assign(key.shadow.camera,{ left:-4,right:4,top:4,bottom:-4,near:1,far:16 }); key.shadow.normalBias = .025; key.shadow.bias = -.0002; scene.add(key);
  const rim = new T.DirectionalLight(0x93bede,3.3); rim.position.set(1,4,-5); scene.add(rim); return torches;
}

export function createParryRenderer(parent, model, frame, gltf) {
  const mobile = matchMedia('(max-width:700px)').matches;
  const renderer = new T.WebGLRenderer({ antialias:!mobile,powerPreference:'high-performance' });
  const ratioCeiling = initialPixelRatio(parent.clientWidth,parent.clientHeight,devicePixelRatio,mobile);
  const frameBudget = createFrameBudget(ratioCeiling);
  renderer.setPixelRatio(ratioCeiling); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute('aria-label','3D 성채에서 기사와 검을 맞대는 패링 전투'); parent.append(renderer.domElement);
  const scene = new T.Scene(); scene.background = new T.Color(0x080f18); scene.fog = new T.FogExp2(0x080f18,.07);
  const environment=metalEnvironment(renderer,scene),dust=duelAtmosphere(scene);
  const camera = new T.PerspectiveCamera(51,16/9,.06,45); camera.position.set(0,1.65,2.95); camera.lookAt(0,1.42,0); scene.add(camera);
  const hallStart=scene.children.length;
  const torches = hall(scene,mobile), enemy = new T.Group();
  // Render the fixed hall once. Combat, flames and particles remain live in layer 0.
  for(const item of scene.children.slice(hallStart))item.traverse(node=>{
    if(node.isMesh)node.layers.set(1);
    if(node.isLight){node.layers.enableAll();if(node.shadow)node.shadow.camera.layers.set(1);}
  });
  const backdrop=new T.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false});
  backdrop.texture.colorSpace=T.LinearSRGBColorSpace;
  renderer.shadowMap.autoUpdate=false;
  let backdropDirty=true;
  function captureHall(){
    renderer.getDrawingBufferSize(backdropSize);backdrop.setSize(backdropSize.x,backdropSize.y);
    scene.background=new T.Color(0x080f18);camera.layers.set(1);renderer.shadowMap.needsUpdate=true;
    renderer.setRenderTarget(backdrop);renderer.render(scene,camera);renderer.setRenderTarget(null);
    camera.layers.set(0);scene.background=backdrop.texture;backdropDirty=false;
  }
  const backdropSize=new T.Vector2();
  scene.add(enemy);
  let shownBoss=bossAppearance(model.boss||1);
  parent.dataset.bossModel=String(shownBoss);
  const readyAssets=new Map([[shownBoss,gltf]]),loadingAssets=new Map();
  let actor=createKnightActor(gltf,shownBoss);enemy.add(actor.group);
  let {rightGrip,leftGrip,rest,bodyBones,bodyRest,blade}=actor;
  function warmBoss(number){
    const index=bossAppearance(number);
    if(readyAssets.has(index))return Promise.resolve(readyAssets.get(index));
    if(!loadingAssets.has(index))loadingAssets.set(index,prepareParryAssets(index).then(value=>{readyAssets.set(index,value);return value;}).catch(()=>{readyAssets.set(index,gltf);return gltf;}));
    return loadingAssets.get(index);
  }
  warmBoss(shownBoss+1);
  const player=createSword();camera.add(player);
  const playerArm=createGauntlet(player,camera);
  player.traverse((node) => { node.castShadow = false; });
  const flash = new T.PointLight(0xffd99a,0,4); flash.position.set(.12,1.48,2.4); scene.add(flash);
  const positions = new Float32Array(120), sparkGeo = new T.BufferGeometry(); sparkGeo.setAttribute('position',new T.BufferAttribute(positions,3));
  const sparkMap=sparkTexture();
  const sparkMat = new T.PointsMaterial({ map:sparkMap,color:0xffd795,size:.04,transparent:true,depthWrite:false,blending:T.AdditiveBlending });
  const sparks = new T.Points(sparkGeo,sparkMat); sparks.frustumCulled = false; scene.add(sparks);
  const parries = { left:[V(-.24,-.28,-.92),V(.22,.61,-1.15)],right:[V(.29,-.28,-.92),V(-.22,.61,-1.15)],up:[V(.34,.08,-.95),V(-.68,.24,-1.12)],down:[V(.29,-.37,-.95),V(-.64,-.26,-1.12)] };
  const contactPoint=V();let lastContactAttack=null;
  const previousHand=V(-.06,1.35,.32),previousTip=V(-.25,2.1,.72);
  const blendHand=V(),blendTip=V();let visualAttack=null;
  const debugPerformance = new URLSearchParams(location.search).has('perf');
  let perfFrames = 0, perfTime = 0, perfCpu = 0, perfPrevious = 0;
  let active = true, destroyed = false, raf;
  function resize() {
    const w = parent.clientWidth,h = parent.clientHeight; if (!w || !h) return;
    renderer.setSize(w,h,false); camera.aspect = w/h; camera.fov = w/h < 1.3 ? 61 : 51; camera.updateProjectionMatrix();backdropDirty=true;
  }
  const observer = new ResizeObserver(resize); observer.observe(parent); resize();
  function render(now) {
    const cpuStart = debugPerformance ? performance.now() : 0;
    if (!active || destroyed) return; frame(now); if (!active || destroyed) return;
    const nextBoss=bossAppearance(model.boss||1);
    if(nextBoss!==shownBoss&&readyAssets.has(nextBoss)){
      disposeKnightActor(actor);actor=createKnightActor(readyAssets.get(nextBoss),nextBoss);enemy.add(actor.group);
      ({rightGrip,leftGrip,rest,bodyBones,bodyRest,blade}=actor);shownBoss=nextBoss;
      parent.dataset.bossModel=String(shownBoss);warmBoss(shownBoss+1);
      visualAttack=null;
    }
    const attack = model.currentAttack, age = attack ? now - attack.startedAt : 0;
    const visualAge=age;
    const motion = attackMotion(attack?.answered?{...attack,answered:false}:attack,visualAge), { direction,winding,swing } = motion;
    const effectDuration=Math.max(1,(model.effectUntil||0)-(model.lastImpactAt||attack?.resolvedAt||model.effectUntil-380));
    const effect = clamp((model.effectUntil - now)/effectDuration,0,1), hit = effect > 0 && model.lastOutcome === 'miss';
    const outcome = effect ? model.lastOutcome : '';
    if (parent.dataset.outcome !== outcome) parent.dataset.outcome = outcome;
    for (const torch of torches) { const f = Math.sin(now/73 + torch.offset)*.12 + Math.sin(now/117)*.07; torch.flame.scale.set(.5-f*.15,.8+f*.5,1); if (torch.light) torch.light.intensity = 20+f*8; }
    const trajectory=swordTrajectory(motion,Math.max(0,(visualAge-(attack?.impactAtMs??Infinity))/160));
    const opponentOffset=shownBoss===3?-.48:shownBoss===5?-.42:0;
    const hand=V(...trajectory.hand),tip=V(...trajectory.tip);
    hand.z+=opponentOffset;tip.z+=opponentOffset;
    if(attack?.answered){
      const recovery=smooth((now-attack.resolvedAt)/190),deflect=Math.sin(recovery*Math.PI)*(hit?.12:.48);
      hand.lerp(V(-.06,1.35,.32+opponentOffset),recovery);tip.lerp(V(-.25,2.1,.72+opponentOffset),recovery);tip.x+=(direction==='left'?-1:1)*deflect;tip.y+=deflect*.65;
    }
    if(attack!==visualAttack){visualAttack=attack;blendHand.copy(previousHand);blendTip.copy(previousTip);}
    if(attack&&!attack.answered){
      const blend=smooth(age/120);hand.copy(blendHand.clone().lerp(hand,blend));tip.copy(blendTip.clone().lerp(tip,blend));
    }
    previousHand.copy(hand);previousTip.copy(tip);
    const recoil=effect&&!hit?Math.sin((1-effect)*Math.PI)*.11:0;
    const bodySwing=swing*(attack?.answered?effect:1),bodyWind=winding*(attack?.answered?effect:1);
    enemy.position.set(Math.sin(now/1300)*.012,-.045+Math.sin(now/700)*.005,bodySwing*.12-recoil+opponentOffset);
    enemy.rotation.set(-recoil*.22,(direction==='left'?1:-1)*bodyWind*.12*(1-bodySwing),0);
    for(const [bone,q]of bodyRest)bone.quaternion.copy(q);
    const spine=bodyBones[1];if(spine)spine.quaternion.multiply(Q().setFromEuler(new T.Euler(bodySwing*.045,-enemy.rotation.y*.4,(direction==='left'?-1:1)*bodySwing*.055)));
    if (model.phase === 'bossDeath') { const fall = smooth((now-model.bossDeathAt)/1100); enemy.rotation.x = -fall*1.35; enemy.position.y -= fall*.45; }
    for (const [bone,q] of rest) bone.quaternion.copy(q); enemy.updateMatrixWorld(true);
    const bladeRotation = Q().setFromUnitVectors(V(0,1,0),tip.clone().sub(hand).normalize());
    poseHandGrip(rightGrip,hand,bladeRotation,V(-.9,.85,.1));
    const secondHand = blade.localToWorld(V(0,-.065,0));
    poseHandGrip(leftGrip,secondHand,bladeRotation,V(.9,.85,.1));
    const [pHand,pTip] = parries[model.lastParryDirection || 'right'];
    const guardWeight=effect?Math.sin(Math.PI*Math.pow(1-effect,.45)):0;
    const ph = mix(V(.36,-.43,-.92),pHand,guardWeight), pt = mix(V(.39,.61,-1.18),pTip,guardWeight);
    const handWidth = Math.min(1,camera.aspect/1.4); ph.x *= handWidth; pt.x *= handWidth;
    player.position.copy(ph); player.quaternion.setFromUnitVectors(V(0,1,0),pt.sub(ph).normalize()); player.visible = model.phase !== 'countdown';
    playerArm.visible=player.visible;playerArm.position.copy(ph);playerArm.quaternion.setFromUnitVectors(V(0,1,0),V(.6,-.8,-.4).sub(ph).normalize());
    camera.position.x = hit ? Math.sin(now/21)*effect*.012 : 0; camera.position.y = 1.65+(hit ? Math.cos(now/25)*effect*.012 : 0); camera.rotation.z = hit ? Math.sin(now/40)*effect*.009 : 0;
    const impactAttack=model.lastImpactAttack||attack;
    if(effect&&!hit&&lastContactAttack!==impactAttack){lastContactAttack=impactAttack;contactPoint.copy(blade.localToWorld(V(0,1.05,0)));}
    flash.position.copy(contactPoint);flash.intensity=effect&&!hit?Math.pow(effect,5)*9:0;sparks.visible=effect>0&&!hit;
    dust.rotation.y=Math.sin(now/19000)*.025;dust.position.y=Math.sin(now/7000)*.035;
    if (sparks.visible) {
      const t = 1-effect;
      for (let i = 0; i < 40; i++) { const a = i*2.39996,s = .4+(i%7)*.14; positions[i*3] = contactPoint.x+Math.cos(a)*t*s; positions[i*3+1] = contactPoint.y+Math.sin(a)*t*s-t*t*.75; positions[i*3+2] = contactPoint.z+Math.sin(i*17)*t*.3; }
      sparkGeo.attributes.position.needsUpdate = true; sparkMat.opacity = Math.pow(effect,1.5);
    }
    if(backdropDirty)captureHall();
    renderer.render(scene,camera);
    const nextRatio = frameBudget.sample(now);
    if (nextRatio !== null) {renderer.setPixelRatio(nextRatio);backdropDirty=true;}
    if (debugPerformance) {
      const elapsed = now - perfPrevious; perfPrevious = now;
      if (elapsed > 0 && elapsed < 250) { perfTime += elapsed; perfCpu += performance.now() - cpuStart; perfFrames++; }
      if (perfFrames >= 60) {
        Object.assign(renderer.domElement.dataset, {renderCalls:String(renderer.info.render.calls),frameMs:(perfTime/perfFrames).toFixed(2),cpuMs:(perfCpu/perfFrames).toFixed(2),pixelRatio:renderer.getPixelRatio().toFixed(2)});
        perfFrames = perfTime = perfCpu = 0;
      }
    }
    raf = requestAnimationFrame(render);
  }
  raf = requestAnimationFrame(render);
  return {
    prepareBoss:warmBoss,
    isBossReady(number){return readyAssets.has(bossAppearance(number));},
    pause() { active = false; cancelAnimationFrame(raf); },
    resume() { if (active || destroyed) return; active = true; frameBudget.reset(); perfPrevious = 0; resize(); raf = requestAnimationFrame(render); },
    destroy() {
      destroyed = true; active = false; cancelAnimationFrame(raf); observer.disconnect();
      const geometries = new Set(),materials = new Set();
      scene.traverse((n) => { if (n.geometry) geometries.add(n.geometry); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => materials.add(m)); });
      geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); sparkMap.dispose();backdrop.dispose();environment.dispose();renderer.dispose(); renderer.domElement.remove(); delete parent.dataset.outcome;
    },
  };
}
