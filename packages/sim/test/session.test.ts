import { describe, expect, it } from "vitest";
import {
  buildShadeGrid,
  GREYBOX,
  isShadedExact,
  Session,
  shadeAt,
  SUN,
  TUNING,
  type GreyboxMap,
} from "../src/index.ts";

const dt = 1 / TUNING.tickHz;
const H = TUNING.health;

/** Deterministic random for tests. */
function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function run(session: Session, seconds: number) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) session.step(dt);
}

/** An empty map with one rock, for precise shade and well tests. */
const OPEN: GreyboxMap = {
  halfSize: 50,
  rocks: [{ id: "r", x: 0, z: 0, radius: 3, height: 4 }],
  spawns: [{ x: -30, z: -30 }, { x: -20, z: -30 }],
  wellSites: [{ x: 30, z: 30 }],
};

function openSession() {
  return new Session({ map: OPEN, shade: buildShadeGrid(OPEN), random: seeded() });
}

describe("shade", () => {
  it("falls on the side away from the sun, not the sunny side", () => {
    // The sun is south-west, so shade falls north-east of a rock.
    const away = { x: -SUN.x, z: -SUN.z };
    const n = Math.hypot(away.x, away.z);
    expect(isShadedExact((away.x / n) * 4, (away.z / n) * 4, OPEN)).toBe(true);
    expect(isShadedExact((-away.x / n) * 4, (-away.z / n) * 4, OPEN)).toBe(false);
    expect(isShadedExact(40, -40, OPEN)).toBe(false);
  });

  it("has a finite shadow length", () => {
    const away = { x: -SUN.x, z: -SUN.z };
    const n = Math.hypot(away.x, away.z);
    expect(isShadedExact((away.x / n) * 30, (away.z / n) * 30, OPEN)).toBe(false);
  });

  it("the precomputed grid agrees with the exact test", () => {
    const grid = buildShadeGrid(OPEN);
    let checked = 0;
    for (let x = -12; x <= 12; x += 1.3) {
      for (let z = -12; z <= 12; z += 1.1) {
        const cx = Math.floor((x - grid.origin) / grid.cellSize) * grid.cellSize + grid.origin + grid.cellSize / 2;
        const cz = Math.floor((z - grid.origin) / grid.cellSize) * grid.cellSize + grid.origin + grid.cellSize / 2;
        expect(shadeAt(grid, x, z)).toBe(isShadedExact(cx, cz, OPEN));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("the greybox map actually has shade to hide in", () => {
    const grid = buildShadeGrid(GREYBOX);
    const shaded = grid.data.reduce((a, b) => a + b, 0);
    expect(shaded).toBeGreaterThan(200);
  });
});

describe("health", () => {
  it("first entry starts at 40%", () => {
    const s = openSession();
    expect(s.join("a", "Ada").health).toBe(H.firstEntry);
  });

  it("drains faster crawling in sun than in shade", () => {
    const s = openSession();
    const p = s.join("a", "Ada");
    p.input = { forward: 0, turn: 1 }; // turning in place counts as moving, stays put
    p.inShade = false;
    const sun = s.drainPerSecond(p);
    p.inShade = true;
    const shade = s.drainPerSecond(p);
    expect(sun * 60).toBeCloseTo(H.drainPerMinute.crawlSun, 9);
    expect(shade * 60).toBeCloseTo(H.drainPerMinute.crawlShade, 9);
    expect(shade).toBeLessThan(sun);
  });

  it("never restores health in shade", () => {
    const s = openSession();
    const p = s.join("a", "Ada");
    const away = { x: -SUN.x, z: -SUN.z };
    const n = Math.hypot(away.x, away.z);
    p.x = (away.x / n) * 4;
    p.z = (away.z / n) * 4;
    const before = p.health;
    run(s, 10);
    expect(p.inShade).toBe(true);
    expect(p.health).toBeLessThan(before);
  });
});

describe("terminal state and death", () => {
  it("enters terminal at 10%, stops moving, and dies no sooner than 60 s later", () => {
    const s = openSession();
    const p = s.join("a", "Ada");
    p.health = H.terminalThreshold + 0.01;
    p.input = { forward: 1, turn: 0 };
    run(s, 1);
    expect(p.phase).toBe("terminal");
    const x = p.x;
    const z = p.z;
    s.setInput("a", { forward: 1, turn: 1 });
    run(s, 59);
    expect(p.phase).toBe("terminal");
    expect(p.x).toBe(x);
    expect(p.z).toBe(z);
    run(s, 2);
    expect(p.phase).toBe("dead");
  });

  it("a sudden big loss still leaves the full 60 s minimum", () => {
    const s = openSession();
    const p = s.join("a", "Ada");
    s.applyDamage("a", 39.9); // from 40% to 0.1%
    expect(p.phase).toBe("terminal");
    expect(p.health).toBe(H.terminalThreshold);
    run(s, 59.5);
    expect(p.phase).toBe("terminal");
    run(s, 1);
    expect(p.phase).toBe("dead");
  });

  it("dying takes about twice as long in shade", () => {
    const s = openSession();
    const p = s.join("a", "Ada");
    const away = { x: -SUN.x, z: -SUN.z };
    const n = Math.hypot(away.x, away.z);
    p.x = (away.x / n) * 4;
    p.z = (away.z / n) * 4;
    s.applyDamage("a", 35);
    run(s, 100);
    expect(p.phase).toBe("terminal");
    run(s, 21);
    expect(p.phase).toBe("dead");
  });

  it("a terminal player cannot drink, even at a well", () => {
    const s = openSession();
    const p = s.join("a", "Ada");
    s.applyDamage("a", 35);
    const well = [...s.wells.values()][0]!;
    p.x = well.x;
    p.z = well.z;
    run(s, 1);
    expect(s.wells.has(well.id)).toBe(true);
    expect(p.phase).toBe("terminal");
  });

  it("death leaves a skeleton and cross with the name; rejoin is at the same spot with 100%", () => {
    const s = openSession();
    const p = s.join("a", "Ada");
    p.x = 12;
    p.z = 20;
    s.applyDamage("a", 35);
    run(s, 61);
    expect(p.phase).toBe("dead");
    const marker = [...s.markers.values()][0]!;
    expect(marker).toMatchObject({ name: "Ada", x: 12, z: 20 });
    expect(s.rejoin("a")).toBe(true);
    expect(p).toMatchObject({ phase: "alive", health: 100, x: 12, z: 20 });
    expect(s.markers.size).toBe(1); // the old skeleton stays
    expect(s.rejoin("a")).toBe(false); // only the dead can rejoin
  });
});

describe("wells", () => {
  it("one well, two players arriving in the same step: exactly one drinks", () => {
    const s = openSession();
    const a = s.join("a", "Ada");
    const b = s.join("b", "Bo");
    const well = [...s.wells.values()][0]!;
    a.x = well.x + 0.5;
    a.z = well.z;
    b.x = well.x - 0.8;
    b.z = well.z;
    s.step(dt);
    expect(s.wells.has(well.id)).toBe(false);
    expect(a.health).toBeGreaterThan(99.9); // closer one wins (proposal); drained a sliver this step
    expect(b.health).toBeLessThan(H.firstEntry);
    const drinks = s.drainEvents().filter((e) => e.type === "drink");
    expect(drinks).toHaveLength(1);
  });

  it("drinking happens automatically, restores 100% and removes the well", () => {
    const s = openSession();
    const a = s.join("a", "Ada");
    const well = [...s.wells.values()][0]!;
    a.x = well.x;
    a.z = well.z - 3;
    a.heading = Math.PI; // face south, towards the well
    s.setInput("a", { forward: 1, turn: 0 });
    run(s, 6);
    expect(a.health).toBeGreaterThan(98);
    expect(s.wells.has(well.id)).toBe(false);
  });

  it("aims for about 3 wells with one player and 11 with thirty", () => {
    const s = new Session({ random: seeded(7) });
    s.join("p0", "p0");
    expect(s.targetWellCount()).toBe(3);
    for (let i = 1; i < 30; i++) s.join(`p${i}`, `p${i}`);
    expect(s.targetWellCount()).toBe(11);
  });

  it("refills over time but never places a well right next to a living player", () => {
    const s = new Session({ random: seeded(3) });
    s.join("a", "Ada");
    run(s, 60);
    expect(s.wells.size).toBe(3);
    const a = s.players.get("a")!;
    for (const w of s.wells.values()) {
      expect(Math.hypot(w.x - a.x, w.z - a.z)).toBeGreaterThanOrEqual(TUNING.wells.minDistanceFromPlayers);
    }
  });

  it("there is always water in the session when someone joins", () => {
    const s = openSession();
    s.join("a", "Ada");
    expect(s.wells.size).toBeGreaterThanOrEqual(1);
  });
});

describe("spawning", () => {
  it("never puts two new players on top of each other", () => {
    const s = new Session({ random: seeded(5) });
    for (let i = 0; i < 12; i++) s.join(`p${i}`, `p${i}`);
    const ps = [...s.players.values()];
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        expect(Math.hypot(ps[i]!.x - ps[j]!.x, ps[i]!.z - ps[j]!.z)).toBeGreaterThan(0.5);
      }
    }
  });
});
