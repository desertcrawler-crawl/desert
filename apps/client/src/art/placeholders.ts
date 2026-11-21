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

/**
 * Slow, laboured placeholder movement. `phase` advances only while moving.
 * `upright` blends from crawling (0) to a hunched, unsteady stand (1).
 */
export function poseCrawler(rig: CrawlerRig, phase: number, breath: number, upright = 0): void {
  const s = Math.sin(phase);
  const u = upright;
  const tilt = 1.15 * u; // torso pitches up; never fully straight
  rig.body.rotation.set(tilt, 0, 0.06 * s + 0.05 * u * Math.sin(phase * 0.5)); // swaying
  rig.body.position.y = 0.5 + 0.32 * u + 0.012 * Math.sin(breath);
  rig.body.scale.y = 1 + 0.03 * Math.sin(breath);
  // Crawling: arms reach, legs drag. Upright: arms hang loosely, bent knees drag.
  rig.armL.rotation.x = (1 - u) * 0.35 * s + u * (-tilt + 0.15 * s);
  rig.armR.rotation.x = (1 - u) * -0.35 * s + u * (-tilt - 0.15 * s);
  rig.legL.rotation.x = (1 - u) * (-0.9 - 0.25 * s) + u * (-tilt + 0.25 * s);
  rig.legR.rotation.x = (1 - u) * (-0.9 + 0.25 * s) + u * (-tilt - 0.25 * s);
}

/** Sandstone strata (sRGB), bottom to top. Repeats up tall rocks. */
const STRATA = [0xc9845a, 0xdc9e6e, 0xefc18f, 0xd08c60, 0xb8704c, 0xe3a878, 0xcd8a5f].map((c) => new THREE.Color(c));

/**
 * Colours each triangle of a non-indexed geometry by the height of its centre,
 * giving the crisp horizontal bands of layered desert sandstone.
 */
function paintStrata(geo: THREE.BufferGeometry, seed: number, bandHeight: number, scaleY: number): void {
  const pos = geo.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const y = ((pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3) * scaleY;
    const wobble = 0.12 * Math.sin(seed * 7.1 + pos.getX(i) * 3.3 + pos.getZ(i) * 2.1);
    const band = Math.floor((y + wobble + seed * 0.37) / bandHeight);
    c.copy(STRATA[((band % STRATA.length) + STRATA.length) % STRATA.length]!);
    // Slight per-face variation keeps it hand-made rather than striped.
    c.offsetHSL(0, 0, 0.03 * Math.sin(seed * 13.7 + i * 0.91));
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

const strataMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

/**
 * A low-poly rock, about 2 m across and 2 m tall, origin on the ground.
 * Roughly an upright cylinder, the shape the rules use for collision and shade.
 * `aspect` (height / radius) lets tall spires get more bands than low boulders.
 */
export function buildRock(seed: number, aspect = 2): THREE.Object3D {
  const rows = THREE.MathUtils.clamp(Math.round(aspect * 2), 3, 10);
  let geo: THREE.BufferGeometry = new THREE.CylinderGeometry(0.82, 1, 2, 8, rows);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // Eroded profile: ledges in and out per row, a crumbly top.
    const ledge = 0.9 + 0.12 * Math.abs(Math.sin(seed * 12.9898 + Math.round(y * rows) * 4.1));
    const k = ledge * (0.94 + 0.08 * Math.abs(Math.sin(seed * 3.3 + i * 78.233)));
    const top = y > 0.99 ? 0.9 + 0.18 * Math.abs(Math.sin(seed * 3.1 + i)) : 1;
    pos.setXYZ(i, pos.getX(i) * k, y * top, pos.getZ(i) * k);
  }
  geo = geo.toNonIndexed();
  geo.computeVertexNormals();
  paintStrata(geo, seed, 2 / Math.max(3, rows * 0.8), 1);
  const mesh = new THREE.Mesh(geo, strataMaterial);
  mesh.position.y = 1;
  mesh.receiveShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

/**
 * A crumbling ruin wall block, 1 m long, 1 m thick and 1 m tall at scale 1; scaled per wall.
 * `length` and `height` (the size it will be stretched to) keep the stone courses square-ish.
 */
export function buildWall(seed: number, length = 4, height = 2): THREE.Object3D {
  const segX = THREE.MathUtils.clamp(Math.round(length / 0.8), 2, 24);
  const segY = THREE.MathUtils.clamp(Math.round(height / 0.45), 2, 12);
  let geo: THREE.BufferGeometry = new THREE.BoxGeometry(1, 1, 1, segX, segY, 1);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    // Ragged top edge; sides stay straight so the wall matches its collision box.
    if (pos.getY(i) > 0.49) pos.setY(i, 0.5 - 0.22 * Math.abs(Math.sin(seed * 5.3 + pos.getX(i) * 9.1)));
  }
  geo.translate(0, 0.5, 0);
  geo = geo.toNonIndexed();
  geo.computeVertexNormals();
  // Mud-brick courses: alternating tones per row, with the odd darker block.
  const p2 = geo.getAttribute("position");
  const colors = new Float32Array(p2.count * 3);
  const c = new THREE.Color();
  const base = [new THREE.Color(0xcf9a68), new THREE.Color(0xbf8657)];
  for (let i = 0; i < p2.count; i += 3) {
    const y = (p2.getY(i) + p2.getY(i + 1) + p2.getY(i + 2)) / 3;
    const x = (p2.getX(i) + p2.getX(i + 1) + p2.getX(i + 2)) / 3;
    const row = Math.floor(y * segY);
    const col = Math.floor((x + 0.5) * segX + (row % 2) * 0.5);
    c.copy(base[row % 2]!);
    const r = Math.abs(Math.sin(seed * 9.7 + row * 17.3 + col * 31.1));
    if (r > 0.85) c.multiplyScalar(0.85);
    c.offsetHSL(0, 0, 0.04 * (r - 0.5));
    // Darker, sand-stained base.
    c.lerp(new THREE.Color(0x9a6640), (1 - THREE.MathUtils.smoothstep(y, 0, 0.25)) * 0.5);
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, strataMaterial);
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
  water.name = "water";
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

/** A desert scorpion, about 0.8 m long, facing +Z, with its tail raised. */
export function buildScorpion(): THREE.Object3D {
  const g = new THREE.Group();
  const shell = flat(0x3a2414);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.45), shell);
  body.position.set(0, 0.1, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.14), shell);
  head.position.set(0, 0.1, 0.28);
  g.add(body, head);
  for (const side of [-1, 1]) {
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 4), shell);
    claw.rotation.x = Math.PI / 2;
    claw.position.set(side * 0.2, 0.1, 0.45);
    g.add(claw);
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.03), shell);
      leg.position.set(side * 0.24, 0.05, 0.12 - i * 0.12);
      leg.rotation.z = side * -0.4;
      g.add(leg);
    }
  }
  let prev: THREE.Object3D = g;
  let y = 0.12;
  let z = -0.25;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.12), shell);
    y += 0.09;
    z -= 0.03 - i * 0.04;
    seg.position.set(0, y, z);
    g.add(seg);
    prev = seg;
  }
  const sting = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), flat(0xb03a1a));
  sting.position.set(0, y + 0.06, z + 0.08);
  sting.rotation.x = 1.2;
  g.add(sting);
  void prev;
  g.traverse((o) => ((o as THREE.Mesh).isMesh && (o.castShadow = true)));
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
