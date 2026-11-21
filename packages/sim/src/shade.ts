import { wallLocal, type MapDef, type Rock, type Wall } from "./map.ts";
import { SUN } from "./sun.ts";
import { TUNING } from "./tuning.ts";
import { WORLD } from "./world.ts";

const HORIZ = Math.hypot(SUN.x, SUN.z);
/** Unit vector along the ground towards the sun, and how fast a sun ray rises per metre. */
const DX = SUN.x / HORIZ;
const DZ = SUN.z / HORIZ;
const RISE = SUN.y / HORIZ;

/**
 * Is a body at (x, z) in protective shade?
 *
 * Casts a ray from the body (TUNING.shade.bodyHeight above the ground)
 * towards the fixed sun and checks whether a rock or wall blocks it. These are
 * the same shapes used for collision. Only map objects count: players, crosses
 * and scorpions never make shade (spec working proposal).
 */
export function isShadedExact(x: number, z: number, map: MapDef = WORLD): boolean {
  const y0 = map.height(x, z) + TUNING.shade.bodyHeight;
  return map.rocks.some((r) => rockShades(map, r, x, z, y0)) || map.walls.some((w) => wallShades(map, w, x, z, y0));
}

function rockShades(map: MapDef, rock: Rock, x: number, z: number, y0: number): boolean {
  const cx = rock.x - x;
  const cz = rock.z - z;
  const along = cx * DX + cz * DZ;
  const perp2 = cx * cx + cz * cz - along * along;
  const r2 = rock.radius * rock.radius;
  if (perp2 > r2) return false;
  const half = Math.sqrt(r2 - perp2);
  if (along + half < 0) return false; // behind us, away from the sun
  const entry = Math.max(0, along - half);
  return y0 + entry * RISE <= map.height(rock.x, rock.z) + rock.height;
}

function wallShades(map: MapDef, w: Wall, x: number, z: number, y0: number): boolean {
  // Ray in the wall's frame; slab test against the box footprint.
  const p = wallLocal(w, x, z);
  const c = Math.cos(w.angle);
  const s = Math.sin(w.angle);
  const du = DX * c + DZ * s;
  const dv = -DX * s + DZ * c;
  let t0 = 0;
  let t1 = Infinity;
  for (const [o, d, half] of [
    [p.u, du, w.length / 2],
    [p.v, dv, w.thickness / 2],
  ] as const) {
    if (Math.abs(d) < 1e-9) {
      if (Math.abs(o) > half) return false;
    } else {
      let a = (-half - o) / d;
      let b = (half - o) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
  }
  if (t0 > t1) return false;
  return y0 + t0 * RISE <= map.height(w.x, w.z) + w.height;
}

/** Precomputed shade for the whole map. Used by the server (rules) and the browser (drawing). */
export interface ShadeGrid {
  cellSize: number;
  cols: number;
  rows: number;
  /** Map coordinates of the grid's first cell edge. */
  originX: number;
  originZ: number;
  /** 1 = shaded, 0 = sun. index = row * cols + col; rows along z, cols along x. */
  data: Uint8Array;
}

/**
 * Builds the grid by visiting only the cells each object could shade
 * (its footprint stretched away from the sun by its longest shadow).
 */
export function buildShadeGrid(map: MapDef = WORLD, cellSize: number = shadeCellFor(map)): ShadeGrid {
  const cols = Math.ceil((map.extent.x * 2) / cellSize);
  const rows = Math.ceil((map.extent.z * 2) / cellSize);
  const originX = -map.extent.x;
  const originZ = -map.extent.z;
  const data = new Uint8Array(cols * rows);
  type Caster = { x: number; z: number; reach: number; height: number; test: (x: number, z: number, y0: number) => boolean };
  const objects: Caster[] = [
    ...map.rocks.map((r) => ({ x: r.x, z: r.z, reach: r.radius, height: r.height, test: (x: number, z: number, y0: number) => rockShades(map, r, x, z, y0) })),
    ...map.walls.map((w) => ({
      x: w.x,
      z: w.z,
      reach: Math.hypot(w.length, w.thickness) / 2,
      height: w.height,
      test: (x: number, z: number, y0: number) => wallShades(map, w, x, z, y0),
    })),
  ];
  for (const o of objects) {
    // Longest possible shadow, allowing for ground lower than the object's base.
    const len = (o.height + 4) / RISE;
    const ex = o.x - DX * len;
    const ez = o.z - DZ * len;
    const minX = Math.min(o.x, ex) - o.reach - 1;
    const maxX = Math.max(o.x, ex) + o.reach + 1;
    const minZ = Math.min(o.z, ez) - o.reach - 1;
    const maxZ = Math.max(o.z, ez) + o.reach + 1;
    const c0 = Math.max(0, Math.floor((minX - originX) / cellSize));
    const c1 = Math.min(cols - 1, Math.floor((maxX - originX) / cellSize));
    const r0 = Math.max(0, Math.floor((minZ - originZ) / cellSize));
    const r1 = Math.min(rows - 1, Math.floor((maxZ - originZ) / cellSize));
    for (let r = r0; r <= r1; r++) {
      const z = originZ + (r + 0.5) * cellSize;
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (data[i]) continue;
        const x = originX + (c + 0.5) * cellSize;
        if (o.test(x, z, map.height(x, z) + TUNING.shade.bodyHeight)) data[i] = 1;
      }
    }
  }
  return { cellSize, cols, rows, originX, originZ, data };
}

/** Finer cells on small maps; the full desert uses coarser cells to keep the grid around a million cells. */
export function shadeCellFor(map: MapDef): number {
  const base = TUNING.shade.cellSize;
  return Math.max(base, Math.ceil(Math.sqrt((map.extent.x * 2 * map.extent.z * 2) / 1.2e6) / base) * base);
}

export function shadeAt(grid: ShadeGrid, x: number, z: number): boolean {
  const col = Math.floor((x - grid.originX) / grid.cellSize);
  const row = Math.floor((z - grid.originZ) / grid.cellSize);
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return false;
  return grid.data[row * grid.cols + col] === 1;
}

const cache = new WeakMap<MapDef, ShadeGrid>();
/** The shade grid for a map, built once. */
export function shadeFor(map: MapDef = WORLD): ShadeGrid {
  let g = cache.get(map);
  if (!g) {
    g = buildShadeGrid(map);
    cache.set(map, g);
  }
  return g;
}
