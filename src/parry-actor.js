import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createHandGrip,attachSword,findBone,poseArm} from './parry-rig.js';
import {createSword} from './parry-art.js';

export const bossAppearance = boss => Math.max(1,Math.min(6,Math.floor(boss)||1));
const heights=[1.98,2.04,2.18,2.13,2.24,2.34];

export function createKnightActor(gltf,boss=1) {
  const group=new T.Group(),rig=clone(gltf.scene);
  const bounds=new T.Box3().setFromObject(rig),size=bounds.getSize(new T.Vector3());
  rig.scale.setScalar(heights[bossAppearance(boss)-1]/size.y);
  const center=bounds.getCenter(new T.Vector3()).multiplyScalar(rig.scale.x);
  rig.position.set(-center.x,-bounds.min.y*rig.scale.x,-center.z);
  rig.traverse(node=>{if(node.isMesh)node.castShadow=node.receiveShadow=true;});
  group.add(rig);group.updateMatrixWorld(true);
  const rightGrip=createHandGrip(rig,'Right'),leftGrip=createHandGrip(rig,'Left');
  const rest=[rightGrip,leftGrip].flatMap(({upper,lower,hand})=>[upper,lower,hand].map(bone=>[bone,bone.quaternion.clone()]));
  const bodyBones=['Spine','Spine1','Spine2','Head'].map(name=>findBone(rig,name)).filter(Boolean);
  const bodyRest=bodyBones.map(bone=>[bone,bone.quaternion.clone()]);
  const legs=['Left','Right'].map((side,index)=>{
    const [upper,lower,foot]=['UpLeg','Leg','Foot'].map(name=>findBone(rig,side+name));
    if(!upper||!lower||!foot)return null;
    const target=foot.getWorldPosition(new T.Vector3());target.x+=(Math.sign(target.x)||1)*.12;target.z+=index===0?.13:-.1;
    return {upper,lower,foot,target,rotation:foot.getWorldQuaternion(new T.Quaternion()),rest:[upper,lower,foot].map(bone=>[bone,bone.quaternion.clone()])};
  }).filter(Boolean);
  // Bake the stationary combat stance once; only the upper body animates.
  for(const leg of legs){
    poseArm(leg.upper,leg.lower,leg.foot,leg.target,new T.Vector3(leg.target.x,.5,1));
    leg.foot.quaternion.copy(leg.foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(leg.rotation));
  }
  group.updateMatrixWorld(true);
  const blade=attachSword(rightGrip,createSword());
  return {group,rig,rightGrip,leftGrip,rest,bodyBones,bodyRest,legs,blade};
}

export function disposeKnightActor(actor) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  actor.group.traverse(node=>{
    if(node.geometry)geometries.add(node.geometry);
    for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){
      materials.add(material);
      for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    }
  });
  geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());textures.forEach(item=>item.dispose());
  actor.group.removeFromParent();
}
