import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DesertRoom, ROOM_NAME } from "./DesertRoom.ts";

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
      if (existsSync(CLIENT_DIST)) {
        app.use(express.static(CLIENT_DIST));
      }
    },
  });
  // Matchmaking: "joinOrCreate" fills an open room, or creates a new one once all are full (30 each).
  server.define(ROOM_NAME, DesertRoom);
  return server;
}
