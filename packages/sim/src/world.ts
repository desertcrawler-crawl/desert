import { DESERT } from "./desert.ts";
import type { MapDef } from "./map.ts";

/** The map the game runs on. */
export const WORLD: MapDef = DESERT;

/** Ground height on the game map. */
export function terrainHeight(x: number, z: number): number {
  return WORLD.height(x, z);
}
