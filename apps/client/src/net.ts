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
  posture: "crawl" | "standingUp" | "walk" | "lyingDown";
  inShade: boolean;
}

export interface RemoteScorpion {
  x: number;
  z: number;
  present: boolean;
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
  scorpions: Map<string, RemoteScorpion>;
}

/**
 * This browser's private character token. After a server restart, the server
 * gives the character saved under this token back to whoever presents it.
 */
function characterToken(): string | undefined {
  try {
    let t = localStorage.getItem("desert:token");
    if (!t) {
      const bytes = crypto.getRandomValues(new Uint8Array(18));
      t = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem("desert:token", t);
    }
    return t;
  } catch {
    return undefined; // no storage: still playable, just not restorable
  }
}

/**
 * Join the session this browser was last in, if it still exists and has room
 * (that is how a character comes back after a server restart); otherwise any
 * open session, or a new one.
 */
export async function joinDesert(name: string): Promise<Room<any, RoomState>> {
  const client = new Client(serverUrl());
  const options = { name, token: characterToken() };
  let last: string | null = null;
  try {
    last = localStorage.getItem("desert:room");
  } catch {
    /* ignore */
  }
  let room: Room<any, RoomState> | null = null;
  if (last) {
    try {
      room = await client.joinById<RoomState>(last, options);
    } catch {
      room = null; // gone or full
    }
  }
  room ??= await client.joinOrCreate<RoomState>("desert", options);
  try {
    localStorage.setItem("desert:room", room.roomId);
  } catch {
    /* ignore */
  }
  return room;
}
