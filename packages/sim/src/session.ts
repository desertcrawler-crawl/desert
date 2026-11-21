import { insideEllipse, type MapDef, type Site } from "./map.ts";
import { IDLE_INPUT, sanitizeInput, stepBody, type MoveInput } from "./movement.ts";
import { routeIsFair, routesFor, type RouteTable } from "./routes.ts";
import { shadeAt, shadeFor, type ShadeGrid } from "./shade.ts";
import { WORLD } from "./world.ts";
import { TUNING } from "./tuning.ts";

/**
 * alive    – can move, drink and slap.
 * terminal – at or below 10%: lies on the back, cannot move, drink or slap; dying is irreversible.
 * dead     – a skeleton and cross mark the spot; the player may rejoin there.
 */
export type Phase = "alive" | "terminal" | "dead";

/** crawl and walk can move; standingUp and lyingDown are the slow transitions between them. */
export type Posture = "crawl" | "standingUp" | "walk" | "lyingDown";

export interface SimPlayer {
  id: string;
  name: string;
  x: number;
  z: number;
  heading: number;
  health: number;
  phase: Phase;
  posture: Posture;
  /** Session time when the current posture transition ends. */
  postureUntil: number;
  inShade: boolean;
  /** Session time when the terminal state began, or null. */
  terminalSince: number | null;
  /** Session time when this player may slap again. */
  slapReadyAt: number;
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

/** A boundary guardian at a fixed post. Present when `time >= presentAt`. */
export interface SimScorpion {
  id: string;
  x: number;
  z: number;
  presentAt: number;
}

export type SessionEvent =
  | { type: "drink"; playerId: string; wellId: string }
  | { type: "wellSpawned"; wellId: string }
  | { type: "terminal"; playerId: string }
  | { type: "death"; playerId: string; markerId: string }
  | { type: "rejoin"; playerId: string }
  | { type: "slap"; from: string; target: { kind: "player" | "skeleton"; id: string } }
  | { type: "sting"; scorpionId: string; playerId: string };

export interface SessionOptions {
  map?: MapDef;
  shade?: ShadeGrid;
  routes?: RouteTable;
  /** Random source in [0, 1). Inject a seeded one in tests. */
  random?: () => number;
  /** Override first-entry health, for playtesting dying quickly. Defaults to TUNING.health.firstEntry. */
  firstEntryHealth?: number;
}

/** Everything needed to restore a session after a server restart. */
export interface SessionSnapshot {
  version: 1;
  time: number;
  nextId: number;
  nextWellAt: number;
  spawnCursor: number;
  players: SimPlayer[];
  wells: SimWell[];
  markers: SimMarker[];
  scorpions: SimScorpion[];
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
  readonly scorpions = new Map<string, SimScorpion>();

  private readonly map: MapDef;
  private readonly shade: ShadeGrid;
  private readonly routes: RouteTable;
  private readonly random: () => number;
  private readonly firstEntryHealth: number;
  private nextId = 1;
  private nextWellAt = 0;
  private spawnCursor = 0;
  private events: SessionEvent[] = [];

  constructor(opts: SessionOptions = {}) {
    this.map = opts.map ?? WORLD;
    this.shade = opts.shade ?? shadeFor(this.map);
    this.routes = opts.routes ?? routesFor(this.map);
    this.random = opts.random ?? Math.random;
    this.firstEntryHealth = opts.firstEntryHealth ?? TUNING.health.firstEntry;
    this.map.scorpions.forEach((s, i) => this.scorpions.set(`s${i}`, { id: `s${i}`, x: s.x, z: s.z, presentAt: 0 }));
  }

