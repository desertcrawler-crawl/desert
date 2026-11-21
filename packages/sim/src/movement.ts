import { clampToEllipse, wallLocal, type MapDef } from "./map.ts";
import { TUNING } from "./tuning.ts";
import { WORLD } from "./world.ts";

/** What a client is allowed to ask for. Never a position or a health value. */
export interface MoveInput {
  /** 1 = forward (W), -1 = backward (S), 0 = none. */
  forward: -1 | 0 | 1;
  /** 1 = turn right (D), -1 = turn left (A), 0 = none. */
  turn: -1 | 0 | 1;
}

export interface Body {
  x: number;
  z: number;
  /** Heading in radians. 0 faces north (-z); positive turns clockwise seen from above. */
  heading: number;
}

export const IDLE_INPUT: MoveInput = { forward: 0, turn: 0 };

/** Collision radius of a body, metres. Placeholder. */
export const BODY_RADIUS = 0.4;

/** Coerce untrusted input into a valid MoveInput. Anything odd becomes 0. */
export function sanitizeInput(raw: unknown): MoveInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const axis = (v: unknown): -1 | 0 | 1 => (v === 1 ? 1 : v === -1 ? -1 : 0);
  return { forward: axis(r.forward), turn: axis(r.turn) };
}

/**
 * Advance one body by dt seconds. Pure and deterministic, so the server
 * (authoritative) and the browser can run the same code.
 */
export function stepBody(
  body: Body,
  input: MoveInput,
  dt: number,
  map: MapDef = WORLD,
  forwardSpeed: number = TUNING.movement.crawlSpeed,
): Body {
  const m = TUNING.movement;
  const heading = wrapAngle(body.heading + input.turn * ((m.turnRateDeg * Math.PI) / 180) * dt);
  const speed = input.forward > 0 ? forwardSpeed : input.forward < 0 ? -forwardSpeed * m.reverseFactor : 0;
  let x = body.x + Math.sin(heading) * speed * dt;
  let z = body.z - Math.cos(heading) * speed * dt;
  ({ x, z } = resolveCollisions(map, x, z));
  return { x, z, heading };
}

/** Push a point out of rocks and walls, and keep it inside the invisible boundary. */
export function resolveCollisions(map: MapDef, x: number, z: number): { x: number; z: number } {
  const R = BODY_RADIUS;
  for (const rock of map.rocks) {
    const dx = x - rock.x;
    const dz = z - rock.z;
    const min = rock.radius + R;
    if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
    const d = Math.hypot(dx, dz);
    if (d < min) {
      if (d > 1e-6) {
        x = rock.x + (dx * min) / d;
        z = rock.z + (dz * min) / d;
      } else {
        x = rock.x + min;
      }
    }
  }
  for (const w of map.walls) {
    if (Math.abs(x - w.x) > w.length + R || Math.abs(z - w.z) > w.length + R) continue;
    const { u, v } = wallLocal(w, x, z);
    const pu = w.length / 2 + R - Math.abs(u);
    const pv = w.thickness / 2 + R - Math.abs(v);
    if (pu > 0 && pv > 0) {
      // Push out along the shallower axis.
      const c = Math.cos(w.angle);
      const s = Math.sin(w.angle);
      if (pv < pu) {
        const k = Math.sign(v || 1) * pv;
        x += -s * k;
        z += c * k;
      } else {
        const k = Math.sign(u || 1) * pu;
        x += c * k;
        z += s * k;
      }
    }
  }
  return clampToEllipse(map.boundary, x, z);
}

export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  a = a % twoPi;
  if (a > Math.PI) a -= twoPi;
  if (a <= -Math.PI) a += twoPi;
  return a;
}
