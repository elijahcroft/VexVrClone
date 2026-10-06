import type { FloorPainter } from "../render/floor";
import type { Robot } from "../sim/robot";
import { World, type SimObject } from "../sim/world";

export const FIELD = { w: 2000, h: 2000 };

/** Disk / castle colors, as the eye sensor sees them. */
export const COLOR = {
  RED: { hex: 0xdc2626, css: "#dc2626" },
  GREEN: { hex: 0x16a34a, css: "#16a34a" },
  BLUE: { hex: 0x2563eb, css: "#2563eb" },
} as const;
export type ColorName = keyof typeof COLOR;
export const COLOR_NAMES: ColorName[] = ["RED", "GREEN", "BLUE"];

/** Small seeded random generator so a "random" layout can be reproduced. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Axis-aligned wall from (x1, y1) to (x2, y2); one of x or y must match. */
export function wall(world: World, x1: number, y1: number, x2: number, y2: number, opts: { thick?: number; h?: number; color?: number } = {}) {
  const { thick = 20, h = 120, color = 0x9fb0c4 } = opts;
  const w = Math.abs(x2 - x1) + thick;
  const d = Math.abs(y2 - y1) + thick;
  return world.add({ shape: { kind: "box", w, d, h }, x: (x1 + x2) / 2, y: (y1 + y2) / 2, color, tag: "wall" });
}

/** A flat colored disk the magnet can pick up. */
export function disk(world: World, x: number, y: number, color: ColorName) {
  return world.add({
    shape: { kind: "cylinder", r: 50, h: 20 },
    x,
    y,
    color: COLOR[color].hex,
    eyeColor: color,
    tag: "disk",
    dynamic: true,
    density: 300,
  });
}

export function diskColor(obj: SimObject): ColorName {
  return obj.eyeColor as ColorName;
}

/** Is a field point inside an axis-aligned rectangle centered on (cx, cy)? */
export function inside(p: { x: number; y: number }, cx: number, cy: number, w: number, h: number) {
  return Math.abs(p.x - cx) <= w / 2 && Math.abs(p.y - cy) <= h / 2;
}

export function objectsTagged(world: World, tag: string) {
  return world.objects.filter((o) => o.tag === tag && !o.removed);
}

export function positionOf(obj: SimObject) {
  return World.position(obj.body);
}

export function robotIn(robot: Robot, cx: number, cy: number, w: number, h: number) {
  return inside(robot.position, cx, cy, w, h);
}

/** Plain light floor with a faint 200 mm grid. */
export function plainFloor(p: FloorPainter, color = "#f4f2ee", line = "#e2e0da") {
  p.fill(color);
  for (let v = -1000; v <= 1000; v += 200) {
    p.line(v, -1000, v, 1000, 2, line);
    p.line(-1000, v, 1000, v, 2, line);
  }
}

// ------------------------------------------------------------------ mazes

/** A grid maze: which cell edges have walls. Cell (c, r) has r = 0 at the bottom. */
export interface Maze {
  cols: number;
  rows: number;
  cell: number;
  /** Wall on the north side of (c, r). */
  north: boolean[][];
  /** Wall on the east side of (c, r). */
  east: boolean[][];
  start: { c: number; r: number };
  exit: { c: number; r: number };
}

/** Perfect maze (one path between any two cells) by depth-first search. */
export function makeMaze(cols: number, rows: number, cell: number, rand: () => number, start: { c: number; r: number }, exitCol: number): Maze {
  const north = Array.from({ length: cols }, () => Array(rows).fill(true));
  const east = Array.from({ length: cols }, () => Array(rows).fill(true));
  const seen = Array.from({ length: cols }, () => Array(rows).fill(false));
  const stack = [start];
  seen[start.c][start.r] = true;
  while (stack.length) {
    const { c, r } = stack[stack.length - 1];
    const next = shuffle(
      [
        { c, r: r + 1, open: () => (north[c][r] = false) },
        { c, r: r - 1, open: () => (north[c][r - 1] = false) },
        { c: c + 1, r, open: () => (east[c][r] = false) },
        { c: c - 1, r, open: () => (east[c - 1][r] = false) },
      ],
      rand,
    ).find((n) => n.c >= 0 && n.r >= 0 && n.c < cols && n.r < rows && !seen[n.c][n.r]);
    if (!next) {
      stack.pop();
      continue;
    }
    next.open();
    seen[next.c][next.r] = true;
    stack.push({ c: next.c, r: next.r });
  }
  return { cols, rows, cell, north, east, start, exit: { c: exitCol, r: rows - 1 } };
}

/** Center of a maze cell in field mm (maze centered on the field). */
export function cellCenter(m: Maze, c: number, r: number) {
  return { x: (c - m.cols / 2 + 0.5) * m.cell, y: (r - m.rows / 2 + 0.5) * m.cell };
}

/** Walls for every closed cell edge, merged into long runs where possible. */
export function buildMaze(world: World, m: Maze, color?: number) {
  const x0 = (-m.cols / 2) * m.cell;
  const y0 = (-m.rows / 2) * m.cell;
  // Horizontal runs: north edges of each row, plus the south border.
  for (let r = -1; r < m.rows; r++) {
    let runStart: number | null = null;
    for (let c = 0; c <= m.cols; c++) {
      const closed = c < m.cols && (r < 0 ? true : m.north[c][r]);
      if (closed && runStart === null) runStart = c;
      if (!closed && runStart !== null) {
        const y = y0 + (r + 1) * m.cell;
        wall(world, x0 + runStart * m.cell, y, x0 + c * m.cell, y, { color });
        runStart = null;
      }
    }
  }
  // Vertical runs: east edges of each column, plus the west border.
  for (let c = -1; c < m.cols; c++) {
    let runStart: number | null = null;
    for (let r = 0; r <= m.rows; r++) {
      const closed = r < m.rows && (c < 0 ? true : m.east[c][r]);
      if (closed && runStart === null) runStart = r;
      if (!closed && runStart !== null) {
        const x = x0 + (c + 1) * m.cell;
        wall(world, x, y0 + runStart * m.cell, x, y0 + r * m.cell, { color });
        runStart = null;
      }
    }
  }
}
