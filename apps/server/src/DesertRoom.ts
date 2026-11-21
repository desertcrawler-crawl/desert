import { Room, type Client } from "@colyseus/core";
import { GREYBOX, IDLE_INPUT, sanitizeInput, stepBody, TUNING, type MoveInput } from "@desert/sim";
import { DesertState, PlayerState } from "./state.ts";

export interface JoinOptions {
  name?: unknown;
}

/** Room name clients ask for. One room = one independent desert session. */
export const ROOM_NAME = "desert";

/**
 * One session of the desert.
 * The server owns all state; clients only send intentions ("input").
 */
export class DesertRoom extends Room<{ state: DesertState }> {
  maxClients = TUNING.session.maxPlayers;
  state = new DesertState();

  private intents = new Map<string, MoveInput>();
  private spawnCursor = 0;

  onCreate() {
    this.onMessage("input", (client, raw) => {
      // Never trust the client: keep only a valid intention.
      this.intents.set(client.sessionId, sanitizeInput(raw));
    });

    const dt = 1 / TUNING.tickHz;
    this.setSimulationInterval(() => this.tick(dt), 1000 / TUNING.tickHz);
  }

  onJoin(client: Client, options?: JoinOptions) {
    const spawn = GREYBOX.spawns[this.spawnCursor++ % GREYBOX.spawns.length]!;
    const player = new PlayerState();
    player.name = cleanName(options?.name);
    player.x = spawn.x;
    player.z = spawn.z;
    player.heading = 0;
    this.state.players.set(client.sessionId, player);
    this.intents.set(client.sessionId, IDLE_INPUT);
  }

  onLeave(client: Client) {
    // Reconnect policy is an open design question (spec section 16); for now a leave is final.
    this.state.players.delete(client.sessionId);
    this.intents.delete(client.sessionId);
  }

  /** One fixed simulation step. Order of systems will grow here (see architecture doc). */
  tick(dt: number) {
    this.state.players.forEach((p, id) => {
      const next = stepBody(p, this.intents.get(id) ?? IDLE_INPUT, dt);
      p.x = next.x;
      p.z = next.z;
      p.heading = next.heading;
    });
  }
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
