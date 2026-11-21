/**
 * Map format shared by server and browser.
 * Coordinates are metres. x grows east, z grows south (Three.js convention); north is -z.
 */
export interface Site {
  x: number;
  z: number;
}

/** A rock, spire or boulder: an upright cylinder for collision and shade. */
export interface Rock {
  id: string;
  x: number;
  z: number;
  radius: number;
  height: number;
}

/** A ruin wall or other straight structure: an upright box for collision and shade. */
export interface Wall {
  id: string;
  x: number;
  z: number;
  /** Along the wall, m. */
  length: number;
  thickness: number;
  height: number;
  /** Rotation of the wall's length axis from +x towards +z, radians. */
  angle: number;
}

export interface Ellipse {
  rx: number;
  rz: number;
}

export interface Landmark extends Site {
  name: string;
}

export interface MapDef {
  name: string;
  /** Half-extents of the area the data grids cover (at least the boundary). */
  extent: { x: number; z: number };
  /** The impassable invisible limit. */
  boundary: Ellipse;
  /** The useful interior: wells and first-entry spawns only inside it. Outside it is the boundary band. */
  interior: Ellipse;
  rocks: Rock[];
  walls: Wall[];
  /** Predefined first-entry spawn points. */
  spawns: Site[];
  /** Authored places where a well may appear. */
  wellSites: Site[];
  /** Fixed scorpion guard posts in the boundary band. */
  scorpions: Site[];
  landmarks: Landmark[];
  /** Ground height, m. */
  height(x: number, z: number): number;
}

/** 1 inside, >1 outside. */
export function ellipseValue(e: Ellipse, x: number, z: number): number {
  return (x / e.rx) ** 2 + (z / e.rz) ** 2;
}

export function insideEllipse(e: Ellipse, x: number, z: number): boolean {
  return ellipseValue(e, x, z) <= 1;
}

/** Pull a point back onto the ellipse if it is outside. */
export function clampToEllipse(e: Ellipse, x: number, z: number): { x: number; z: number } {
  const v = ellipseValue(e, x, z);
  if (v <= 1) return { x, z };
  const k = 1 / Math.sqrt(v);
  return { x: x * k, z: z * k };
}

/** A wall in its own frame: u along its length, v across it. */
export function wallLocal(w: Wall, x: number, z: number): { u: number; v: number } {
  const c = Math.cos(w.angle);
  const s = Math.sin(w.angle);
  const dx = x - w.x;
  const dz = z - w.z;
  return { u: dx * c + dz * s, v: -dx * s + dz * c };
}

/** Distance from a point to the nearest obstacle edge, m (negative inside). Used for site checks. */
export function clearance(map: MapDef, x: number, z: number): number {
  let best = Infinity;
  for (const r of map.rocks) best = Math.min(best, Math.hypot(x - r.x, z - r.z) - r.radius);
  for (const w of map.walls) {
    const { u, v } = wallLocal(w, x, z);
    const du = Math.abs(u) - w.length / 2;
    const dv = Math.abs(v) - w.thickness / 2;
    const out = Math.hypot(Math.max(du, 0), Math.max(dv, 0));
    best = Math.min(best, out > 0 ? out : Math.max(du, dv));
  }
  return best;
}
