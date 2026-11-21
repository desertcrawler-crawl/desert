import { GREYBOX, type GreyboxMap, type Site } from "./greybox.ts";
import { IDLE_INPUT, sanitizeInput, stepBody, type MoveInput } from "./movement.ts";
import { greyboxShade, shadeAt, type ShadeGrid } from "./shade.ts";
import { TUNING } from "./tuning.ts";

/**
 * alive    – can crawl, drink and (later) slap.
 * terminal – at or below 10%: lies on the back, cannot move or drink; dying is irreversible.
 * dead     – a skeleton and cross mark the spot; the player may rejoin there.
 */
export type Phase = "alive" | "terminal" | "dead";

export interface SimPlayer {
  id: string;
  name: string;
  x: number;
  z: number;
  heading: number;
  health: number;
  phase: Phase;
  inShade: boolean;
  /** Session time when the terminal state began, or null. */
  terminalSince: number | null;
  input: MoveInput;
}

export interface SimWell {
  id: string;
  site: number;
  x: number;
  z: number;
}

/** A skeleton and its wooden cross. They stay for the rest of the session. */
export interface SimMarker {
  id: string;
  name: string;
  x: number;
  z: number;
  heading: number;
}

export type SessionEvent =
  | { type: "drink"; playerId: string; wellId: string }
  | { type: "wellSpawned"; wellId: string }
  | { type: "terminal"; playerId: string }
  | { type: "death"; playerId: string; markerId: string }
  | { type: "rejoin"; playerId: string };

export interface SessionOptions {
  map?: GreyboxMap;
  shade?: ShadeGrid;
  /** Random source in [0, 1). Inject a seeded one in tests. */
  random?: () => number;
  /** Override first-entry health, for playtesting dying quickly. Defaults to TUNING.health.firstEntry. */
  firstEntryHealth?: number;
}

/**
 * One desert session's rules, with no networking and no rendering.
 * The server runs it authoritatively; tests and bots run it headless.
 */
export class Session {
  time = 0;
  readonly players = new Map<string, SimPlayer>();
  readonly wells = new Map<string, SimWell>();
  readonly markers = new Map<string, SimMarker>();

  private readonly map: GreyboxMap;
  private readonly shade: ShadeGrid;
  private readonly random: () => number;
  private readonly firstEntryHealth: number;
  private nextId = 1;
  private nextWellAt = 0;
  private spawnCursor = 0;
  private events: SessionEvent[] = [];

  constructor(opts: SessionOptions = {}) {
    this.map = opts.map ?? GREYBOX;
    this.shade = opts.shade ?? greyboxShade();
    this.random = opts.random ?? Math.random;
    this.firstEntryHealth = opts.firstEntryHealth ?? TUNING.health.firstEntry;
  }

  /** First entry into the session: predefined spawn, starting health below 50%. */
  join(id: string, name: string): SimPlayer {
    // Make sure water exists before the entrant appears (spec working placement policy, simplified for M1).
    this.superviseWells(true);
    const spawn = this.pickSpawn();
    const p: SimPlayer = {
      id,
      name,
      x: spawn.x,
      z: spawn.z,
      heading: 0,
      health: this.firstEntryHealth,
      phase: "alive",
      inShade: shadeAt(this.shade, spawn.x, spawn.z),
      terminalSince: null,
      input: IDLE_INPUT,
    };
    this.players.set(id, p);
    return p;
  }

  leave(id: string): void {
    this.players.delete(id);
  }

  setInput(id: string, raw: unknown): void {
    const p = this.players.get(id);
    if (p) p.input = sanitizeInput(raw);
  }

  /** After death: a new exhausted character at exactly the death spot, 100% health, crawling. */
  rejoin(id: string): boolean {
    const p = this.players.get(id);
    if (!p || p.phase !== "dead") return false;
    p.phase = "alive";
    p.health = TUNING.health.rejoin;
    p.terminalSince = null;
    p.input = IDLE_INPUT;
    this.events.push({ type: "rejoin", playerId: id });
    return true;
  }

  /** Events since the last call (drinks, deaths, ...), for sounds and effects. */
  drainEvents(): SessionEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /**
   * One fixed simulation step. The order is part of the rules:
   * 1 move, 2 resolve well claims, 3 lose health, 4 terminal and death, 5 well supply.
   * Drinking resolves before the health check of the same step (spec working proposal).
   */
  step(dt: number): void {
    this.time += dt;

    // 1. Movement. Only living, non-terminal players move.
    for (const p of this.players.values()) {
      if (p.phase !== "alive") continue;
      const next = stepBody(p, p.input, dt, this.map);
      p.x = next.x;
      p.z = next.z;
      p.heading = next.heading;
      p.inShade = shadeAt(this.shade, p.x, p.z);
    }
    for (const p of this.players.values()) {
      if (p.phase === "terminal") p.inShade = shadeAt(this.shade, p.x, p.z);
    }

    // 2. Wells. Each well serves exactly one player; each player drinks at most once per step.
    this.resolveDrinks();

    // 3 and 4. Health, terminal state and death.
    const h = TUNING.health;
    for (const p of this.players.values()) {
      if (p.phase === "alive") {
        p.health = Math.max(0, p.health - this.drainPerSecond(p) * dt);
        if (p.health <= h.terminalThreshold) this.enterTerminal(p);
      } else if (p.phase === "terminal") {
        const seconds = p.inShade ? h.terminalSecondsShade : h.terminalSecondsSun;
        p.health = Math.max(0, p.health - (h.terminalThreshold / seconds) * dt);
        const elapsed = this.time - (p.terminalSince ?? this.time);
        if (p.health <= 0 && elapsed >= h.terminalMinSeconds - 1e-9) this.die(p);
      }
    }

    // 5. Keep water supply near its target.
    this.superviseWells(false);
  }

