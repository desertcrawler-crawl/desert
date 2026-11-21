import type { MapDef, Rock, Site } from "../src/index.ts";

/** A flat, round test map with the given contents. */
export function testMap(opts: { half?: number; rocks?: Rock[]; spawns: Site[]; wellSites: Site[]; scorpions?: Site[] }): MapDef {
  const half = opts.half ?? 50;
  return {
    name: "test",
    extent: { x: half, z: half },
    boundary: { rx: half, rz: half },
    interior: { rx: half - 5, rz: half - 5 },
    rocks: opts.rocks ?? [],
    walls: [],
    spawns: opts.spawns,
    wellSites: opts.wellSites,
    scorpions: opts.scorpions ?? [],
    landmarks: [],
    height: () => 0,
  };
}
