import { clearance, insideEllipse, type Landmark, type MapDef, type Rock, type Site, type Wall } from "./map.ts";

/**
 * The real desert, first draft (M3), built from the spec's map-design pass 0.1
 * (Part II). Every size and position here is a WORKING PROPOSAL from that pass,
 * not an approved layout.
 *
 * Spec coordinates are metres from the south-west corner of a 1,200 x 900 m box
 * with y growing north. Game coordinates are centred, x east, z south:
 *   gx = x - 600,  gz = 450 - y
 *
 *   Region (spec)                     Game area (approx.)
 *   Crescent Dunes (north)            x -200..220,  z -330..-150
 *   Twin Teeth Ridge (west)           x -420..-150, z -200..130
 *   Old Wash / Split Spire (centre)   x -200..200,  z -160..120
 *   Buried Gate Ruins (east)          x 200..430,   z -170..160
 *   Long Shadow Basin (south)         x -280..270,  z 90..310
 *
 * Collision limit: an oval of about 1,200 x 900 m. Useful interior: about
 * 1,000 x 700 m. The band between is the no-well boundary band with scorpions.
 */
const g = (x: number, y: number): Site => ({ x: x - 600, z: 450 - y });

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (e0: number, e1: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const bump = (x: number, z: number, cx: number, cz: number, sx: number, sz: number) =>
  Math.exp(-(((x - cx) / sx) ** 2) - ((z - cz) / sz) ** 2);

/** Gentle terrain: rolling dunes, a northern dune sea, a crest, a shallow wash, a basin and a raised west. */
function height(x: number, z: number): number {
  let h = 0.6 * Math.sin(x * 0.031 + 1.3) * Math.cos(z * 0.027) + 0.35 * Math.sin(x * 0.083 + z * 0.051) + 0.15 * Math.cos(x * 0.17 - z * 0.13);
  // Crescent Dunes: broader, taller dunes in the north.
  const north = smooth(-130, -230, z);
  h += north * (1.5 * Math.sin(x * 0.035 + z * 0.02) + 0.8 * Math.sin(x * 0.012 - z * 0.05));
  // Crescent Crest: a curved dune line near spec (600, 710).
  const cr = Math.hypot(x - 0, z - -190);
  h += 2.6 * Math.exp(-(((cr - 75) / 9) ** 2)) * smooth(-200, -250, z);
  // Twin Teeth Ridge: raised shelves in the west.
  h += 2.2 * bump(x, z, -300, -30, 130, 150);
  // Old Wash: a shallow dry channel crossing west-centre-east.
  const washZ = 35 * Math.sin(x / 120) + 10;
  h -= 1.3 * Math.exp(-(((z - washZ) / 14) ** 2)) * smooth(-450, -380, x) * smooth(450, 380, x);
  // Long Shadow Basin: a shallow valley with a raised south and south-west rim.
  h -= 3.2 * bump(x, z, 0, 200, 260, 85);
  h += 2.8 * bump(x, z, -60, 330, 320, 40);
  // Buried Gate: ruins sit on slightly raised ground.
  h += 0.9 * bump(x, z, 310, -20, 110, 140);
  return h;
}

// ---------- Landmarks (fixed) ----------
const LANDMARKS: Landmark[] = [
  { name: "Crescent Crest", ...g(600, 710) },
  { name: "Twin Teeth", ...g(280, 520) },
  { name: "Split Spire", ...g(600, 465) },
  { name: "Buried Gate", ...g(900, 510) },
  { name: "Fallen Dome", ...g(640, 220) },
];

const rocks: Rock[] = [];
const walls: Wall[] = [];
let rockN = 0;
let wallN = 0;
const rock = (x: number, z: number, radius: number, h: number) => rocks.push({ id: `rock-${rockN++}`, x, z, radius, height: h });
const wall = (x: number, z: number, length: number, h: number, angle: number, thickness = 1) =>
  walls.push({ id: `wall-${wallN++}`, x, z, length, thickness, height: h, angle });

// Twin Teeth: paired stone spires casting long shade north-east.
{
  const t = g(280, 520);
  rock(t.x - 8, t.z + 2, 5, 16);
  rock(t.x + 8, t.z - 2, 4.5, 14);
}
// Split Spire: a tall split rock in the open centre, visible through moderate haze; small shadow.
{
  const s = g(600, 465);
  rock(s.x - 2.6, s.z, 2.2, 12);
  rock(s.x + 2.6, s.z + 0.5, 2, 11);
}
// Fallen Dome: a big broken dome in the basin, broad but interrupted shade.
{
  const d = g(640, 220);
  rock(d.x, d.z, 9, 6);
  rock(d.x + 15, d.z - 6, 3.5, 3);
  rock(d.x - 14, d.z + 7, 3, 2.5);
}
// Buried Gate: two gate pillars with a lintel-less gap, then broken enclosures with open sides.
{
  const b = g(900, 510);
  rock(b.x - 4, b.z, 1.4, 6);
  rock(b.x + 4, b.z, 1.4, 6);
  wall(b.x - 14, b.z, 16, 3.2, 0, 1.2);
  wall(b.x + 14, b.z, 16, 3.2, 0, 1.2);
  const enclosure = (cx: number, cz: number, w: number, d: number, h: number, rot: number, open: number) => {
    // Four sides; side `open` is left out and the others have gaps, so no courtyard is sealed.
    const sides = [
      { x: 0, z: -d / 2, len: w, a: 0 },
      { x: w / 2, z: 0, len: d, a: Math.PI / 2 },
      { x: 0, z: d / 2, len: w, a: 0 },
      { x: -w / 2, z: 0, len: d, a: Math.PI / 2 },
    ];
    sides.forEach((sd, i) => {
      if (i === open) return;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const half = sd.len * 0.3;
      for (const off of [-sd.len / 2 + half / 2 + 0.5, sd.len / 2 - half / 2 - 0.5]) {
        const lx = sd.x + (sd.a === 0 ? off : 0);
        const lz = sd.z + (sd.a === 0 ? 0 : off);
        wall(cx + lx * c - lz * s, cz + lx * s + lz * c, half, h * (i % 2 === 0 ? 1 : 0.75), sd.a + rot);
      }
    });
  };
  enclosure(b.x + 30, b.z - 45, 22, 16, 2.6, 0.2, 2);
  enclosure(b.x - 40, b.z + 80, 18, 14, 2.4, -0.3, 0);
  enclosure(b.x + 60, b.z + 95, 24, 18, 2.8, 0.5, 3);
  enclosure(b.x + 85, b.z + 10, 16, 16, 2.2, -0.1, 1);
  enclosure(b.x - 20, b.z - 110, 20, 14, 2.5, 0.15, 2);
}
// Rare remnants elsewhere: broken stone walls hinting at old habitation.
wall(-150, 170, 10, 2, 0.6);
wall(-142, 178, 5, 1.4, 2.1);
wall(-60, -275, 9, 1.8, -0.4);
wall(140, 60, 8, 1.6, 1.2);

// ---------- Spawns (predefined, distributed, not in the boundary band) ----------
const SPAWNS: Site[] = [
  { x: -60, z: -40 },
  { x: 90, z: 40 },
  { x: -130, z: -240 },
  { x: 130, z: -225 },
  { x: -270, z: -150 },
  { x: -235, z: 85 },
  { x: -385, z: -5 },
  { x: 225, z: -150 },
  { x: 375, z: 125 },
  { x: 415, z: -50 },
  { x: -185, z: 205 },
  { x: 150, z: 185 },
  { x: 10, z: 290 },
  { x: -20, z: 120 },
];

// ---------- Scattered rocks per region (seeded, never on spawns or landmarks) ----------
const rnd = rng(20261121);
const INTERIOR = { rx: 500, rz: 350 };
const BOUNDARY = { rx: 600, rz: 450 };
const tmpMap = (): MapDef => ({ ...base(), rocks, walls, spawns: SPAWNS, wellSites: [], scorpions: [], landmarks: LANDMARKS });

function scatter(n: number, x0: number, x1: number, z0: number, z1: number, r0: number, r1: number, h0: number, h1: number, gap: number) {
  let placed = 0;
  for (let tries = 0; placed < n && tries < n * 200; tries++) {
    const x = x0 + rnd() * (x1 - x0);
    const z = z0 + rnd() * (z1 - z0);
    const r = r0 + rnd() * (r1 - r0);
    if (!insideEllipse(BOUNDARY, x * 1.04, z * 1.04)) continue;
    if (clearance(tmpMap(), x, z) < r + gap) continue;
    if (SPAWNS.some((s) => Math.hypot(s.x - x, s.z - z) < r + 12)) continue;
    rock(x, z, r, h0 + rnd() * (h1 - h0));
    placed++;
  }
}
scatter(70, -430, -150, -210, 140, 2, 6, 2.5, 7, 12); // Twin Teeth Ridge: shade-rich, broad passes
scatter(40, -290, 280, 95, 310, 2, 5, 2.5, 6, 16); // Long Shadow Basin
scatter(22, -200, 200, -150, 110, 1.5, 3.5, 2, 4.5, 30); // Split Spire Flats: isolated planning rocks
scatter(12, -210, 230, -340, -150, 1.5, 3, 1.8, 3.5, 45); // Crescent Dunes: few shade pockets
scatter(25, 200, 440, -180, 170, 1.2, 3, 1.5, 3.5, 8); // rubble around the ruins
scatter(40, -560, 560, -420, 420, 2, 5, 2, 6, 25); // outer band and scenery
// Keep the band rocks only where they are actually in the band or interior.
for (let i = rocks.length - 1; i >= 0; i--) if (!insideEllipse(BOUNDARY, rocks[i]!.x, rocks[i]!.z)) rocks.splice(i, 1);

// ---------- Well sites ----------
const wellSites: Site[] = [];
function siteOk(x: number, z: number, minSpacing: number) {
  return (
    insideEllipse(INTERIOR, x, z) &&
    clearance(tmpMap(), x, z) >= 4 &&
    !SPAWNS.some((s) => Math.hypot(s.x - x, s.z - z) < 25) &&
    wellSites.every((w) => Math.hypot(w.x - x, w.z - z) >= minSpacing)
  );
}
// Two reachable sites near every spawn, in different directions (first-water target).
for (const s of SPAWNS) {
  let made = 0;
  for (let tries = 0; made < 2 && tries < 400; tries++) {
    const a = rnd() * Math.PI * 2;
    const d = 45 + rnd() * 30;
    const x = s.x + Math.cos(a) * d;
    const z = s.z + Math.sin(a) * d;
    if (siteOk(x, z, 30)) {
      wellSites.push({ x, z });
      made++;
    }
  }
}
// Fill the rest of the interior.
for (let tries = 0; wellSites.length < 50 && tries < 20000; tries++) {
  const x = (rnd() * 2 - 1) * INTERIOR.rx;
  const z = (rnd() * 2 - 1) * INTERIOR.rz;
  if (siteOk(x, z, 55)) wellSites.push({ x, z });
}

// ---------- Scorpion posts on the boundary band ----------
const scorpions: Site[] = [];
for (let i = 0; i < 18; i++) {
  const a = (i / 18) * Math.PI * 2;
  scorpions.push({ x: Math.cos(a) * 555, z: Math.sin(a) * 405 });
}

function base() {
  return {
    name: "desert-v0.1",
    extent: { x: 600, z: 450 },
    boundary: BOUNDARY,
    interior: INTERIOR,
    height,
  };
}

export const DESERT: MapDef = {
  ...base(),
  rocks,
  walls,
  spawns: SPAWNS,
  wellSites,
  scorpions,
  landmarks: LANDMARKS,
};