  /** Health lost per second while alive, from posture, movement and shade. */
  drainPerSecond(p: SimPlayer): number {
    const d = TUNING.health.drainPerMinute;
    const moving = p.input.forward !== 0 || p.input.turn !== 0;
    const perMinute = moving ? (p.inShade ? d.crawlShade : d.crawlSun) : p.inShade ? d.idleShade : d.idleSun;
    return perMinute / 60;
  }

  /** Any sudden loss (later: a sting or a slap's cost) must go through here so the 60 s rule holds. */
  applyDamage(id: string, amount: number): void {
    const p = this.players.get(id);
    if (!p || p.phase !== "alive") return;
    p.health = Math.max(0, p.health - amount);
    if (p.health <= TUNING.health.terminalThreshold) this.enterTerminal(p);
  }

  /** How many active wells the session aims for with its current number of players. */
  targetWellCount(): number {
    const n = this.players.size;
    if (n === 0) return 0;
    const w = TUNING.wells;
    const t = Math.min(1, (n - 1) / (TUNING.session.maxPlayers - 1));
    return Math.round(w.activeAtOnePlayer + t * (w.activeAtThirtyPlayers - w.activeAtOnePlayer));
  }

  private enterTerminal(p: SimPlayer): void {
    p.phase = "terminal";
    // A sudden drop below 10% still leaves a full minimum dying period: dying starts from 10%.
    p.health = Math.max(p.health, TUNING.health.terminalThreshold);
    p.terminalSince = this.time;
    p.input = IDLE_INPUT;
    this.events.push({ type: "terminal", playerId: p.id });
  }

  private die(p: SimPlayer): void {
    p.phase = "dead";
    p.health = 0;
    p.terminalSince = null;
    const marker: SimMarker = { id: `m${this.nextId++}`, name: p.name, x: p.x, z: p.z, heading: p.heading };
    this.markers.set(marker.id, marker);
    this.events.push({ type: "death", playerId: p.id, markerId: marker.id });
  }

  private resolveDrinks(): void {
    const r2 = TUNING.wells.drinkRadius ** 2;
    const drank = new Set<string>();
    // Closest pairs first: if two players reach a well in the same step, the closer one drinks (proposal).
    const claims: { d2: number; player: SimPlayer; well: SimWell }[] = [];
    for (const well of this.wells.values()) {
      for (const p of this.players.values()) {
        if (p.phase !== "alive") continue;
        const d2 = (p.x - well.x) ** 2 + (p.z - well.z) ** 2;
        if (d2 <= r2) claims.push({ d2, player: p, well });
      }
    }
    claims.sort((a, b) => a.d2 - b.d2 || a.player.id.localeCompare(b.player.id));
    for (const c of claims) {
      if (drank.has(c.player.id) || !this.wells.has(c.well.id)) continue;
      this.wells.delete(c.well.id);
      drank.add(c.player.id);
      c.player.health = 100;
      this.events.push({ type: "drink", playerId: c.player.id, wellId: c.well.id });
    }
  }

  private superviseWells(immediate: boolean): void {
    const target = Math.max(this.targetWellCount(), immediate ? 1 : 0);
    if (this.wells.size >= target) {
      this.nextWellAt = this.time + TUNING.wells.spawnIntervalSeconds;
      return;
    }
    if (!immediate && this.wells.size > 0 && this.time < this.nextWellAt) return;
    const site = this.pickWellSite();
    if (site === null) return;
    const s = this.map.wellSites[site]!;
    const well: SimWell = { id: `w${this.nextId++}`, site, x: s.x, z: s.z };
    this.wells.set(well.id, well);
    this.nextWellAt = this.time + TUNING.wells.spawnIntervalSeconds;
    this.events.push({ type: "wellSpawned", wellId: well.id });
  }

  private pickWellSite(): number | null {
    const used = new Set([...this.wells.values()].map((w) => w.site));
    const min2 = TUNING.wells.minDistanceFromPlayers ** 2;
    const free: number[] = [];
    this.map.wellSites.forEach((s, i) => {
      if (used.has(i)) return;
      for (const p of this.players.values()) {
        if (p.phase !== "dead" && (p.x - s.x) ** 2 + (p.z - s.z) ** 2 < min2) return;
      }
      free.push(i);
    });
    if (free.length === 0) return null;
    return free[Math.floor(this.random() * free.length)]!;
  }

  private pickSpawn(): Site {
    const spawns = this.map.spawns;
    // Never directly on top of another player.
    for (let i = 0; i < spawns.length; i++) {
      const s = spawns[(this.spawnCursor + i) % spawns.length]!;
      const clear = [...this.players.values()].every((p) => (p.x - s.x) ** 2 + (p.z - s.z) ** 2 > 4);
      if (clear) {
        this.spawnCursor = (this.spawnCursor + i + 1) % spawns.length;
        return s;
      }
    }
    // All taken: offset a little from the next spawn.
    const s = spawns[this.spawnCursor++ % spawns.length]!;
    const rough = { x: s.x + (this.random() - 0.5) * 6, z: s.z + (this.random() - 0.5) * 6, heading: 0 };
    return stepBody(rough, IDLE_INPUT, 0, this.map); // pushes it out of any rock
  }
}
