import { describe, expect, it } from "vitest";
import {
  BODY_RADIUS,
  clearance,
  DESERT,
  GREYBOX,
  insideEllipse,
  isShadedExact,
  resolveCollisions,
  routesFor,
  shadeFor,
  type MapDef,
} from "../src/index.ts";

/** Automated map checks from the spec's map validation list. */
for (const map of [GREYBOX, DESERT] as MapDef[]) {
  describe(`map ${map.name}`, () => {
    it("spawns and well sites are clear of rocks and walls", () => {
      for (const p of [...map.spawns, ...map.wellSites]) expect(clearance(map, p.x, p.z)).toBeGreaterThan(BODY_RADIUS + 1);
    });

    it("the boundary oval sits inside the data grids", () => {
      expect(map.boundary.rx).toBeLessThanOrEqual(map.extent.x);
      expect(map.boundary.rz).toBeLessThanOrEqual(map.extent.z);
      expect(map.interior.rx).toBeLessThan(map.boundary.rx);
      expect(map.interior.rz).toBeLessThan(map.boundary.rz);
    });

    it("every well site can be reached by crawling from some spawn", () => {
      const table = routesFor(map);
      map.wellSites.forEach((_, site) => {
        expect(table.some((row) => Number.isFinite(row[site]!.seconds))).toBe(true);
      });
    });

    it("has real shade, and the grid agrees with the exact shade test", () => {
      const grid = shadeFor(map);
      expect(grid.data.reduce((a, b) => a + b, 0)).toBeGreaterThan(200);
      let agree = 0;
      let total = 0;
      for (let i = 0; i < grid.data.length; i += 997) {
        const x = grid.originX + ((i % grid.cols) + 0.5) * grid.cellSize;
        const z = grid.originZ + (Math.floor(i / grid.cols) + 0.5) * grid.cellSize;
        total++;
        if ((grid.data[i] === 1) === isShadedExact(x, z, map)) agree++;
      }
      expect(agree).toBe(total);
    });

    it("well sites are not all under the best shade", () => {
      const shaded = map.wellSites.filter((s) => isShadedExact(s.x, s.z, map)).length;
      expect(shaded / map.wellSites.length).toBeLessThan(0.5);
    });

    it("the invisible limit cannot be crossed", () => {
      for (let a = 0; a < Math.PI * 2; a += 0.3) {
        const p = resolveCollisions(map, Math.cos(a) * map.boundary.rx * 1.5, Math.sin(a) * map.boundary.rz * 1.5);
        expect(insideEllipse({ rx: map.boundary.rx + 1e-6, rz: map.boundary.rz + 1e-6 }, p.x, p.z)).toBe(true);
      }
    });
  });
}

describe("desert layout", () => {
  it("has the spec's named landmarks", () => {
    const names = DESERT.landmarks.map((l) => l.name);
    for (const n of ["Twin Teeth", "Split Spire", "Fallen Dome", "Buried Gate"]) expect(names).toContain(n);
  });

  it("ruin walls block movement", () => {
    const w = DESERT.walls[0]!;
    const p = resolveCollisions(DESERT, w.x, w.z);
    expect(Math.hypot(p.x - w.x, p.z - w.z)).toBeGreaterThan(w.thickness / 2);
  });

  it("supports enough well sites for a full session", () => {
    expect(DESERT.wellSites.length).toBeGreaterThanOrEqual(40);
    expect(DESERT.spawns.length).toBeGreaterThanOrEqual(12);
  });
});
