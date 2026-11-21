import { GREYBOX, type GreyboxMap, type Site } from "./greybox.ts";
import { BODY_RADIUS } from "./movement.ts";
import { greyboxShade, shadeAt, type ShadeGrid } from "./shade.ts";
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

export function buildRouteTable(
  map: GreyboxMap = GREYBOX,
  shade: ShadeGrid = greyboxShade(),
  cell: number = TUNING.fairness.routeCellSize,
): RouteTable {
  const n = Math.ceil((map.halfSize * 2) / cell);
  const origin = -map.halfSize;
  const toCell = (v: number) => Math.min(n - 1, Math.max(0, Math.floor((v - origin) / cell)));
  const centre = (i: number) => origin + (i + 0.5) * cell;

  // Blocked cells: inside a rock (with body radius).
  const blocked = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = centre(c);
      const z = centre(r);
      for (const rock of map.rocks) {
        if (Math.hypot(x - rock.x, z - rock.z) < rock.radius + BODY_RADIUS) blocked[r * n + c] = 1;
      }
    }
  }

  const d = TUNING.health.drainPerMinute;
  const speed = TUNING.movement.crawlSpeed;
  // Health per metre crawled, in sun and in shade.
  const sunPerM = d.crawlSun / 60 / speed;
  const shadePerM = d.crawlShade / 60 / speed;

  return map.spawns.map((spawn) => {
    const health = new Float64Array(n * n).fill(Infinity);
    const seconds = new Float64Array(n * n).fill(Infinity);
    const start = toCell(spawn.z) * n + toCell(spawn.x);
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
      const r = Math.floor(idx / n);
      const c = idx % n;
      for (const [dc, dr, len] of steps) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
        const ni = nr * n + nc;
        if (blocked[ni]) continue;
        const metres = len * cell;
        const inShade = shadeAt(shade, centre(nc), centre(nr));
        const h = cost + metres * (inShade ? shadePerM : sunPerM);
        if (h < health[ni]!) {
          health[ni] = h;
          seconds[ni] = seconds[idx]! + metres / speed;
          heap.push(ni, h);
        }
      }
    }
    return map.wellSites.map((site: Site) => {
      const i = toCell(site.z) * n + toCell(site.x);
      return { seconds: seconds[i]!, health: health[i]! };
    });
  });
}

let cached: RouteTable | null = null;
export function greyboxRoutes(): RouteTable {
  cached ??= buildRouteTable(GREYBOX);
  return cached;
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
