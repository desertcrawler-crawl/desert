import { describe, expect, it } from "vitest";
import {
  buildRouteTable,
  buildShadeGrid,
  GREYBOX,
  greyboxRoutes,
  routeIsFair,
  Session,
  TUNING,
  type GreyboxMap,
} from "../src/index.ts";

const dt = 1 / TUNING.tickHz;
function run(s: Session, seconds: number) {
  for (let i = 0; i < Math.round(seconds / dt); i++) s.step(dt);
}
function seeded(seed = 1) {
  let v = seed;
  return () => ((v = (v * 16807) % 2147483647) / 2147483647);
}

const OPEN: GreyboxMap = {
  halfSize: 50,
  rocks: [],
  spawns: [{ x: -30, z: -30 }],
  wellSites: [{ x: 30, z: 30 }],
  scorpions: [{ x: 0, z: 40 }],
  boundaryBand: 5,
};
const open = () => new Session({ map: OPEN, shade: buildShadeGrid(OPEN), random: seeded() });

describe("walking", () => {
  it("getting up takes time, then walking is only slightly faster than crawling", () => {
    const s = open();
    const p = s.join("a", "Ada");
    p.heading = 0;
    s.requestPosture("a", "walk");
    expect(p.posture).toBe("standingUp");
    s.setInput("a", { forward: 1, turn: 0 });
    const z0 = p.z;
    run(s, TUNING.posture.standUpSeconds - 0.1);
    expect(p.z).toBe(z0); // cannot move while getting up
    run(s, 0.2);
    expect(p.posture).toBe("walk");
    const z1 = p.z;
    run(s, 10);
    expect((z1 - p.z) / 10).toBeCloseTo(TUNING.movement.walkSpeed, 1);
  });

  it("walking costs more health per minute than crawling", () => {
    const s = open();
    const p = s.join("a", "Ada");
    p.input = { forward: 1, turn: 0 };
    const crawl = s.drainPerSecond(p);
    p.posture = "walk";
    expect(s.drainPerSecond(p)).toBeGreaterThan(crawl);
  });

  it("drinking does not make you stronger: posture and speed are unchanged", () => {
    const s = open();
    const p = s.join("a", "Ada");
    const w = [...s.wells.values()][0]!;
    p.x = w.x;
    p.z = w.z;
    s.step(dt);
    expect(p.health).toBeGreaterThan(99);
    expect(p.posture).toBe("crawl");
  });

  it("a terminal player cannot stand up", () => {
    const s = open();
    const p = s.join("a", "Ada");
    s.applyDamage("a", 35);
    s.requestPosture("a", "walk");
    expect(p.posture).toBe("crawl");
  });
});

describe("slapping", () => {
  function pair() {
    const s = open();
    const a = s.join("a", "Ada");
    const b = s.join("b", "Bo");
    a.x = 0;
    a.z = 0;
    a.heading = 0; // facing north (-z)
    b.x = 0;
    b.z = -1;
    return { s, a, b };
  }

  it("costs the slapper a little health and the recipient nothing", () => {
    const { s, a, b } = pair();
    const ha = a.health;
    const hb = b.health;
    const e = s.slap("a");
    expect(e).toMatchObject({ type: "slap", target: { kind: "player", id: "b" } });
    expect(a.health).toBeCloseTo(ha - TUNING.slap.cost, 9);
    expect(b.health).toBe(hb);
  });

  it("has a cooldown and a limited range", () => {
    const { s, b } = pair();
    expect(s.slap("a")).not.toBeNull();
    expect(s.slap("a")).toBeNull();
    run(s, TUNING.slap.cooldownSeconds + 0.1);
    b.z = -(TUNING.slap.range + 0.5);
    expect(s.slap("a")).toBeNull();
  });

  it("only hits what is in front", () => {
    const { s, b } = pair();
    b.z = 1; // behind
    expect(s.slap("a")).toBeNull();
  });

  it("dying players can be slapped but cannot slap", () => {
    const { s, b } = pair();
    s.applyDamage("b", 35);
    expect(b.phase).toBe("terminal");
    expect(s.slap("a")).toMatchObject({ target: { kind: "player", id: "b" } });
    expect(s.slap("b")).toBeNull();
  });

  it("skeletons can be slapped, at the same cost", () => {
    const { s, a, b } = pair();
    s.applyDamage("b", 35);
    run(s, 61);
    expect(b.phase).toBe("dead");
    const ha = a.health;
    const e = s.slap("a");
    expect(e).toMatchObject({ target: { kind: "skeleton" } });
    expect(a.health).toBeLessThan(ha - TUNING.slap.cost + 0.01);
  });

  it("the slap cost can tip the slapper into the dying state, never straight to death", () => {
    const { s, a } = pair();
    a.health = TUNING.health.terminalThreshold + 0.5;
    s.slap("a");
    expect(a.phase).toBe("terminal");
  });
});

