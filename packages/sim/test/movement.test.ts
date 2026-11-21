import { describe, expect, it } from "vitest";
import { BODY_RADIUS, GREYBOX, sanitizeInput, stepBody, TUNING, wrapAngle } from "../src/index.ts";

const dt = 1 / TUNING.tickHz;

describe("stepBody", () => {
  it("crawls north at crawl speed when W is held at heading 0", () => {
    let b = { x: 0, z: 60, heading: 0 };
    for (let i = 0; i < TUNING.tickHz * 10; i++) b = stepBody(b, { forward: 1, turn: 0 }, dt, GREYBOX);
    expect(b.x).toBeCloseTo(0, 6);
    expect(60 - b.z).toBeCloseTo(TUNING.movement.crawlSpeed * 10, 6);
  });

  it("does not move or turn without input", () => {
    const b = { x: 3, z: 4, heading: 1 };
    expect(stepBody(b, { forward: 0, turn: 0 }, dt)).toEqual(b);
  });

  it("turns without moving the camera's idea of direction (heading only)", () => {
    const b = stepBody({ x: 0, z: 60, heading: 0 }, { forward: 0, turn: 1 }, 1);
    expect(b.heading).toBeCloseTo((TUNING.movement.turnRateDeg * Math.PI) / 180, 6);
    expect(b.x).toBe(0);
    expect(b.z).toBe(60);
  });

  it("cannot pass through a rock", () => {
    const rock = GREYBOX.rocks[0]!;
    let b = { x: rock.x, z: rock.z + rock.radius + 5, heading: 0 }; // south of rock, facing north
    for (let i = 0; i < TUNING.tickHz * 60; i++) b = stepBody(b, { forward: 1, turn: 0 }, dt, GREYBOX);
    expect(Math.hypot(b.x - rock.x, b.z - rock.z)).toBeGreaterThanOrEqual(rock.radius + BODY_RADIUS - 1e-9);
  });

  it("stays inside the greybox edge", () => {
    let b = { x: 0, z: -GREYBOX.boundary.rz + 0.1, heading: 0 };
    for (let i = 0; i < 100; i++) b = stepBody(b, { forward: 1, turn: 0 }, dt, GREYBOX);
    expect(b.z).toBeGreaterThanOrEqual(-GREYBOX.boundary.rz);
  });
});

describe("sanitizeInput", () => {
  it("only accepts -1, 0 and 1", () => {
    expect(sanitizeInput({ forward: 5, turn: -1 })).toEqual({ forward: 0, turn: -1 });
    expect(sanitizeInput("garbage")).toEqual({ forward: 0, turn: 0 });
    expect(sanitizeInput(null)).toEqual({ forward: 0, turn: 0 });
  });
});

describe("terrain", () => {
  it("stays gentle: no point higher or lower than 2 m", () => {
    for (let x = -100; x <= 100; x += 2.5) {
      for (let z = -100; z <= 100; z += 2.5) {
        expect(Math.abs(GREYBOX.height(x, z))).toBeLessThan(2);
      }
    }
  });

  it("wraps angles into (-pi, pi]", () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 9);
  });
});
