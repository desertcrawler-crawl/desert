import { Client, type Room } from "@colyseus/sdk";

/** In development the game server runs on its own port; in production it is the same origin. */
export function serverUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  if (import.meta.env.DEV) return `${location.protocol}//${location.hostname}:2567`;
  return location.origin;
}

export interface RemotePlayer {
  name: string;
  x: number;
  z: number;
  heading: number;
  health: number;
  phase: "alive" | "terminal" | "dead";
  inShade: boolean;
}

export interface RemoteWell {
  x: number;
  z: number;
}

export interface RemoteMarker {
  name: string;
  x: number;
  z: number;
  heading: number;
}

/** Mirrors apps/server/src/state.ts. Read-only on the client. */
export interface RoomState {
  players: Map<string, RemotePlayer>;
  wells: Map<string, RemoteWell>;
  markers: Map<string, RemoteMarker>;
}

export async function joinDesert(name: string): Promise<Room<any, RoomState>> {
  const client = new Client(serverUrl());
  return client.joinOrCreate<RoomState>("desert", { name });
}
