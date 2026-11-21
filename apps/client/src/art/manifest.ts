/**
 * ART SLOTS — the one place that says which 3D files the game uses.
 *
 * To replace a placeholder with real art, export a .glb from Blender into
 * apps/client/public/assets/models/ using the file name below. The game
 * picks it up on the next page load. If a file is missing or broken, the
 * code-built placeholder is used instead, so the game always runs.
 *
 * Conventions for every model (see docs/ART_PIPELINE.md):
 *   - 1 Blender unit = 1 metre.
 *   - Model faces Blender's -Y (towards you in Front view), the glTF standard.
 *   - Origin at ground level, at the centre of the footprint.
 *   - Animations are named clips inside the .glb (names listed per slot).
 */
export interface ArtSlot {
  /** File under public/assets/models/. */
  file: string;
  /** Animation clip names the game will look for. Missing clips are fine for now. */
  clips: readonly string[];
  /** What this is, for the artist. */
  note: string;
}

export const ART_SLOTS = {
  crawler: {
    file: "crawler.glb",
    clips: ["crawl", "crawl_idle", "walk", "walk_idle", "stand_up", "lie_down", "dying_breathe", "slapped"],
    note: "The stranded old man: long white hair and beard, rags, very thin, hunched. About 1.8 m tall standing.",
  },
  well: {
    file: "well.glb",
    clips: [],
    note: "An active water well, about 1.6 m across. Disappears once someone drinks.",
  },
  skeleton: {
    file: "skeleton.glb",
    clips: ["slapped"],
    note: "Skeleton lying on its back where a player died, about 1.7 m long. Name the skull mesh 'skull' so slaps can bounce it later.",
  },
  cross: {
    file: "cross.glb",
    clips: [],
    note: "Wooden grave cross, about 1.1 m tall. The player's name is drawn above it by the game.",
  },
  rock: {
    file: "rock.glb",
    clips: [],
    note: "Generic desert rock, about 2 m across and 2 m tall. Scaled per rock in the map.",
  },
} as const satisfies Record<string, ArtSlot>;

export type ArtSlotName = keyof typeof ART_SLOTS;
