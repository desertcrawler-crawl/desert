import { Client } from "@colyseus/sdk";
import type { Server } from "@colyseus/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TUNING } from "@desert/sim";
import { createGameServer } from "../src/app.ts";
import { cleanName, ROOM_NAME } from "../src/DesertRoom.ts";

const PORT = 2599;
let server: Server;

beforeAll(async () => {
  server = createGameServer();
  await server.listen(PORT, "127.0.0.1");
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

const endpoint = `http://127.0.0.1:${PORT}`;
const waitFor = async (cond: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
};

describe("desert room", () => {
  it("answers the health check", async () => {
    const res = await fetch(`${endpoint}/health`);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("puts two players in the same world and lets them see each other", async () => {
    const a = await new Client(endpoint).joinOrCreate(ROOM_NAME, { name: "Ada" });
    const b = await new Client(endpoint).joinOrCreate(ROOM_NAME, { name: "Bo" });
    expect(b.roomId).toBe(a.roomId);
    await waitFor(() => a.state.players?.size === 2 && b.state.players?.size === 2);
    const names = [...a.state.players.values()].map((p: { name: string }) => p.name).sort();
    expect(names).toEqual(["Ada", "Bo"]);
    await a.leave();
    await b.leave();
  });

  it("moves a player only through the server, from input", async () => {
    const a = await new Client(endpoint).joinOrCreate(ROOM_NAME, { name: "Mover" });
    await waitFor(() => a.state.players?.get(a.sessionId) !== undefined);
    const me = () => a.state.players.get(a.sessionId);
    const z0 = me().z;
    a.send("input", { forward: 1, turn: 0 });
    await waitFor(() => z0 - me().z > 0.2);
    // A forged "position" message is rejected: the server has no handler for it and drops that client.
    a.send("position", { x: 999, z: 999 });
    a.send("input", { forward: 0, turn: 0 });
    await new Promise((r) => setTimeout(r, 200));
    expect(Math.abs(me().x)).toBeLessThan(100);
    await a.leave();
  });

  it("sends player 31 to a new session", async () => {
    const clients = [];
    for (let i = 0; i < TUNING.session.maxPlayers; i++) {
      clients.push(await new Client(endpoint).joinOrCreate(ROOM_NAME, { name: `p${i}` }));
    }
    const roomIds = new Set(clients.map((c) => c.roomId));
    expect(roomIds.size).toBe(1);
    const extra = await new Client(endpoint).joinOrCreate(ROOM_NAME, { name: "p31" });
    expect(roomIds.has(extra.roomId)).toBe(false);
    await Promise.all([...clients, extra].map((c) => c.leave()));
  });
});

describe("cleanName", () => {
  it("trims, strips control characters and limits length", () => {
    expect(cleanName("  Ada\u0007 ")).toBe("Ada");
    expect(cleanName("x".repeat(50))).toHaveLength(20);
    expect(cleanName(42)).toBe("Stranger");
    expect(cleanName("   ")).toBe("Stranger");
  });
});
