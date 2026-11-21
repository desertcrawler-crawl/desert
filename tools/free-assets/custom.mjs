// Simple low-poly models made from scratch for slots with no free model in reach. CC0.
import * as THREE from 'three';
import { Document } from '@gltf-transform/core';
import { save, hex, eulerQ } from './lib.mjs';

function kit() {
  const d = new Document(); const buf = d.createBuffer(); const scene = d.createScene('Scene'); d.getRoot().setDefaultScene(scene);
  const mats = {};
  const mat = (name, c) => mats[name] ??= d.createMaterial(name).setBaseColorFactor([...hex(c), 1]).setRoughnessFactor(1).setMetallicFactor(0);
  const mesh = (name, geo, m) => {
    geo = geo.index ? geo.toNonIndexed() : geo; geo.computeVertexNormals();
    const p = d.createPrimitive()
      .setAttribute('POSITION', d.createAccessor().setType('VEC3').setArray(new Float32Array(geo.attributes.position.array)).setBuffer(buf))
      .setAttribute('NORMAL', d.createAccessor().setType('VEC3').setArray(new Float32Array(geo.attributes.normal.array)).setBuffer(buf))
      .setMaterial(m);
    return d.createMesh(name).addPrimitive(p);
  };
  const node = (name, parent, { geo, m, pos = [0,0,0], rot = [0,0,0], scale } = {}) => {
    const n = d.createNode(name).setTranslation(pos).setRotation(eulerQ(...rot));
    if (scale) n.setScale(scale);
    if (geo) n.setMesh(mesh(name, geo, m));
    (parent ?? scene).addChild(n); return n;
  };
  // Rotation keyframes for one node: list of [time, [x,y,z] euler].
  const rotTrack = (anim, n, keys) => {
    const s = d.createAnimationSampler().setInterpolation('LINEAR')
      .setInput(d.createAccessor().setType('SCALAR').setArray(new Float32Array(keys.map(k => k[0]))).setBuffer(buf))
      .setOutput(d.createAccessor().setType('VEC4').setArray(new Float32Array(keys.flatMap(k => eulerQ(...k[1])))).setBuffer(buf));
    anim.addSampler(s).addChannel(d.createAnimationChannel().setTargetNode(n).setTargetPath('rotation').setSampler(s));
  };
  return { d, mat, node, rotTrack, scene };
}
// Randomise vertices a little so shapes look hand-made, not perfect.
function jitter(geo, amt, seed = 1) {
  const p = geo.attributes.position; const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(4)).join();
    if (!seen.has(key)) { const h = Math.sin(seed * 91.7 + seen.size * 12.9898) * 43758.5453; const r = (k) => (Math.sin(h * k) * amt); seen.set(key, [r(1.1), r(2.3) * 0.5, r(3.7)]); }
    const o = seen.get(key); p.setXYZ(i, p.getX(i) + o[0], p.getY(i) + o[1], p.getZ(i) + o[2]);
  }
  return geo;
}

