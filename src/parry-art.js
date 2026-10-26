import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Bake decorative pieces together: detail should not mean a draw call per rivet.
function assembly(material, pieces) {
  const geometries = pieces.map(([geometry, position = [0,0,0], rotation = [0,0,0], scale = [1,1,1]]) => {
    const matrix = new T.Matrix4().compose(new T.Vector3(...position),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(...scale));
    const result = geometry.index ? geometry.toNonIndexed() : geometry;
    result.applyMatrix4(matrix); result.deleteAttribute('uv');
    if (result !== geometry) geometry.dispose();
    return result;
  });
  const merged = mergeGeometries(geometries);
  geometries.forEach(g => g.dispose());
  return new T.Mesh(merged,material);
}

export function createSword() {
  const sword = new T.Group();
  const steel = new T.MeshStandardMaterial({color:0x7e8c98,metalness:.95,roughness:.3,flatShading:true});
  const darkSteel = new T.MeshStandardMaterial({color:0x5f6669,metalness:.88,roughness:.36});
  const leather = new T.MeshStandardMaterial({color:0x211d19,roughness:.9});
  const blade = new T.BufferGeometry();
  blade.setAttribute('position',new T.Float32BufferAttribute([-.032,.16,0, 0,.16,.012, .032,.16,0, 0,.16,-.012, -.022,1.08,0, 0,1.08,.008, .022,1.08,0, 0,1.08,-.008, 0,1.25,0],3));
  blade.setIndex([0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,8,5,5,8,6,6,8,7,7,8,4]); blade.computeVertexNormals();
  sword.add(new T.Mesh(blade,steel));
  const guard = new T.Shape();
  guard.moveTo(-.19,-.035); guard.lineTo(-.17,.015); guard.lineTo(-.06,.035); guard.lineTo(.06,.035); guard.lineTo(.17,.015); guard.lineTo(.19,-.035); guard.lineTo(.15,-.018); guard.lineTo(.055,.002); guard.lineTo(-.055,.002); guard.lineTo(-.15,-.018); guard.closePath();
  const metal = [[new T.ExtrudeGeometry(guard,{depth:.033,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.005,bevelThickness:.004}),[0,.13,-.016]],
    [new T.SphereGeometry(.035,10,6),[0,-.16,0],[0,0,0],[1,.8,.6]]];
  for (const y of [-.12,.095]) metal.push([new T.CylinderGeometry(.027,.027,.012,10),[0,y,0]]);
  sword.add(assembly(darkSteel,metal));
  const wraps = [[new T.CylinderGeometry(.023,.021,.22,10),[0,-.015,0]]];
  for(let i=0;i<8;i++) wraps.push([new T.TorusGeometry(.023,.0017,3,10),[0,-.105+i*.025,0],[Math.PI/2,0,0]]);
  sword.add(assembly(leather,wraps));
  sword.traverse(n=>{if(n.isMesh)n.castShadow=true;});
  return sword;
}

export function createGauntlet(sword,camera) {
  const leather = new T.MeshStandardMaterial({color:0x211f1d,roughness:.94});
  const plate = new T.MeshStandardMaterial({color:0x56616b,metalness:.85,roughness:.42});
  const palm = [[new T.SphereGeometry(.06,12,8),[0,-.025,.045],[0,0,0],[1,1.25,.55]]];
  const plates = [[new T.BoxGeometry(.095,.09,.022),[0,-.027,.073],[0,0,-.06]]];
  for(let i=0;i<4;i++) {
    palm.push([new T.CapsuleGeometry(.013,.055,3,6),[-.012,.04-i*.028,-.01],[0,0,Math.PI/2]]);
    plates.push([new T.SphereGeometry(.016,6,4),[-.047,.04-i*.028,.022],[0,0,0],[.65,.85,1]]);
  }
  palm.push([new T.CapsuleGeometry(.017,.055,3,6),[.052,.005,.024],[0,.5,-.65]]);
  sword.add(assembly(leather,palm),assembly(plate,plates));
  const arm = new T.Group(); camera.add(arm);
  arm.add(assembly(leather,[[new T.CylinderGeometry(.067,.1,.44,12),[0,.25,0]]]));
  const cuffs = [[new T.CylinderGeometry(.075,.08,.14,12),[0,.075,0]]];
  for(const y of [.01,.14]) cuffs.push([new T.TorusGeometry(.076,.004,4,12),[0,y,0],[Math.PI/2,0,0]]);
  arm.add(assembly(plate,cuffs));
  return arm;
}

export function metalEnvironment(renderer,scene) {
  const room = new RoomEnvironment(), generator = new T.PMREMGenerator(renderer);
  const target = generator.fromScene(room,.06,.1,30,{size:128});
  scene.environment = target.texture; scene.environmentIntensity = .28;
  room.dispose(); generator.dispose();
  return target;
}

export function duelAtmosphere(scene) {
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=64;
  const c=canvas.getContext('2d'), glow=c.createRadialGradient(32,32,1,32,32,32);
  glow.addColorStop(0,'#000000aa');glow.addColorStop(1,'#00000000');c.fillStyle=glow;c.fillRect(0,0,64,64);
  const map=new T.CanvasTexture(canvas);
  const shadow=new T.Mesh(new T.PlaneGeometry(1.5,1.1),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.set(0,.012,0);scene.add(shadow);
  const dustPositions=new Float32Array(54*3);
  for(let i=0;i<54;i++){dustPositions[i*3]=Math.sin(i*32.17)*4;dustPositions[i*3+1]=.4+(i%17)*.21;dustPositions[i*3+2]=-1-(i%9)*.7;}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(dustPositions,3));
  const dust=new T.Points(geometry,new T.PointsMaterial({color:0xa8b6bd,size:.012,transparent:true,opacity:.28,depthWrite:false}));scene.add(dust);
  return dust;
}

export function sparkTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
  const context=canvas.getContext('2d'),glow=context.createRadialGradient(16,16,0,16,16,16);
  glow.addColorStop(0,'#fff9df');glow.addColorStop(.16,'#ffe3a0');glow.addColorStop(.4,'#ffad4870');glow.addColorStop(1,'#ff710000');
  context.fillStyle=glow;context.fillRect(0,0,32,32);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}
