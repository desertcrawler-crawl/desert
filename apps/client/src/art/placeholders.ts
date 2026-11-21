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

/**
 * A low-poly rock, about 2 m across and 2 m tall, origin on the ground.
 * Roughly an upright cylinder, the shape the rules use for collision and shade.
 */
export function buildRock(seed: number): THREE.Object3D {
  const geo = new THREE.CylinderGeometry(0.85, 1, 2, 7, 2);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const k = 0.92 + 0.1 * Math.abs(Math.sin(seed * 12.9898 + i * 78.233));
    const top = pos.getY(i) > 0.9 ? 0.9 + 0.2 * Math.abs(Math.sin(seed * 3.1 + i)) : 1;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * top, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, flat(0xa4683f));
  mesh.position.y = 1;
  mesh.receiveShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

/** A small stone well with dark water, about 1.6 m across. */
export function buildWell(): THREE.Object3D {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.5, 8, 1, true), flat(0x9c8a72));
  ring.position.y = 0.25;
  (ring.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.1, 4, 8), flat(0x8a785f));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.5;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.72, 8), new THREE.MeshLambertMaterial({ color: 0x2f6d8c }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.38;
  for (const m of [ring, rim]) m.castShadow = true;
  g.add(ring, rim, water);
  return g;
}

const BONE = 0xeee6d2;

/** A skeleton lying on its back, about 1.7 m long, head towards +Z (the glTF forward). */
export function buildSkeleton(): THREE.Object3D {
  const g = new THREE.Group();
  const bone = flat(BONE);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), bone);
  skull.position.set(0, 0.12, 0.75);
  skull.name = "skull";
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.6), bone);
  spine.position.set(0, 0.06, 0.32);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.12), bone);
  pelvis.position.set(0, 0.06, 0);
  g.add(skull, spine, pelvis);
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.32 - i * 0.03, 0.04, 0.03), bone);
    rib.position.set(0, 0.08, 0.5 - i * 0.08);
    g.add(rib);
  }
  const limb = (x: number, z: number, len: number, rotY: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, len), bone);
    m.position.set(x, 0.04, z);
    m.rotation.y = rotY;
    g.add(m);
  };
  limb(-0.25, 0.42, 0.5, 0.5);
  limb(0.25, 0.42, 0.5, -0.5);
  limb(-0.12, -0.38, 0.75, 0.12);
  limb(0.12, -0.38, 0.75, -0.12);
  g.traverse((o) => ((o as THREE.Mesh).isMesh && ((o.castShadow = true), (o.receiveShadow = true))));
  return g;
}

/** A simple wooden cross about 1.1 m tall. */
export function buildCross(): THREE.Object3D {
  const g = new THREE.Group();
  const wood = flat(0x6e4a2b);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), wood);
  post.position.y = 0.55;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), wood);
  bar.position.y = 0.82;
  post.castShadow = bar.castShadow = true;
  g.add(post, bar);
  return g;
}

/** Placeholder pose for the terminal state: on the back, breathing that weakens. */
export function poseLying(rig: CrawlerRig, breath: number, strength: number, twitch: number): void {
  rig.body.rotation.set(0, 0, Math.PI);
  rig.body.position.y = 0.22 + 0.01 * strength * Math.sin(breath);
  rig.body.scale.y = 1 + 0.05 * strength * Math.sin(breath);
  rig.armL.rotation.x = 1.3 + 0.12 * twitch;
  rig.armR.rotation.x = 1.3 - 0.1 * twitch;
  rig.legL.rotation.x = -1.4;
  rig.legR.rotation.x = -1.4 + 0.08 * twitch;
}
