import * as THREE from "three";

/**
 * Code-built low-poly placeholders. They follow the same conventions as the
 * real .glb art (metres, facing +Z like any standard glTF, origin on the ground)
 * so swapping is drop-in.
 */

const flat = (color: number) => new THREE.MeshLambertMaterial({ color, flatShading: true });

const SKIN = 0xc98e62;
const RAGS = 0x8a7458;
const HAIR = 0xf4f1ea;

/** Names of the parts the placeholder crawl animation moves. */
export interface CrawlerRig {
  root: THREE.Group;
  body: THREE.Group;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
}

function limb(length: number, radius: number, color: number): THREE.Group {
  // Pivot at the top so rotating it swings the limb.
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.8, length, 5), flat(color));
  m.position.y = -length / 2;
  m.castShadow = true;
  g.add(m);
  return g;
}

/** A frail figure on hands and knees, roughly 0.6 m high, facing +Z. */
export function buildCrawler(): CrawlerRig {
  const root = new THREE.Group();
  // Parts below are laid out facing -Z; turn the whole figure to the glTF standard +Z.
  root.rotation.y = Math.PI;
  const body = new THREE.Group();
  body.position.y = 0.5;
  root.add(body);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.62), flat(RAGS));
  torso.rotation.x = 0.08;
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), flat(SKIN));
  head.position.set(0, 0.04, -0.42);
  head.castShadow = true;
  body.add(head);

  const hair = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 6), flat(HAIR));
  hair.rotation.x = Math.PI / 2 + 0.25;
  hair.position.set(0, 0.08, -0.22);
  body.add(hair);

  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 5), flat(HAIR));
  beard.rotation.x = Math.PI - 0.35;
  beard.position.set(0, -0.14, -0.48);
  body.add(beard);

  const armL = limb(0.5, 0.035, SKIN);
  armL.position.set(-0.16, 0, -0.26);
  const armR = limb(0.5, 0.035, SKIN);
  armR.position.set(0.16, 0, -0.26);
  const legL = limb(0.5, 0.05, RAGS);
  legL.position.set(-0.12, 0, 0.26);
  legL.rotation.x = -0.9;
  const legR = limb(0.5, 0.05, RAGS);
  legR.position.set(0.12, 0, 0.26);
  legR.rotation.x = -0.9;
  body.add(armL, armR, legL, legR);

  return { root, body, armL, armR, legL, legR };
}

/** Slow, laboured placeholder crawl cycle. `phase` advances only while moving. */
export function poseCrawler(rig: CrawlerRig, phase: number, breath: number): void {
  const s = Math.sin(phase);
  rig.armL.rotation.x = 0.35 * s;
  rig.armR.rotation.x = -0.35 * s;
  rig.legL.rotation.x = -0.9 - 0.25 * s;
  rig.legR.rotation.x = -0.9 + 0.25 * s;
  rig.body.rotation.z = 0.06 * s;
  // Heavy breathing, always.
  rig.body.position.y = 0.5 + 0.012 * Math.sin(breath);
  rig.body.scale.y = 1 + 0.03 * Math.sin(breath);
}

/** An irregular low-poly rock, about 2 m across and 2 m tall, origin on the ground. */
export function buildRock(seed: number): THREE.Object3D {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const k = 0.75 + 0.35 * Math.abs(Math.sin(seed * 12.9898 + i * 78.233));
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, flat(0xa4683f));
  mesh.position.y = 0.7;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}
