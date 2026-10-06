import { gridMap } from "./gridMap";
import type { PlaygroundDef } from "./types";

export const PLAYGROUNDS: PlaygroundDef[] = [gridMap];

export function getPlayground(id: string) {
  return PLAYGROUNDS.find((p) => p.id === id) ?? PLAYGROUNDS[0];
}