// ---------- WELL: dry-stone ring, two posts, crossbeam, rope and bucket. ~2.4 m tall, 2 m across.
{
  const { d, mat, node } = kit();
  const stone = mat('stone', 0xb88a5c), stoneDark = mat('stoneDark', 0x8f6a48), wood = mat('wood', 0x7a5a3c), rope = mat('rope', 0xc8b08a), water = mat('water', 0x2f6d8c);
  const root = node('Well');
  const N = 11;
  for (let row = 0; row < 3; row++) for (let i = 0; i < N; i++) {
    const a = (i + (row % 2) * 0.5) / N * Math.PI * 2;
    const g = jitter(new THREE.BoxGeometry(0.5, 0.26, 0.3), 0.025, row * 31 + i);
    node(`stone_${row}_${i}`, root, { geo: g, m: (i + row) % 3 ? stone : stoneDark, pos: [Math.cos(a) * 0.82, 0.13 + row * 0.25, Math.sin(a) * 0.82], rot: [0, -a + Math.PI / 2, 0] });
  }
  // The game looks for the mesh named 'water' and turns it dry when someone drinks.
  node('water', root, { geo: new THREE.CylinderGeometry(0.7, 0.7, 0.05, 12), m: water, pos: [0, 0.5, 0] });
  for (const x of [-0.82, 0.82]) node(`post${x > 0 ? 'R' : 'L'}`, root, { geo: jitter(new THREE.BoxGeometry(0.14, 2.2, 0.14), 0.01, x * 10), m: wood, pos: [x, 1.1, 0], rot: [0, 0, x * -0.03] });
  node('beam', root, { geo: new THREE.CylinderGeometry(0.07, 0.07, 1.9, 6), m: wood, pos: [0, 2.05, 0], rot: [0, 0, Math.PI / 2] });
  node('crank', root, { geo: new THREE.BoxGeometry(0.06, 0.3, 0.06), m: wood, pos: [1.0, 1.92, 0] });
  node('rope', root, { geo: new THREE.CylinderGeometry(0.015, 0.015, 0.9, 4), m: rope, pos: [0, 1.58, 0] });
  node('bucket', root, { geo: new THREE.CylinderGeometry(0.16, 0.12, 0.26, 7), m: wood, pos: [0, 1.0, 0] });
  node('bucketBand', root, { geo: new THREE.CylinderGeometry(0.165, 0.165, 0.04, 7), m: stoneDark, pos: [0, 1.08, 0] });
  root.setScale([0.78, 0.78, 0.78]); // 1.6 m across
  await save(d, 'well');
}

