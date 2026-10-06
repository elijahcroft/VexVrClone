import type { EyeColor } from "../sim/devices";
import type { PlaygroundDef } from "./types";

/** Top row first. R/G/B = colored pixel, . = empty. */
const ART = [
  ".RR..RR.",
  "RRRRRRRR",
  "RRRRRRRR",
  "RRRRRRRR",
  ".RRRRRR.",
  "..RRRR..",
  "...RR...",
  "...GG...",
];
const CELL = 200;
const N = 8;
const COLORS: Record<string, EyeColor> = { R: "RED", G: "GREEN", B: "BLUE", ".": "NONE" };

/** Column/row (row 0 at the bottom) of a field point, or null outside the grid. */
function cellAt(x: number, y: number) {
  const c = Math.floor((x + (N * CELL) / 2) / CELL);
  const r = Math.floor((y + (N * CELL) / 2) / CELL);
  return c >= 0 && r >= 0 && c < N && r < N ? { c, r } : null;
}

export const hiddenPixelArt: PlaygroundDef = {
  id: "hidden-pixel-art",
  name: "Hidden Pixel Art",
  description: "The eye sensor can read each gray pixel's hidden color. Store them in a 2D list and fill them in.",
  size: { w: 2000, h: 2000 },
  start: { x: -704, y: -917, heading: 0 },
  paintFloor(p) {
    p.fill("#f6f5f2");
    const half = (N * CELL) / 2;
    p.rect(0, 0, N * CELL, N * CELL, "#c9ccd3");
    for (let i = 0; i <= N; i++) {
      const v = -half + i * CELL;
      p.line(v, -half, v, half, 10, "#4b5563");
      p.line(-half, v, half, v, 10, "#4b5563");
    }
  },
  colorAt(x, y) {
    const cell = cellAt(x, y);
    if (!cell) return null;
    return COLORS[ART[N - 1 - cell.r][cell.c]];
  },
};
