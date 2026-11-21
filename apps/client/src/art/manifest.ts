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
    clips: ["crawl", "crawl_idle", "walk", "walk_idle", "stand_up", "lie_down", "dying_breathe", "slapped", "death", "drink"],
    note: "The stranded old man: long white hair and beard, rags, very thin, hunched. About 1.8 m tall standing.",
  },
  rock: {
    file: "rock.glb",
    clips: [],
    note: "Generic desert rock, about 2 m across and 2 m tall. Scaled per rock in the map.",
  },
  dead_tree: {
    file: "dead_tree.glb",
    clips: [],
    note: "Bare, sun-bleached dead tree, about 4.5 m tall.",
  },
  shrub: {
    file: "shrub.glb",
    clips: [],
    note: "Dry desert shrub, about 1.5 m across and 0.9 m tall.",
  },
  cactus: {
    file: "cactus.glb",
    clips: [],
    note: "Tall cactus, about 2.4 m tall.",
  },
  ruin_column: {
    file: "ruin_column.glb",
    clips: [],
    note: "Broken stone column on a plinth, about 3 m tall.",
  },
  ruin_wall: {
    file: "ruin_wall.glb",
    clips: [],
    note: "Crumbling stone wall section, about 2.6 m long and 2.6 m high.",
  },
  well: {
    file: "well.glb",
    clips: [],
    note: "Stone well with posts, crossbeam, rope and bucket. About 2 m across and 2.2 m tall.",
  },
  skeleton: {
    file: "skeleton.glb",
    clips: [],
    note: "Human skeleton lying on its back, head towards +Z, about 1.7 m long.",
  },
  cross: {
    file: "cross.glb",
    clips: [],
    note: "Wooden grave cross stuck in the sand, about 1.3 m tall.",
  },
  scorpion: {
    file: "scorpion.glb",
    clips: ["idle", "walk", "attack"],
    note: "Desert scorpion, about 1.4 m long including the tail (game-sized, bigger than life).",
  },
} as const satisfies Record<string, ArtSlot>;

export type ArtSlotName = keyof typeof ART_SLOTS;
