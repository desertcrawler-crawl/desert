import { insideEllipse, wallLocal, type MapDef, type Site } from "./map.ts";
import { BODY_RADIUS } from "./movement.ts";
import { shadeAt, shadeFor, type ShadeGrid } from "./shade.ts";
import { WORLD } from "./world.ts";
import { TUNING } from "./tuning.ts";

/** Cost of the best crawling route from a spawn to a well site. */
export interface RouteCost {
  /** Crawling time, s. Infinity if unreachable. */
  seconds: number;
  /** Health spent on the way while crawling, percentage points. */
  health: number;
}

/**
 * Crawl-only route costs from every spawn to every well site, found by
 * pathfinding around rocks with sun and shade taken into account. The map
 * is fixed, so this is computed once. It is what makes spawn fairness depend
 * on real routes rather than straight-line distance.
 *
 * table[spawnIndex][siteIndex]
 */
export type RouteTable = RouteCost[][];

export function buildRouteTable(map: MapDef = WORLD, shade: ShadeGrid = shadeFor(map), cell: number = routeCellFor(map)): RouteTable {
  const cols = Math.ceil((map.extent.x * 2) / cell);
  const rows = Math.ceil((map.extent.z * 2) / cell);
  const ox = -map.extent.x;
  const oz = -map.extent.z;
  const col = (x: number) => Math.min(cols - 1, Math.max(0, Math.floor((x - ox) / cell)));
  const row = (z: number) => Math.min(rows - 1, Math.max(0, Math.floor((z - oz) / cell)));
  const cx = (c: number) => ox + (c + 0.5) * cell;
  const cz = (r: number) => oz + (r + 0.5) * cell;

  // Blocked cells: outside the boundary, or inside a rock or wall (with body radius).
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) if (!insideEllipse(map.boundary, cx(c), cz(r))) blocked[r * cols + c] = 1;
  }
  const mark = (x: number, z: number, reach: number, inside: (x: number, z: number) => boolean) => {
    for (let r = row(z - reach); r <= row(z + reach); r++) {
      for (let c = col(x - reach); c <= col(x + reach); c++) if (inside(cx(c), cz(r))) blocked[r * cols + c] = 1;
    }
  };
  for (const rock of map.rocks) {
    const R = rock.radius + BODY_RADIUS;
    mark(rock.x, rock.z, R, (x, z) => Math.hypot(x - rock.x, z - rock.z) < R);
  }
  for (const w of map.walls) {
    mark(w.x, w.z, w.length / 2 + BODY_RADIUS + 1, (x, z) => {
      const { u, v } = wallLocal(w, x, z);
      return Math.abs(u) < w.length / 2 + BODY_RADIUS && Math.abs(v) < w.thickness / 2 + BODY_RADIUS;
    });
  }
  const n = cols * rows;

  const d = TUNING.health.drainPerMinute;
  const speed = TUNING.movement.crawlSpeed;
  // Health per metre crawled, in sun and in shade.
  const sunPerM = d.crawlSun / 60 / speed;
  const shadePerM = d.crawlShade / 60 / speed;

  return map.spawns.map((spawn) => {
    const health = new Float64Array(n).fill(Infinity);
    const seconds = new Float64Array(n).fill(Infinity);
    const start = row(spawn.z) * cols + col(spawn.x);
    health[start] = 0;
    seconds[start] = 0;
    const heap = new MinHeap();
    heap.push(start, 0);
    const steps = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
    ] as const;
    while (heap.size > 0) {
      const [idx, cost] = heap.pop();
      if (cost > health[idx]!) continue;
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      for (const [dc, dr, len] of steps) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        const ni = nr * cols + nc;
        if (blocked[ni]) continue;
        const metres = len * cell;
        const inShade = shadeAt(shade, cx(nc), cz(nr));
        const h = cost + metres * (inShade ? shadePerM : sunPerM);
        if (h < health[ni]!) {
          health[ni] = h;
          seconds[ni] = seconds[idx]! + metres / speed;
          heap.push(ni, h);
        }
      }
    }
    return map.wellSites.map((site: Site) => {
      const i = row(site.z) * cols + col(site.x);
      return { seconds: seconds[i]!, health: health[i]! };
    });
  });
}

/** Route grid cell: 1 m on small maps, coarser on the full desert so the grid stays near 300k cells. */
export function routeCellFor(map: MapDef): number {
  const base = TUNING.fairness.routeCellSize;
  return Math.max(base, Math.ceil(Math.sqrt((map.extent.x * 2 * map.extent.z * 2) / 3e5) / base) * base);
}

const cache = new WeakMap<MapDef, RouteTable>();
/** The route table for a map, built once. */
export function routesFor(map: MapDef = WORLD): RouteTable {
  let t = cache.get(map);
  if (!t) {
    t = buildRouteTable(map);
    cache.set(map, t);
  }
  return t;
}

/** Does this route meet the first-water target for someone starting at `startHealth`? */
export function routeIsFair(route: RouteCost, startHealth: number): boolean {
  const f = TUNING.fairness;
  return route.seconds <= f.maxFirstWaterSeconds && startHealth - route.health >= f.minArrivalHealth;
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(id: number, key: number) {
    this.ids.push(id);
    this.keys.push(key);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p]! <= key) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.ids[0]!, this.keys[0]!];
    const lastId = this.ids.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.ids.length > 0) {
      this.ids[0] = lastId;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.ids.length && this.keys[l]! < this.keys[m]!) m = l;
        if (r < this.ids.length && this.keys[r]! < this.keys[m]!) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b]!, this.ids[a]!];
    [this.keys[a], this.keys[b]] = [this.keys[b]!, this.keys[a]!];
  }
}
