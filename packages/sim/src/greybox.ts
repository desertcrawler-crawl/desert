import type { MapDef } from "./map.ts";

/**
 * Small test map used by unit tests (and in M0-M2 as the play area).
 * The real map is DESERT in desert.ts.
 */
export const GREYBOX: MapDef = {
  name: "greybox",
  extent: { x: 100, z: 100 },
  boundary: { rx: 100, rz: 100 },
  interior: { rx: 85, rz: 85 },
  rocks: [
    { id: "rock-a", x: 12, z: -18, radius: 3.5, height: 4 },
    { id: "rock-b", x: -22, z: 6, radius: 5, height: 6 },
    { id: "rock-c", x: 30, z: 24, radius: 2.5, height: 2.5 },
    { id: "rock-d", x: -8, z: 34, radius: 4, height: 3.5 },
    { id: "rock-e", x: 45, z: -40, radius: 6, height: 7 },
    { id: "rock-f", x: -48, z: -30, radius: 4.5, height: 5 },
    { id: "rock-g", x: -55, z: 48, radius: 3, height: 3 },
    { id: "rock-h", x: 52, z: 48, radius: 5, height: 4.5 },
    { id: "rock-i", x: 4, z: -62, radius: 3, height: 3.5 },
  ],
  walls: [],
  spawns: [
    { x: 0, z: 0 },
    { x: 8, z: 6 },
    { x: -8, z: 6 },
    { x: 6, z: -9 },
    { x: -6, z: -9 },
    { x: -30, z: -45 },
    { x: 40, z: 30 },
    { x: -45, z: 30 },
  ],
  wellSites: [
    { x: 22, z: -30 },
    { x: -34, z: 14 },
    { x: 38, z: 10 },
    { x: -14, z: 48 },
    { x: 56, z: -30 },
    { x: -56, z: -22 },
    { x: 14, z: 56 },
    { x: -40, z: -55 },
    { x: 60, z: 30 },
    { x: -62, z: 30 },
    { x: 10, z: -74 },
    { x: 50, z: -58 },
  ],
  scorpions: [
    { x: 0, z: -93 },
    { x: 66, z: -65 },
    { x: -66, z: -65 },
    { x: 93, z: 0 },
    { x: -93, z: 0 },
    { x: 0, z: 93 },
    { x: 66, z: 65 },
    { x: -66, z: 65 },
  ],
  landmarks: [],
  height: (x, z) =>
    0.9 * Math.sin(x * 0.045) * Math.cos(z * 0.038) +
    0.45 * Math.sin(x * 0.11 + z * 0.07) +
    0.2 * Math.cos(x * 0.21 - z * 0.17),
};
