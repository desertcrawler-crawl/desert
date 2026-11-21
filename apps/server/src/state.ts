import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * Room state that every client in the session receives.
 * Only the server writes it. Everyone gets everything: the minimap shows
 * all players and wells anyway, so there is nothing to hide.
 */
export const PlayerState = schema(
  {
    name: t.string(),
    x: t.float32(),
    z: t.float32(),
    heading: t.float32(),
    health: t.float32(),
    /** "alive" | "terminal" | "dead" */
    phase: t.string(),
    /** "crawl" | "standingUp" | "walk" | "lyingDown" */
    posture: t.string(),
    inShade: t.boolean(),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const WellState = schema({ x: t.float32(), z: t.float32() }, "WellState");
export type WellState = SchemaType<typeof WellState>;

/** A skeleton with its wooden cross and name. */
export const MarkerState = schema(
  { name: t.string(), x: t.float32(), z: t.float32(), heading: t.float32() },
  "MarkerState",
);
export type MarkerState = SchemaType<typeof MarkerState>;

/** A boundary guardian. `present` is false during the 10 s after it stings. */
export const ScorpionState = schema({ x: t.float32(), z: t.float32(), present: t.boolean() }, "ScorpionState");
export type ScorpionState = SchemaType<typeof ScorpionState>;

export const DesertState = schema(
  {
    players: t.map(PlayerState),
    wells: t.map(WellState),
    markers: t.map(MarkerState),
    scorpions: t.map(ScorpionState),
  },
  "DesertState",
);
export type DesertState = SchemaType<typeof DesertState>;
