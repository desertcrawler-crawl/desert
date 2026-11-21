/**
 * Greybox map used until the real map is authored (milestone M3).
 *
 * A small square of gentle dunes with a few rocks, generated in code so the
 * server and the browser get exactly the same ground without any asset.
 * Coordinates are metres. x grows east, z grows south (Three.js convention);
 * north is -z.
 */
export interface Rock {
  id: string;
  x: number;
  z: number;
  /** Radius of the rock's footprint in metres (rocks are treated as upright cylinders). */
  radius: number;
  /** Height in metres. */
  height: number;
}

export interface Site {
  x: number;
  z: number;
}

export interface GreyboxMap {
  /** Half the side length of the square playable area, metres. */
  halfSize: number;
  rocks: Rock[];
  /** Predefined first-entry spawn points. Test positions only; real spawns arrive with the map in M3. */
  spawns: Site[];
  /** Authored places where a well may appear. Test positions only. */
  wellSites: Site[];
  /** Fixed scorpion guard posts near the boundary. Test positions only; the real count is open. */
  scorpions: Site[];
  /** Width of the outer band with no wells and no first-entry spawns, m. */
  boundaryBand: number;
}

export const GREYBOX: GreyboxMap = {
  halfSize: 100,
  rocks: [
    { id: "rock-a", x: 12, z: -18, radius: 3.5, height: 4 },
    { id: "rock-b", x: -22, z: 6, radius: 5, height: 6 },
    { id: "rock-c", x: 30, z: 24, radius: 2.5, height: 2.5 },
    { id: "rock-d", x: -8, z: 34, radius: 4, height: 3.5 },
    { id: "rock-e", x: 45, z: -40, radius: 6, height: 7 },
    { id: "rock-f", x: -48, z: -30, radius: 4.5, height: 5 },
    { id: "rock-g", x: -60, z: 52, radius: 3, height: 3 },
    { id: "rock-h", x: 62, z: 58, radius: 5, height: 4.5 },
    { id: "rock-i", x: 4, z: -62, radius: 3, height: 3.5 },
  ],
  spawns: [
    { x: 0, z: 0 },
    { x: 8, z: 6 },
    { x: -8, z: 6 },
    { x: 6, z: -9 },
    { x: -6, z: -9 },
    { x: -30, z: -45 },
    { x: 40, z: 40 },
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
    { x: -40, z: -60 },
    { x: 70, z: 40 },
    { x: -72, z: 44 },
    { x: 10, z: -74 },
    { x: 76, z: -72 },
  ],
  scorpions: [
    { x: 0, z: -92 },
    { x: 60, z: -91 },
    { x: -60, z: -91 },
    { x: 92, z: 0 },
    { x: -92, z: 0 },
    { x: 0, z: 92 },
    { x: 60, z: 91 },
    { x: -60, z: 91 },
    { x: 91, z: -55 },
    { x: -91, z: 55 },
  ],
  boundaryBand: 15,
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
