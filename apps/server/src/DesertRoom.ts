import { Room, type Client } from "@colyseus/core";
import { Session, TUNING, type SessionEvent } from "@desert/sim";
import { cleanToken, deleteRoom, saveRoom, type ParkedPlayers, type SavedRoom } from "./persistence.ts";
import { recordTick, STATS } from "./stats.ts";
import { DesertState, MarkerState, PlayerState, ScorpionState, WellState } from "./state.ts";

export interface JoinOptions {
  name?: unknown;
  /** The browser's private character token, for getting the character back after a server restart. */
  token?: unknown;
}

export interface CreateOptions {
  restore?: SavedRoom;
}

/** How often a running session is saved to disk, seconds. */
const SAVE_EVERY_SECONDS = 10;

export interface ChatLine {
  name: string;
  text: string;
}

/** Room name clients ask for. One room = one independent desert session. */
export const ROOM_NAME = "desert";

const CHAT_HISTORY = 30;

/**
 * One session of the desert. The rules run in the shared Session class;
 * this room only handles connections, chat, and copying the results into the
 * synchronised state. Clients send intentions, never results.
 */
export class DesertRoom extends Room<{ state: DesertState }> {
  maxClients = TUNING.session.maxPlayers;
  state = new DesertState();
  readonly session = new Session({ firstEntryHealth: playtestStartHealth() });
  // Empty sessions linger for a grace period instead of vanishing at once (see onLeave).
  autoDispose = false;

  private chatLog: ChatLine[] = [];
  private lastChatAt = new Map<string, number>();
  private emptyTimer: { clear(): void } | null = null;
  /** sessionId -> browser token, for the players connected now. */
  private tokens = new Map<string, string>();
  /** Characters restored from disk whose players have not come back yet, by token. */
  private parked: ParkedPlayers = new Map();
  /** True when the session ends for good (empty grace over), so its save is deleted. */
  private retiring = false;
  private shuttingDown = false;

  onCreate(options?: CreateOptions) {
    if (options?.restore) this.restoreFrom(options.restore);
    this.onMessage("input", (client, raw) => this.session.setInput(client.sessionId, raw));
    this.onMessage("posture", (client, want) => this.session.requestPosture(client.sessionId, want));
    this.onMessage("slap", (client) => this.session.slap(client.sessionId));
    this.onMessage("rejoin", (client) => this.session.rejoin(client.sessionId));
    this.onMessage("chat", (client, raw) => this.chat(client, raw));

    const dt = 1 / TUNING.tickHz;
    this.setSimulationInterval(() => this.tick(dt), 1000 / TUNING.tickHz);
    this.clock.setInterval(() => this.save(), SAVE_EVERY_SECONDS * 1000);
    this.armEmptyTimer();
  }

  /** Server shutting down (deploy or restart): save before players are disconnected. */
  onBeforeShutdown() {
    this.save();
    this.shuttingDown = true;
    super.onBeforeShutdown();
  }

  onDispose() {
    if (this.retiring) deleteRoom(this.roomId);
  }

  onJoin(client: Client, options?: JoinOptions) {
    this.emptyTimer?.clear();
    this.emptyTimer = null;
    const token = cleanToken(options?.token);
    const inUse = token !== null && [...this.tokens.values()].includes(token);
    if (token && !inUse) this.tokens.set(client.sessionId, token);
    const saved = token && !inUse ? this.parked.get(token) : undefined;
    if (saved) {
      this.parked.delete(token!);
      this.session.adopt(client.sessionId, saved);
    } else {
      this.session.join(client.sessionId, cleanName(options?.name));
    }
    STATS.joins++;
    client.send("chatHistory", this.chatLog);
    this.sync();
  }

  /** Unexpected disconnect: keep the living character for a short while so the player can come back. */
  async onDrop(client: Client) {
    try {
      await this.allowReconnection(client, TUNING.session.reconnectSeconds);
    } catch {
      /* timed out: onLeave follows */
    }
  }

  onLeave(client: Client) {
    this.session.leave(client.sessionId);
    this.lastChatAt.delete(client.sessionId);
    this.tokens.delete(client.sessionId);
    this.sync();
    if (this.clients.length === 0) this.armEmptyTimer();
  }

  tick(dt: number) {
    const t0 = performance.now();
    this.session.step(dt);
    for (const e of this.session.drainEvents()) this.effect(e);
    this.sync();
    recordTick(performance.now() - t0);
  }

