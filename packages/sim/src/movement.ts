import { GREYBOX, type GreyboxMap } from "./greybox.ts";
import { TUNING } from "./tuning.ts";

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

/** Coerce untrusted input into a valid MoveInput. Anything odd becomes 0. */
export function sanitizeInput(raw: unknown): MoveInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const axis = (v: unknown): -1 | 0 | 1 => (v === 1 ? 1 : v === -1 ? -1 : 0);
  return { forward: axis(r.forward), turn: axis(r.turn) };
}

/**
 * Advance one body by dt seconds. Pure and deterministic, so the server
 * (authoritative) and the browser (prediction, later) can run the same code.
 */
export function stepBody(
  body: Body,
  input: MoveInput,
  dt: number,
  map: GreyboxMap = GREYBOX,
  forwardSpeed: number = TUNING.movement.crawlSpeed,
): Body {
  const m = TUNING.movement;
  const heading = wrapAngle(body.heading + input.turn * ((m.turnRateDeg * Math.PI) / 180) * dt);

  const speed = input.forward > 0 ? forwardSpeed : input.forward < 0 ? -forwardSpeed * m.reverseFactor : 0;
  let x = body.x + Math.sin(heading) * speed * dt;
  let z = body.z - Math.cos(heading) * speed * dt;

  // Rocks are solid: push the body back out of any rock footprint.
  for (const rock of map.rocks) {
    const dx = x - rock.x;
    const dz = z - rock.z;
    const d = Math.hypot(dx, dz);
    const min = rock.radius + BODY_RADIUS;
    if (d < min) {
      const k = d > 1e-6 ? min / d : 0;
      x = d > 1e-6 ? rock.x + dx * k : rock.x + min;
      z = d > 1e-6 ? rock.z + dz * k : rock.z;
    }
  }

  // Greybox edge. The real invisible boundary comes with the real map (M3).
  const lim = map.halfSize;
  x = Math.max(-lim, Math.min(lim, x));
  z = Math.max(-lim, Math.min(lim, z));

  return { x, z, heading };
}

/** Collision radius of a crawling body, metres. Placeholder. */
export const BODY_RADIUS = 0.4;

export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  a = a % twoPi;
  if (a > Math.PI) a -= twoPi;
  if (a <= -Math.PI) a += twoPi;
  return a;
}
