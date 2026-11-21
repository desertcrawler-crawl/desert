/**
 * The fixed afternoon sun, low in the south-west (spec working proposal).
 * Unit vector pointing FROM the ground TOWARDS the sun. West is -x, south is +z.
 * It never moves, so shade can be computed once.
 */
const raw = { x: -0.62, y: 0.42, z: 0.66 };
const len = Math.hypot(raw.x, raw.y, raw.z);
export const SUN = { x: raw.x / len, y: raw.y / len, z: raw.z / len } as const;
