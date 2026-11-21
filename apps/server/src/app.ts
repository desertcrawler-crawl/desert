import { matchMaker, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DesertRoom, ROOM_NAME } from "./DesertRoom.ts";
import { loadRooms } from "./persistence.ts";
import { STATS } from "./stats.ts";

/** Built browser files, served from the same origin as the game in production. */
const CLIENT_DIST = fileURLToPath(new URL("../../client/dist", import.meta.url));

export function createGameServer() {
  const server = new Server({
    transport: new WebSocketTransport(),
    greet: false,
    express: (app) => {
      app.get("/health", (_req, res) => {
        res.json({ ok: true });
      });
      // Numbers for watching a playtest: sessions, players, and how hard the server works.
      app.get("/stats", async (_req, res) => {
        const rooms = await matchMaker.query({ name: ROOM_NAME });
        const mem = process.memoryUsage();
        res.json({
          uptimeMinutes: Math.round((Date.now() - STATS.startedAt) / 60_000),
          sessions: rooms.length,
          players: rooms.reduce((n, r) => n + r.clients, 0),
          perSession: rooms.map((r) => ({ id: r.roomId, players: r.clients })),
          tickMs: {
            average: Number(STATS.avgTickMs.toFixed(3)),
            slowestThisMinute: Number(STATS.slowestTickMs.toFixed(2)),
            slowestLastMinute: Number(STATS.slowestTickMsLastMinute.toFixed(2)),
            budget: 1000 / 20,
          },
          memoryMB: Math.round(mem.rss / 1e6),
          totals: { joins: STATS.joins, deaths: STATS.deaths, drinks: STATS.drinks, chatLines: STATS.chatLines },
        });
      });
      if (existsSync(CLIENT_DIST)) {
        app.use(express.static(CLIENT_DIST));
      }
    },
  });
  // Matchmaking: "joinOrCreate" fills an open room, or creates a new one once all are full (30 each).
  server.define(ROOM_NAME, DesertRoom);
  return server;
}

/** Bring back the sessions saved before the last shutdown. Call after listen(). */
export async function restoreSessions(): Promise<number> {
  let n = 0;
  for (const saved of loadRooms()) {
    try {
      await matchMaker.createRoom(ROOM_NAME, { restore: saved });
      n++;
    } catch (err) {
      console.error(`[persistence] could not restore session ${saved.roomId}`, err);
    }
  }
  return n;
}
