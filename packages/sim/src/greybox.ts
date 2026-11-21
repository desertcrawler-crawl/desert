/**
 * Greybox map used until the real map is authored (milestone M3).
 *
 * It is a small square of gentle dunes with a few rocks, generated in code so
 * the server and the browser get exactly the same ground without any asset.
 * Coordinates are metres. x grows east, z grows south (Three.js convention);
 * north is -z.
 */
export interface Rock {
  id: string;
  x: number;
  z: number;
  /** Rough radius of the rock's footprint in metres. */
  radius: number;
  /** Height in metres. */
  height: number;
}

export interface GreyboxMap {
  /** Half the side length of the square playable area, metres. */
  halfSize: number;
  rocks: Rock[];
  /** Fixed spawn points for M0/M1 testing only. Real spawns arrive with the map in M3. */
  spawns: { x: number; z: number }[];
}

export const GREYBOX: GreyboxMap = {
  halfSize: 100,
  rocks: [
    { id: "rock-a", x: 12, z: -18, radius: 3.5, height: 4 },
    { id: "rock-b", x: -22, z: 6, radius: 5, height: 6 },
    { id: "rock-c", x: 30, z: 24, radius: 2.5, height: 2.5 },
    { id: "rock-d", x: -8, z: 34, radius: 4, height: 3.5 },
    { id: "rock-e", x: 45, z: -40, radius: 6, height: 7 },
  ],
  spawns: [
    { x: 0, z: 0 },
    { x: 6, z: 4 },
    { x: -6, z: 4 },
    { x: 4, z: -6 },
    { x: -4, z: -6 },
  ],
};

/**
 * Terrain height at (x, z), in metres. Gentle rolling dunes only:
 * the spec asks for mostly flat ground that a crawler can always cross.
 */
export function terrainHeight(x: number, z: number): number {
  return (
    0.9 * Math.sin(x * 0.045) * Math.cos(z * 0.038) +
    0.45 * Math.sin(x * 0.11 + z * 0.07) +
    0.2 * Math.cos(x * 0.21 - z * 0.17)
  );
}