  /** First entry into the session: a predefined spawn with a fair crawling route to water. */
  join(id: string, name: string): SimPlayer {
    this.superviseWells(true);
    const spawn = this.pickFairSpawn();
    const p: SimPlayer = {
      id,
      name,
      x: spawn.x,
      z: spawn.z,
      heading: 0,
      health: this.firstEntryHealth,
      phase: "alive",
      posture: "crawl",
      postureUntil: 0,
      inShade: shadeAt(this.shade, spawn.x, spawn.z),
      terminalSince: null,
      slapReadyAt: 0,
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

  /** Space asks to stand and walk; Ctrl asks to get down and crawl. Both take time. */
  requestPosture(id: string, want: unknown): void {
    const p = this.players.get(id);
    if (!p || p.phase !== "alive") return;
    const t = TUNING.posture;
    if (want === "walk" && p.posture === "crawl") {
      p.posture = "standingUp";
      p.postureUntil = this.time + t.standUpSeconds;
    } else if (want === "crawl" && p.posture === "walk") {
      p.posture = "lyingDown";
      p.postureUntil = this.time + t.lieDownSeconds;
    }
  }

  /** After death: a new exhausted character at exactly the death spot, 100% health, crawling. */
  rejoin(id: string): boolean {
    const p = this.players.get(id);
    if (!p || p.phase !== "dead") return false;
    p.phase = "alive";
    p.health = TUNING.health.rejoin;
    p.terminalSince = null;
    p.posture = "crawl";
    p.input = IDLE_INPUT;
    this.events.push({ type: "rejoin", playerId: id });
    return true;
  }

  /**
   * Slap the nearest player or skeleton in front of you. The slapper pays a
   * small health cost; the recipient loses nothing. Returns what was slapped.
   */
  slap(id: string): SessionEvent | null {
    const p = this.players.get(id);
    const s = TUNING.slap;
    if (!p || p.phase !== "alive" || this.time < p.slapReadyAt) return null;
    if (p.posture === "standingUp" || p.posture === "lyingDown") return null;

    const cosCone = Math.cos((s.coneDeg * Math.PI) / 180);
    const fx = Math.sin(p.heading);
    const fz = -Math.cos(p.heading);
    let best: { kind: "player" | "skeleton"; id: string; d: number } | null = null;
    const consider = (kind: "player" | "skeleton", tid: string, x: number, z: number) => {
      const dx = x - p.x;
      const dz = z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > s.range) return;
      if (d > 0.05 && (dx * fx + dz * fz) / d < cosCone) return;
      if (!best || d < best.d) best = { kind, id: tid, d };
    };
    for (const o of this.players.values()) {
      if (o.id !== id && o.phase !== "dead") consider("player", o.id, o.x, o.z);
    }
    for (const m of this.markers.values()) consider("skeleton", m.id, m.x, m.z);
    if (!best) return null;
    const target = best as { kind: "player" | "skeleton"; id: string };

    p.slapReadyAt = this.time + s.cooldownSeconds;
    const event: SessionEvent = { type: "slap", from: id, target: { kind: target.kind, id: target.id } };
    this.events.push(event);
    this.applyDamage(id, s.cost); // may tip the slapper into the terminal state
    return event;
  }

  /** Events since the last call (drinks, deaths, slaps, stings...), for sounds and effects. */
  drainEvents(): SessionEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /**
   * One fixed simulation step. The order is part of the rules:
   * 1 posture, 2 move, 3 well claims, 4 scorpions, 5 lose health, 6 terminal and death, 7 well supply.
   * Drinking resolves before the health check of the same step (spec working proposal).
   */
  step(dt: number): void {
    this.time += dt;

    // 1. Finish posture transitions.
    for (const p of this.players.values()) {
      if (p.posture === "standingUp" && this.time >= p.postureUntil) p.posture = "walk";
      if (p.posture === "lyingDown" && this.time >= p.postureUntil) p.posture = "crawl";
    }

    // 2. Movement. Only living players move, and not while getting up or down.
    const m = TUNING.movement;
    for (const p of this.players.values()) {
      if (p.phase !== "alive") {
        p.inShade = shadeAt(this.shade, p.x, p.z);
        continue;
      }
      if (p.posture === "crawl" || p.posture === "walk") {
        const speed = p.posture === "walk" ? m.walkSpeed : m.crawlSpeed;
        const next = stepBody(p, p.input, dt, this.map, speed);
        p.x = next.x;
        p.z = next.z;
        p.heading = next.heading;
      }
      p.inShade = shadeAt(this.shade, p.x, p.z);
    }

    // 3. Wells. Each well serves exactly one player; each player drinks at most once per step.
    this.resolveDrinks();

    // 4. Scorpions sting anyone mobile who comes too close, then die; a replacement returns later.
    this.resolveScorpions();

    // 5 and 6. Health, terminal state and death.
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

    // 7. Keep water supply near its target.
    this.superviseWells(false);
  }

  /** Health lost per second while alive, from posture, movement and shade. */
  drainPerSecond(p: SimPlayer): number {
    const d = TUNING.health.drainPerMinute;
    const moving = p.input.forward !== 0 || p.input.turn !== 0;
    const upright = p.posture !== "crawl";
    // Getting up or down is physically demanding: it costs like walking.
    const effort = upright && (moving || p.posture === "standingUp" || p.posture === "lyingDown");
    let perMinute: number;
    if (effort) perMinute = p.inShade ? d.walkShade : d.walkSun;
    else if (moving) perMinute = p.inShade ? d.crawlShade : d.crawlSun;
    else perMinute = p.inShade ? d.idleShade : d.idleSun;
    return perMinute / 60;
  }

  /** Any sudden loss (a sting or a slap's cost) goes through here so the 60 s rule holds. */
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

  isScorpionPresent(s: SimScorpion): boolean {
    return this.time >= s.presentAt;
  }

  snapshot(): SessionSnapshot {
    return structuredClone({
      version: 1 as const,
      time: this.time,
      nextId: this.nextId,
      nextWellAt: this.nextWellAt,
      spawnCursor: this.spawnCursor,
      players: [...this.players.values()],
      wells: [...this.wells.values()],
      markers: [...this.markers.values()],
      scorpions: [...this.scorpions.values()],
    });
  }

  restore(snap: SessionSnapshot): void {
    if (snap.version !== 1) throw new Error(`Unknown snapshot version ${snap.version}`);
    this.time = snap.time;
    this.nextId = snap.nextId;
    this.nextWellAt = snap.nextWellAt;
    this.spawnCursor = snap.spawnCursor;
    for (const [m, list] of [
      [this.players, snap.players],
      [this.wells, snap.wells],
      [this.markers, snap.markers],
      [this.scorpions, snap.scorpions],
    ] as [Map<string, { id: string }>, { id: string }[]][]) {
      m.clear();
      for (const v of structuredClone(list)) m.set(v.id, v);
    }
  }

  private enterTerminal(p: SimPlayer): void {
    p.phase = "terminal";
    // A sudden drop below 10% still leaves a full minimum dying period: dying starts from 10%.
    p.health = Math.max(p.health, TUNING.health.terminalThreshold);
    p.terminalSince = this.time;
    p.posture = "crawl"; // lying on the back from here on
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

  private resolveScorpions(): void {
    const s = TUNING.scorpions;
    const r2 = s.triggerRange ** 2;
    for (const sc of this.scorpions.values()) {
      if (!this.isScorpionPresent(sc)) continue;
      let victim: SimPlayer | null = null;
      let best = Infinity;
      for (const p of this.players.values()) {
        // Terminal bodies are left alone (spec working proposal).
        if (p.phase !== "alive") continue;
        const d2 = (p.x - sc.x) ** 2 + (p.z - sc.z) ** 2;
        if (d2 <= r2 && d2 < best) {
          best = d2;
          victim = p;
        }
      }
      if (!victim) continue;
      // One sting per appearance: the scorpion dies, a replacement comes back to the same spot.
      sc.presentAt = this.time + s.respawnSeconds;
      this.events.push({ type: "sting", scorpionId: sc.id, playerId: victim.id });
      this.applyDamage(victim.id, s.damage);
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
    if (site !== null) this.spawnWell(site);
  }

  private spawnWell(site: number): SimWell {
    const s = this.map.wellSites[site]!;
    const well: SimWell = { id: `w${this.nextId++}`, site, x: s.x, z: s.z };
    this.wells.set(well.id, well);
    this.nextWellAt = this.time + TUNING.wells.spawnIntervalSeconds;
    this.events.push({ type: "wellSpawned", wellId: well.id });
    return well;
  }

  private freeWellSites(): number[] {
    const used = new Set([...this.wells.values()].map((w) => w.site));
    const min2 = TUNING.wells.minDistanceFromPlayers ** 2;
    const free: number[] = [];
    this.map.wellSites.forEach((s, i) => {
      if (used.has(i) || this.inBoundaryBand(s)) return;
      for (const p of this.players.values()) {
        if (p.phase !== "dead" && (p.x - s.x) ** 2 + (p.z - s.z) ** 2 < min2) return;
      }
      free.push(i);
    });
    return free;
  }

  private pickWellSite(): number | null {
    const free = this.freeWellSites();
    if (free.length === 0) return null;
    return free[Math.floor(this.random() * free.length)]!;
  }

  private inBoundaryBand(s: Site): boolean {
    return !insideEllipse(this.map.interior, s.x, s.z);
  }

  /**
   * Spec working placement policy:
   * 1. Use a predefined spawn (not on another player) whose crawling route to
   *    an active public well meets the first-water target.
   * 2. If none qualifies, create an ordinary public well at an authored site
   *    that does, then place the entrant. It can still be contested.
   * 3. Otherwise fall back to any clear spawn. (The spec's "briefly defer entry"
   *    is not implemented yet; on this map step 2 always succeeds.)
   */
  private pickFairSpawn(): Site {
    const spawns = this.map.spawns;
    const order = spawns.map((_, i) => (this.spawnCursor + i) % spawns.length);
    const clear = order.filter((i) => {
      const s = spawns[i]!;
      return !this.inBoundaryBand(s) && [...this.players.values()].every((p) => (p.x - s.x) ** 2 + (p.z - s.z) ** 2 > 4);
    });
    const fair = (spawn: number, site: number) => {
      const route = this.routes[spawn]?.[site];
      return route ? routeIsFair(route, this.firstEntryHealth) : this.routes.length === 0;
    };
    const take = (i: number): Site => {
      this.spawnCursor = (i + 1) % spawns.length;
      return spawns[i]!;
    };

    for (const i of clear) {
      if ([...this.wells.values()].some((w) => fair(i, w.site))) return take(i);
    }
    const free = this.freeWellSites();
    for (const i of clear) {
      const site = free.find((f) => fair(i, f));
      if (site !== undefined) {
        this.spawnWell(site);
        return take(i);
      }
    }
    if (clear.length > 0) return take(clear[0]!);
    // Everyone is standing on the spawns: offset a little from the next one.
    const s = spawns[this.spawnCursor++ % spawns.length]!;
    const rough = { x: s.x + (this.random() - 0.5) * 6, z: s.z + (this.random() - 0.5) * 6, heading: 0 };
    return stepBody(rough, IDLE_INPUT, 0, this.map); // pushes it out of any rock
  }
}
