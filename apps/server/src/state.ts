import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * Room state that every client in the session receives.
 * Only the server writes it.
 */
export const PlayerState = schema(
  {
    name: t.string(),
    x: t.float32(),
    z: t.float32(),
    heading: t.float32(),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const DesertState = schema(
  {
    players: t.map(PlayerState),
  },
  "DesertState",
);
export type DesertState = SchemaType<typeof DesertState>;
