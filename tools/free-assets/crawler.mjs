import * as THREE from 'three';
import { io, materials, save, hex, DL } from './lib.mjs';
import { prune, resample } from '@gltf-transform/functions';
const d = await io.read(`${DL}/t1/quaternius/universal-animation-library/Unreal-Godot/UAL1.glb`);
const root = d.getRoot();
// game clip name <- UAL clip name
const MAP = {
  crawl: 'Crawl_Fwd_Loop', crawl_idle: 'Crawl_Idle_Loop',
  walk: 'Walk_Loop', walk_idle: 'Idle_Tired_Loop',
  stand_up: 'Crawl_Exit', lie_down: 'Crawl_Enter',
  dying_breathe: 'GroundSit_Idle_Loop', slapped: 'Hit_Head',
  death: 'Death01', drink: 'Drink',
};
const want = new Map(Object.entries(MAP).map(([k, v]) => [v, k]));
for (const a of root.listAnimations()) { const n = want.get(a.getName()); if (n) a.setName(n); else { for (const s of a.listSamplers()) { s.dispose(); } for (const c of a.listChannels()) c.dispose(); a.dispose(); } }
materials(root.getDefaultScene() ? d : d, { M_Main: 0xb07850, M_Joints: 0x8a7458 });
// Long white hair and beard, rigid on the head bone.
const head = root.listNodes().find(n => n.getName() === 'Head');
const hw = new THREE.Matrix4().fromArray(head.getWorldMatrix()); const inv = hw.clone().invert();
const hp = new THREE.Vector3().setFromMatrixPosition(hw);
console.log('head world pos', hp.toArray().map(v=>v.toFixed(3)).join(' '));
const hairMat = d.createMaterial('M_Hair').setBaseColorFactor([...hex(0xf4f1ea), 1]).setRoughnessFactor(1).setMetallicFactor(0);
function addPart(name, geo, worldPos, rotEuler) {
  geo = geo.toNonIndexed(); geo.computeVertexNormals();
  const m = new THREE.Matrix4().compose(worldPos, new THREE.Quaternion().setFromEuler(rotEuler), new THREE.Vector3(1,1,1));
  geo.applyMatrix4(inv.clone().multiply(m));
  geo.computeVertexNormals();
  const buf = d.getRoot().listBuffers()[0];
  const pos = d.createAccessor().setType('VEC3').setArray(new Float32Array(geo.attributes.position.array)).setBuffer(buf);
  const nor = d.createAccessor().setType('VEC3').setArray(new Float32Array(geo.attributes.normal.array)).setBuffer(buf);
  const prim = d.createPrimitive().setAttribute('POSITION', pos).setAttribute('NORMAL', nor).setMaterial(hairMat);
  const node = d.createNode(name).setMesh(d.createMesh(name).addPrimitive(prim));
  head.addChild(node);
}
globalThis.addPart = addPart; globalThis.hp = hp;
const P = (x, y, z) => new THREE.Vector3(hp.x + x, hp.y + y, hp.z + z);
const E = (x, y, z) => new THREE.Euler(x, y, z);
const FACE = +(process.env.FACE || 1); // +1: model faces +Z
// Hair: a cap over the skull and a long tail of hair down the back.
addPart('Hair_Cap', new THREE.SphereGeometry(0.115, 7, 5, 0, Math.PI*2, 0, Math.PI*0.55), P(0, 0.09, -0.01*FACE), E(-0.2*FACE, 0, 0));
addPart('Hair_Long', new THREE.ConeGeometry(0.1, 0.45, 6), P(0, -0.02, -0.08*FACE), E(Math.PI + 0.25*FACE, 0, 0));
// Beard: hangs from the chin to mid-chest.
addPart('Beard', new THREE.ConeGeometry(0.075, 0.32, 5), P(0, -0.06, 0.07*FACE), E(Math.PI - 0.15*FACE, 0, 0));
await d.transform(resample({ tolerance: 1e-4 }), prune());
await save(d, 'crawler');
for (const a of root.listAnimations()) console.log(a.getName(), a.listChannels().length);
