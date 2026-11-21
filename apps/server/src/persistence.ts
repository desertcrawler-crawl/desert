import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SessionSnapshot, SimPlayer } from "@desert/sim";
import type { ChatLine } from "./DesertRoom.ts";

/**
 * Saved sessions, so a server restart (a deploy, or a free host recycling the
 * machine) does not wipe skeletons, crosses, wells or characters.
 *
 * One JSON file per session in DATA_DIR/sessions. Characters are saved under
 * a private token the browser keeps, so the same browser gets its character
 * back after a restart. Characters whose players never return stay parked.
 */
export interface SavedRoom {
  version: 1;
  roomId: string;
  savedAt: string;
  snapshot: SessionSnapshot;
  /** playerId in the snapshot -> the browser's token. */
  tokens: Record<string, string>;
  chat: ChatLine[];
}

export type ParkedPlayers = Map<string, SimPlayer>;

function dir(): string | null {
  const d = process.env.DATA_DIR ?? (process.env.NODE_ENV === "test" ? "" : "data");
  if (!d) return null;
  const sessions = join(d, "sessions");
  mkdirSync(sessions, { recursive: true });
  return sessions;
}

const safe = (roomId: string) => roomId.replace(/[^A-Za-z0-9_-]/g, "");

export function saveRoom(room: SavedRoom): void {
  const d = dir();
  if (!d) return;
  const file = join(d, `${safe(room.roomId)}.json`);
  // Write then rename, so a crash mid-write never leaves a broken file.
  writeFileSync(`${file}.tmp`, JSON.stringify(room));
  renameSync(`${file}.tmp`, file);
}

export function deleteRoom(roomId: string): void {
  const d = dir();
  if (d) rmSync(join(d, `${safe(roomId)}.json`), { force: true });
}

export function loadRooms(): SavedRoom[] {
  const d = dir();
  if (!d) return [];
  const rooms: SavedRoom[] = [];
  for (const f of readdirSync(d)) {
    if (!f.endsWith(".json")) continue;
    try {
      const r = JSON.parse(readFileSync(join(d, f), "utf8")) as SavedRoom;
      if (r.version === 1 && r.snapshot?.version === 1) rooms.push(r);
    } catch (err) {
      console.warn(`[persistence] skipping unreadable ${f}`, err);
    }
  }
  return rooms;
}

/** Tokens are random strings made by the browser; anything else is ignored. */
export function cleanToken(raw: unknown): string | null {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(raw) ? raw : null;
}