// ---------- SCORPION: segmented body, pincers, 8 legs, curled tail with stinger. ~0.6 m long (big, game-readable).
{
  const { d, mat, node, rotTrack } = kit();
  const shell = mat('shell', 0x6b4a2a), shellLight = mat('shellLight', 0x9a6a3a), sting = mat('stinger', 0x2a1a10);
  const root = node('Scorpion');
  const body = node('body', root, { pos: [0, 0.09, 0] });
  // Faces +Z: head and pincers at +Z, tail at -Z.
  node('head', body, { geo: jitter(new THREE.BoxGeometry(0.16, 0.06, 0.12), 0.006, 3), m: shell, pos: [0, 0, 0.14] });
  for (let i = 0; i < 4; i++) node(`seg${i}`, body, { geo: new THREE.BoxGeometry(0.2 - i * 0.012, 0.07, 0.075), m: i % 2 ? shellLight : shell, pos: [0, 0.005, 0.05 - i * 0.07] });
  // Tail: chain of segments, each a child of the last, curling up and over.
  let parent = node('tail0', body, { pos: [0, 0.02, -0.2] });
  const tail = [parent];
  for (let i = 0; i < 5; i++) {
    const seg = node(`tailSeg${i}`, parent, { geo: new THREE.BoxGeometry(0.06 - i * 0.004, 0.06 - i * 0.004, 0.08), m: i % 2 ? shellLight : shell, pos: [0, 0, -0.04] });
    parent = node(`tail${i + 1}`, parent, { pos: [0, 0, -0.08], rot: [i < 4 ? 0.62 : 0.4, 0, 0] });
    tail.push(parent);
  }
  const stinger = node('stinger', parent, { geo: new THREE.ConeGeometry(0.025, 0.08, 5), m: sting, pos: [0, 0.02, -0.03], rot: [-0.8, 0, 0] });
  // Pincers.
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = node(`arm${s > 0 ? 'R' : 'L'}`, body, { pos: [s * 0.07, 0, 0.18], rot: [0, s * 0.5, 0] });
    node(`upper${s}`, arm, { geo: new THREE.BoxGeometry(0.035, 0.03, 0.12), m: shell, pos: [0, 0, 0.06] });
    const fore = node(`fore${s}`, arm, { pos: [0, 0, 0.12], rot: [0, -s * 1.0, 0] });
    node(`claw${s}`, fore, { geo: jitter(new THREE.BoxGeometry(0.07, 0.04, 0.1), 0.005, s + 9), m: shellLight, pos: [0, 0, 0.06] });
    node(`fingerA${s}`, fore, { geo: new THREE.ConeGeometry(0.015, 0.08, 4), m: shell, pos: [s * 0.018, 0, 0.14], rot: [Math.PI / 2, 0, 0] });
    node(`fingerB${s}`, fore, { geo: new THREE.ConeGeometry(0.012, 0.07, 4), m: shell, pos: [-s * 0.018, 0, 0.135], rot: [Math.PI / 2, 0, 0] });
    arms.push(arm);
  }
  // Legs: 4 per side, hip pivot on the body, bent down to the sand.
  const legs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const hip = node(`leg${s > 0 ? 'R' : 'L'}${i}`, body, { pos: [s * 0.09, 0, 0.08 - i * 0.065], rot: [0, s * (0.3 - i * 0.25), 0] });
    node(`thigh${s}${i}`, hip, { geo: new THREE.BoxGeometry(0.1, 0.018, 0.018), m: shell, pos: [s * 0.05, 0.02, 0], rot: [0, 0, s * 0.45] });
    node(`shin${s}${i}`, hip, { geo: new THREE.BoxGeometry(0.018, 0.12, 0.018), m: shellLight, pos: [s * 0.11, -0.04, 0], rot: [0, 0, s * -0.35] });
    legs.push({ hip, s, i, base: s * (0.3 - i * 0.25) });
  }
  // Animations: idle (tail sway), walk (alternating legs), sting (tail strike).
  const idle = d.createAnimation('idle'), walk = d.createAnimation('walk'), attack = d.createAnimation('sting');
  const tBase = (i) => [i < 4 ? 0.62 : 0.4, 0, 0];
  for (let i = 1; i < tail.length; i++) {
    const b = tBase(i - 1);
    rotTrack(idle, tail[i], [[0, b], [1, [b[0] + 0.06, 0.05, 0]], [2, b], [3, [b[0] - 0.04, -0.05, 0]], [4, b]]);
    rotTrack(attack, tail[i], [[0, b], [0.25, [b[0] + 0.25, 0, 0]], [0.4, [b[0] - 0.35, 0, 0]], [0.8, b]]);
  }
  for (const { hip, s, i, base } of legs) {
    const ph = (i % 2 === (s > 0 ? 0 : 1)) ? 0 : 1;
    const k = [0, 0.2, 0.4].map((t, j) => [t, [0, base + (j === 1 ? (ph ? 0.35 : -0.35) : (ph ? -0.35 : 0.35)) * 0.6, j === 1 ? 0 : 0]]);
    rotTrack(walk, hip, [[0, [0, base + (ph ? 0.2 : -0.2), 0]], [0.2, [ph ? 0.15 : 0, base + (ph ? -0.2 : 0.2), 0]], [0.4, [0, base + (ph ? 0.2 : -0.2), 0]]]);
  }
  for (const [j, arm] of arms.entries()) {
    const s = j ? 1 : -1;
    rotTrack(idle, arm, [[0, [0, s * 0.5, 0]], [2, [0.08, s * 0.42, 0]], [4, [0, s * 0.5, 0]]]);
    rotTrack(attack, arm, [[0, [0, s * 0.5, 0]], [0.25, [0, s * 0.8, 0]], [0.45, [0, s * 0.2, 0]], [0.8, [0, s * 0.5, 0]]]);
  }
  root.setScale([0.95, 0.95, 0.95]); // about 0.8 m long with the tail
  await save(d, 'scorpion');
}