describe("scorpions", () => {
  it("sting once, hurt but do not kill, die, and return to the same spot after 10 s", () => {
    const s = open();
    const p = s.join("a", "Ada");
    const sc = [...s.scorpions.values()][0]!;
    p.x = sc.x;
    p.z = sc.z - 1;
    const before = p.health;
    s.step(dt);
    expect(p.health).toBeCloseTo(before - TUNING.scorpions.damage, 0);
    expect(s.isScorpionPresent(sc)).toBe(false);
    const after = p.health;
    run(s, 5);
    expect(p.health).toBeGreaterThan(after - 1); // no second sting while gone
    p.z = sc.z - 20; // step away so the returning scorpion has nobody to sting
    run(s, 5.1);
    expect(s.isScorpionPresent(sc)).toBe(true);
    expect([sc.x, sc.z]).toEqual([0, 40]);
  });

  it("a sting that drops a player below 10% starts the full dying period instead of killing", () => {
    const s = open();
    const p = s.join("a", "Ada");
    p.health = 12;
    const sc = [...s.scorpions.values()][0]!;
    p.x = sc.x;
    p.z = sc.z;
    s.step(dt);
    expect(p.phase).toBe("terminal");
    run(s, 59);
    expect(p.phase).toBe("terminal");
  });

  it("leave dying players alone", () => {
    const s = open();
    const p = s.join("a", "Ada");
    s.applyDamage("a", 35);
    const sc = [...s.scorpions.values()][0]!;
    p.x = sc.x;
    p.z = sc.z;
    s.step(dt);
    expect(s.isScorpionPresent(sc)).toBe(true);
  });

  it("greybox wells and spawns stay out of the scorpion boundary band", () => {
    const lim = GREYBOX.halfSize - GREYBOX.boundaryBand;
    for (const p of [...GREYBOX.wellSites, ...GREYBOX.spawns]) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(lim);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(lim);
    }
    for (const sc of GREYBOX.scorpions) {
      expect(Math.max(Math.abs(sc.x), Math.abs(sc.z))).toBeGreaterThan(lim);
    }
  });
});

describe("fair first spawns", () => {
  it("route costs follow real paths: going around a rock costs more than the straight line", () => {
    const wall: GreyboxMap = {
      halfSize: 50,
      rocks: [{ id: "r", x: 0, z: 0, radius: 8, height: 1 }],
      spawns: [{ x: -15, z: 0 }],
      wellSites: [{ x: 15, z: 0 }],
      scorpions: [],
      boundaryBand: 5,
    };
    const table = buildRouteTable(wall, buildShadeGrid(wall));
    const straight = 30 / TUNING.movement.crawlSpeed;
    expect(table[0]![0]!.seconds).toBeGreaterThan(straight * 1.1);
  });

  it("every greybox spawn has at least one well site meeting the first-water target", () => {
    const table = greyboxRoutes();
    table.forEach((row) => {
      expect(row.some((r) => routeIsFair(r, TUNING.health.firstEntry))).toBe(true);
    });
  });

  it("a new player always gets a fair route to an active public well", () => {
    for (let seed = 1; seed < 15; seed++) {
      const s = new Session({ random: seeded(seed) });
      for (let i = 0; i < 8; i++) {
        const p = s.join(`p${i}`, `p${i}`);
        const spawn = GREYBOX.spawns.findIndex((sp) => sp.x === p.x && sp.z === p.z);
        if (spawn < 0) continue; // offset spawn when all are occupied
        const ok = [...s.wells.values()].some((w) => routeIsFair(greyboxRoutes()[spawn]![w.site]!, p.health));
        expect(ok).toBe(true);
      }
    }
  });
});

describe("snapshots", () => {
  it("restoring a snapshot gives back the same world, skeletons included", () => {
    const s = new Session({ random: seeded(2) });
    s.join("a", "Ada");
    s.join("b", "Bo");
    s.applyDamage("b", 35);
    run(s, 70);
    const snap = JSON.parse(JSON.stringify(s.snapshot()));
    const t = new Session({ random: seeded(2) });
    t.restore(snap);
    expect(t.time).toBeCloseTo(s.time, 6);
    expect([...t.markers.values()]).toEqual([...s.markers.values()]);
    expect([...t.wells.values()]).toEqual([...s.wells.values()]);
    expect(t.players.get("a")).toEqual(s.players.get("a"));
  });
});

describe("a busy session", () => {
  it("30 wandering players for 5 minutes keep every invariant", () => {
    const rnd = seeded(11);
    const s = new Session({ random: rnd });
    for (let i = 0; i < 30; i++) s.join(`p${i}`, `p${i}`);
    let drinks = 0;
    const consumed = new Set<string>();
    for (let step = 0; step < 300 * TUNING.tickHz; step++) {
      if (step % 20 === 0) {
        for (const p of s.players.values()) {
          s.setInput(p.id, { forward: rnd() < 0.8 ? 1 : 0, turn: rnd() < 0.3 ? (rnd() < 0.5 ? -1 : 1) : 0 });
          if (rnd() < 0.05) s.slap(p.id);
          if (p.phase === "dead" && rnd() < 0.2) s.rejoin(p.id);
        }
      }
      s.step(dt);
      for (const e of s.drainEvents()) {
        if (e.type === "drink") {
          expect(consumed.has(e.wellId)).toBe(false); // no well drunk twice
          consumed.add(e.wellId);
          drinks++;
        }
      }
      for (const p of s.players.values()) {
        expect(p.health).toBeGreaterThanOrEqual(0);
        expect(p.health).toBeLessThanOrEqual(100);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(GREYBOX.halfSize);
        expect(Math.abs(p.z)).toBeLessThanOrEqual(GREYBOX.halfSize);
      }
    }
    expect(drinks).toBeGreaterThan(0);
    expect(s.wells.size).toBeLessThanOrEqual(s.targetWellCount());
  });
});
