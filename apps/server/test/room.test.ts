import { Client } from "@colyseus/sdk";
import { matchMaker, type Server } from "@colyseus/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TUNING } from "@desert/sim";
import { createGameServer } from "../src/app.ts";
import { cleanName, ROOM_NAME, type DesertRoom } from "../src/DesertRoom.ts";

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
    const x0 = me().x;
    a.send("position", { x: 999, z: 999 });
    a.send("input", { forward: 0, turn: 0 });
    await new Promise((r) => setTimeout(r, 200));
    expect(Math.abs(me().x - x0)).toBeLessThan(1);
    await a.leave();
  });

  it("sends player 31 to a new session", async () => {
    // Fill one fresh session to the cap.
    const first = await new Client(endpoint).create(ROOM_NAME, { name: "p0" });
    const clients = [first];
    for (let i = 1; i < TUNING.session.maxPlayers; i++) {
      clients.push(await new Client(endpoint).joinById(first.roomId, { name: `p${i}` }));
    }
    await expect(new Client(endpoint).joinById(first.roomId, { name: "p31" })).rejects.toThrow();
    const extra = await new Client(endpoint).joinOrCreate(ROOM_NAME, { name: "p31" });
    expect(extra.roomId).not.toBe(first.roomId);
    await Promise.all([...clients, extra].map((c) => c.leave()));
  });
});

describe("survival over the network", () => {
  it("sends health, phase and wells; a new player starts at 40% with water in the world", async () => {
    const a = await new Client(endpoint).joinOrCreate(ROOM_NAME, { name: "Thirsty" });
    await waitFor(() => a.state.players?.get(a.sessionId) !== undefined && a.state.wells?.size > 0);
    const me = a.state.players.get(a.sessionId);
    expect(me.phase).toBe("alive");
    expect(me.health).toBeLessThanOrEqual(TUNING.health.firstEntry);
    expect(me.health).toBeGreaterThan(TUNING.health.firstEntry - 1);
    await a.leave();
  });

  it("ignores a rejoin request from a player who is not dead", async () => {
    const a = await new Client(endpoint).joinOrCreate(ROOM_NAME, { name: "Alive" });
    await waitFor(() => a.state.players?.get(a.sessionId) !== undefined);
    a.send("rejoin");
    await new Promise((r) => setTimeout(r, 150));
    expect(a.state.players.get(a.sessionId).health).toBeLessThan(TUNING.health.firstEntry + 0.01);
    await a.leave();
  });
});

describe("chat", () => {
  it("reaches everyone in the session, rate-limited and length-limited", async () => {
    const a = await new Client(endpoint).joinOrCreate(ROOM_NAME, { name: "Ada" });
    const b = await new Client(endpoint).joinOrCreate(ROOM_NAME, { name: "Bo" });
    const got: { name: string; text: string }[] = [];
    b.onMessage("chat", (m: { name: string; text: string }) => got.push(m));
    a.onMessage("chat", () => {});
    a.send("chat", "water over here?" + "!".repeat(500));
    a.send("chat", "spam"); // too soon, dropped
    await waitFor(() => got.length >= 1);
    await new Promise((r) => setTimeout(r, 200));
    expect(got).toHaveLength(1);
    expect(got[0]!.name).toBe("Ada");
    expect(got[0]!.text.length).toBe(TUNING.chat.maxLength);
    await a.leave();
    await b.leave();
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

describe("surviving a server restart", () => {
  it("brings back the world and gives each browser its own character back", async () => {
    const token = "test-token-0123456789abcdef";
    const a = await new Client(endpoint).create(ROOM_NAME, { name: "Saved", token });
    const b = await new Client(endpoint).joinById(a.roomId, { name: "NoToken" });
    await waitFor(() => a.state.players?.size === 2);
    a.send("input", { forward: 1, turn: 1 });
    await new Promise((r) => setTimeout(r, 400));
    a.send("input", { forward: 0, turn: 0 });
    await new Promise((r) => setTimeout(r, 100));

    const room = matchMaker.getLocalRoomById(a.roomId) as DesertRoom;
    const saved = JSON.parse(JSON.stringify(room.toSaved()));
    const before = room.session.players.get(a.sessionId)!;
    expect(saved.snapshot.players).toHaveLength(1); // only characters with a token are kept
    await a.leave();
    await b.leave();
    await room.disconnect();

    // "Restart": a new room built from the save, with the same id.
    await matchMaker.createRoom(ROOM_NAME, { restore: saved });
    const back = await new Client(endpoint).joinById(saved.roomId, { name: "Whatever", token });
    await waitFor(() => back.state.players?.get(back.sessionId) !== undefined);
    const me = back.state.players.get(back.sessionId);
    expect(me.name).toBe("Saved");
    expect(me.x).toBeCloseTo(before.x, 1);
    expect(me.z).toBeCloseTo(before.z, 1);
    expect(me.health).toBeCloseTo(before.health, 1); // restored, not reset to 40%

    // Someone else gets a fresh character, not the saved one.
    const other = await new Client(endpoint).joinById(saved.roomId, { name: "New", token: "another-token-0123456789" });
    await waitFor(() => other.state.players?.get(other.sessionId) !== undefined);
    expect(other.state.players.get(other.sessionId).name).toBe("New");
    await back.leave();
    await other.leave();
  });
});