  /** Session-wide chat. Living, dying and dead-but-connected players may chat (spec proposal for the dead). */
  private chat(client: Client, raw: unknown) {
    const player = this.session.players.get(client.sessionId);
    if (!player || typeof raw !== "string") return;
    const text = raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, TUNING.chat.maxLength);
    if (!text) return;
    const now = this.session.time;
    const last = this.lastChatAt.get(client.sessionId) ?? -Infinity;
    if (now - last < TUNING.chat.minIntervalSeconds) return; // rate limit
    this.lastChatAt.set(client.sessionId, now);
    const line: ChatLine = { name: player.name, text };
    this.chatLog.push(line);
    if (this.chatLog.length > CHAT_HISTORY) this.chatLog.shift();
    STATS.chatLines++;
    this.broadcast("chat", line);
  }

  /** One-off moments (slaps, stings, drinks, deaths) for animation and sound. */
  private effect(e: SessionEvent) {
    if (e.type === "death") STATS.deaths++;
    if (e.type === "drink") STATS.drinks++;
    if (e.type === "slap" || e.type === "sting" || e.type === "drink" || e.type === "death") this.broadcast("fx", e);
  }

  /** Retire an empty session after the grace period (spec working proposal: 10 minutes). */
  private armEmptyTimer() {
    this.emptyTimer?.clear();
    this.emptyTimer = this.clock.setTimeout(() => {
      if (this.clients.length > 0) return;
      this.retiring = true;
      this.disconnect();
    }, TUNING.session.emptyGraceMinutes * 60_000);
  }

  /** Everything needed to bring this session back after a restart. */
  toSaved(): SavedRoom {
    const snapshot = this.session.snapshot();
    const tokens: Record<string, string> = {};
    // Only characters with a token can ever be reclaimed; the rest are not saved.
    snapshot.players = snapshot.players.filter((p) => {
      const t = this.tokens.get(p.id);
      if (t) tokens[p.id] = t;
      return t !== undefined;
    });
    for (const [token, p] of this.parked) {
      snapshot.players.push(structuredClone(p));
      tokens[p.id] = token;
    }
    return { version: 1, roomId: this.roomId, savedAt: new Date().toISOString(), snapshot, tokens, chat: this.chatLog };
  }

  private save() {
    if (this.shuttingDown || this.retiring) return;
    try {
      saveRoom(this.toSaved());
    } catch (err) {
      console.error("[persistence] could not save session", this.roomId, err);
    }
  }

  private restoreFrom(saved: SavedRoom) {
    this.roomId = saved.roomId;
    this.session.restore(saved.snapshot);
    // Nobody is connected yet: park every character until its browser returns.
    for (const p of [...this.session.players.values()]) {
      const token = saved.tokens[p.id];
      if (token) this.parked.set(token, { ...p, input: { forward: 0, turn: 0 } });
      this.session.leave(p.id);
    }
    this.chatLog = saved.chat ?? [];
    this.sync();
  }

  /** Copy the authoritative session into the replicated state. */
  private sync() {
    const s = this.session;
    const st = this.state;

    for (const [id, p] of s.players) {
      let ps = st.players.get(id);
      if (!ps) {
        ps = new PlayerState();
        ps.name = p.name;
        st.players.set(id, ps);
      }
      ps.x = p.x;
      ps.z = p.z;
      ps.heading = p.heading;
      ps.health = Math.round(p.health * 100) / 100;
      ps.phase = p.phase;
      ps.posture = p.posture;
      ps.inShade = p.inShade;
    }
    for (const id of [...st.players.keys()]) if (!s.players.has(id)) st.players.delete(id);

    for (const [id, w] of s.wells) {
      if (!st.wells.has(id)) {
        const ws = new WellState();
        ws.x = w.x;
        ws.z = w.z;
        st.wells.set(id, ws);
      }
    }
    for (const id of [...st.wells.keys()]) if (!s.wells.has(id)) st.wells.delete(id);

    for (const [id, m] of s.markers) {
      if (!st.markers.has(id)) {
        const ms = new MarkerState();
        ms.name = m.name;
        ms.x = m.x;
        ms.z = m.z;
        ms.heading = m.heading;
        st.markers.set(id, ms);
      }
    }

    for (const [id, sc] of s.scorpions) {
      let ss = st.scorpions.get(id);
      if (!ss) {
        ss = new ScorpionState();
        ss.x = sc.x;
        ss.z = sc.z;
        st.scorpions.set(id, ss);
      }
      ss.present = s.isScorpionPresent(sc);
    }
  }
}

/**
 * Playtest helper: DESERT_START_HEALTH=12 pnpm dev starts new players near death,
 * so dying and rejoining can be tried without waiting minutes. Ignored if invalid.
 */
function playtestStartHealth(): number | undefined {
  const v = Number(process.env.DESERT_START_HEALTH);
  return Number.isFinite(v) && v > 0 && v <= 100 ? v : undefined;
}

/**
 * Basic name hygiene. The final name policy (length, duplicates, moderation)
 * is still an open question, so this only trims and limits length.
 */
export function cleanName(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  const trimmed = s.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 20);
  return trimmed || "Stranger";
}