// ---------- SKELETON: lying on its back, head towards +Z, about 1.7 m long.
// Every bone group is a direct child of the scene (the game bounces them when slapped); the head is "skull".
{
  const { d, mat, node, scene } = kit();
  const bone = mat('bone', 0xe6dcc2), socket = mat('socket', 0x3a2a1c);
  const Y = 0.05;
  const skull = node('skull', null, { pos: [0, 0.11, 0.74] });
  node('cranium', skull, { geo: jitter(new THREE.IcosahedronGeometry(0.11, 1), 0.006, 4), m: bone, scale: [0.95, 0.85, 1.1] });
  node('jaw', skull, { geo: new THREE.BoxGeometry(0.11, 0.05, 0.07), m: bone, pos: [0, -0.02, 0.1], rot: [0.3, 0, 0] });
  for (const s of [-1, 1]) node(`eye${s}`, skull, { geo: new THREE.SphereGeometry(0.025, 5, 4), m: socket, pos: [s * 0.04, 0.06, 0.08] });
  const spine = node('spine', null, { geo: new THREE.CylinderGeometry(0.022, 0.022, 0.62, 5), m: bone, pos: [0, Y, 0.32], rot: [Math.PI / 2, 0, 0] });
  const ribs = node('ribs', null, { pos: [0, Y, 0.42] });
  for (let i = 0; i < 5; i++) {
    const r = 0.15 - i * 0.012;
    node(`rib${i}`, ribs, { geo: new THREE.TorusGeometry(r, 0.012, 3, 10, Math.PI), m: bone, pos: [0, 0.02, 0.1 - i * 0.055], rot: [0, 0, 0], scale: [1, 0.7, 1] });
  }
  node('pelvis', null, { geo: jitter(new THREE.CylinderGeometry(0.15, 0.11, 0.08, 6), 0.008, 7), m: bone, pos: [0, Y, 0.0], scale: [1, 0.6, 0.8] });
  const limb = (name, x, z, len, rotY, r = 0.022) => node(name, null, { geo: new THREE.CylinderGeometry(r, r * 0.85, len, 5), m: bone, pos: [x, 0.03, z], rot: [Math.PI / 2, rotY, 0] });
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'L' : 'R';
    limb(`upperArm${side}`, s * 0.22, 0.42, 0.3, s * 0.25);
    limb(`foreArm${side}`, s * 0.3, 0.14, 0.27, s * 0.05, 0.016);
    node(`hand${side}`, null, { geo: jitter(new THREE.BoxGeometry(0.07, 0.025, 0.09), 0.006, 3 + s), m: bone, pos: [s * 0.32, 0.02, -0.03] });
    limb(`thigh${side}`, s * 0.1, -0.24, 0.42, -s * 0.08, 0.026);
    limb(`shin${side}`, s * 0.14, -0.66, 0.4, -s * 0.05, 0.02);
    node(`foot${side}`, null, { geo: jitter(new THREE.BoxGeometry(0.08, 0.04, 0.16), 0.006, 9 + s), m: bone, pos: [s * 0.16, 0.025, -0.88], rot: [0, 0, s * 0.4] });
  }
  await save(d, 'skeleton');
}

// ---------- WALL: one ruin wall block, 1 m long (X), 1 m thick, 1 m tall, stretched per wall by the map.
// Stacked sandstone blocks with worn edges; nothing sticks out past the 1 m box (it matches the collision box).
{
  const { d, mat, node } = kit();
  const stone = mat('stone', 0xc08a5a), stoneDark = mat('stoneDark', 0xa5744a), stoneLight = mat('stoneLight', 0xd2a070);
  const root = node('Wall');
  const rows = 4, h = 1 / rows;
  for (let r = 0; r < rows; r++) {
    const n = r % 2 ? 3 : 2; const off = r % 2 ? 0 : 0;
    const widths = n === 2 ? [0.5, 0.5] : [0.25, 0.5, 0.25];
    let x = -0.5;
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i];
      // Top row is broken: some blocks shorter or missing.
      let bh = h; if (r === rows - 1) { if ((i + 1) % 3 === 0) { x += w; continue; } bh = h * (0.55 + 0.4 * ((i * 7) % 3) / 2); }
      const g = new THREE.BoxGeometry(w - 0.02, bh - 0.02, 0.98);
      // Wear: pull corners inwards a little (never outwards).
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const s = Math.sin((r * 13 + i * 7 + k) * 12.9898) * 0.5 + 0.5;
        p.setXYZ(k, p.getX(k) * (1 - 0.06 * s), p.getY(k) * (1 - 0.08 * s), p.getZ(k) * (1 - 0.02 * s));
      }
      node(`block_${r}_${i}`, root, { geo: g, m: [stone, stoneDark, stoneLight][(r + i) % 3], pos: [x + w / 2, r * h + bh / 2, 0] });
      x += w;
    }
  }
  await save(d, 'ruin_wall');
}
