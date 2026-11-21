import { Room, type Client } from "@colyseus/core";
import { Session, TUNING } from "@desert/sim";
import { DesertState, MarkerState, PlayerState, WellState } from "./state.ts";

export interface JoinOptions {
  name?: unknown;
}

/** Room name clients ask for. One room = one independent desert session. */
export const ROOM_NAME = "desert";

/**
 * One session of the desert. The rules run in the shared Session class;
 * this room only handles connections and copies the results into the
 * synchronised state. Clients send intentions, never results.
 */
export class DesertRoom extends Room<{ state: DesertState }> {
  maxClients = TUNING.session.maxPlayers;
  state = new DesertState();
  readonly session = new Session({ firstEntryHealth: playtestStartHealth() });

  onCreate() {
    this.onMessage("input", (client, raw) => this.session.setInput(client.sessionId, raw));
    this.onMessage("rejoin", (client) => this.session.rejoin(client.sessionId));

    const dt = 1 / TUNING.tickHz;
    this.setSimulationInterval(() => this.tick(dt), 1000 / TUNING.tickHz);
  }

  onJoin(client: Client, options?: JoinOptions) {
    this.session.join(client.sessionId, cleanName(options?.name));
    this.sync();
  }

  onLeave(client: Client) {
    // Reconnect policy is an open design question (spec section 16); for now a leave is final.
    this.session.leave(client.sessionId);
    this.sync();
  }

  tick(dt: number) {
    this.session.step(dt);
    this.session.drainEvents();
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
