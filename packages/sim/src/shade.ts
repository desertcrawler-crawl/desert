import { GREYBOX, terrainHeight, type GreyboxMap } from "./greybox.ts";
import { SUN } from "./sun.ts";
import { TUNING } from "./tuning.ts";

/**
 * Is a body at (x, z) in protective shade?
 *
 * Casts a ray from the body (at TUNING.shade.bodyHeight above the ground)
 * towards the fixed sun and checks whether a rock blocks it. Rocks are
 * upright cylinders, the same shape used for collision. Only map rocks count:
 * players and other small things never make shade (spec working proposal).
 */
export function isShadedExact(x: number, z: number, map: GreyboxMap = GREYBOX): boolean {
  const horiz = Math.hypot(SUN.x, SUN.z);
  const dx = SUN.x / horiz;
  const dz = SUN.z / horiz;
  const rise = SUN.y / horiz; // metres up per metre travelled towards the sun
  const y0 = terrainHeight(x, z) + TUNING.shade.bodyHeight;

  for (const rock of map.rocks) {
    const cx = rock.x - x;
    const cz = rock.z - z;
    const along = cx * dx + cz * dz;
    const perp2 = cx * cx + cz * cz - along * along;
    const r2 = rock.radius * rock.radius;
    if (perp2 > r2) continue;
    const half = Math.sqrt(r2 - perp2);
    const exit = along + half;
    if (exit < 0) continue; // rock is behind us, away from the sun
    const entry = Math.max(0, along - half);
    const rayHeight = y0 + entry * rise;
    const top = terrainHeight(rock.x, rock.z) + rock.height;
    if (rayHeight <= top) return true;
  }
  return false;
}

/** Precomputed shade for the whole map. Used by the server (rules) and the browser (drawing). */
export interface ShadeGrid {
  cellSize: number;
  /** Number of cells along each side. */
  cells: number;
  /** Map coordinate of the grid's first cell edge on both axes. */
  origin: number;
  /** 1 = shaded, 0 = sun. Row-major: index = row * cells + col, row along z, col along x. */
  data: Uint8Array;
}

export function buildShadeGrid(map: GreyboxMap = GREYBOX, cellSize: number = TUNING.shade.cellSize): ShadeGrid {
  const cells = Math.ceil((map.halfSize * 2) / cellSize);
  const origin = -map.halfSize;
  const data = new Uint8Array(cells * cells);
  for (let row = 0; row < cells; row++) {
    const z = origin + (row + 0.5) * cellSize;
    for (let col = 0; col < cells; col++) {
      const x = origin + (col + 0.5) * cellSize;
      data[row * cells + col] = isShadedExact(x, z, map) ? 1 : 0;
    }
  }
  return { cellSize, cells, origin, data };
}

export function shadeAt(grid: ShadeGrid, x: number, z: number): boolean {
  const col = Math.floor((x - grid.origin) / grid.cellSize);
  const row = Math.floor((z - grid.origin) / grid.cellSize);
  if (col < 0 || row < 0 || col >= grid.cells || row >= grid.cells) return false;
  return grid.data[row * grid.cells + col] === 1;
}

let cached: ShadeGrid | null = null;
/** The greybox shade grid, built once on first use. */
export function greyboxShade(): ShadeGrid {
  cached ??= buildShadeGrid(GREYBOX);
  return cached;
}
