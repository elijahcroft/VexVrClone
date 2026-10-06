import type { FloorPainter } from "../render/floor";
import { buildMaze, cellCenter, makeMaze, robotIn, seeded, type Maze } from "./helpers";
import type { PlaygroundDef } from "./types";

const CELL = 250;
const START = { c: 4, r: 0 }; // (125, -875): the documented start

/** Dead ends (three walls) other than start/exit, labeled A, B, C... */
function deadEnds(m: Maze) {
  const ends: { c: number; r: number }[] = [];
  for (let c = 0; c < m.cols; c++) {
    for (let r = 0; r < m.rows; r++) {
      const walls =
        Number(m.north[c][r]) +
        Number(r === 0 || m.north[c][r - 1]) +
        Number(m.east[c][r]) +
        Number(c === 0 || m.east[c - 1][r]);
      const special = (c === m.start.c && r === m.start.r) || (c === m.exit.c && r === m.exit.r);
      if (walls === 3 && !special) ends.push({ c, r });
    }
  }
  return ends.sort((a, b) => b.r - a.r || a.c - b.c).slice(0, 8);
}

function paintMaze(p: FloorPainter, m: Maze) {
  p.fill("#f1f3f6");
  for (let c = 0; c < m.cols; c++) {
    for (let r = 0; r < m.rows; r++) {
      const { x, y } = cellCenter(m, c, r);
      p.rect(x, y, CELL - 6, CELL - 6, (c + r) % 2 ? "#e9edf2" : "#f6f7f9");
    }
  }
  const s = cellCenter(m, m.start.c, m.start.r);
  p.text("START", s.x, s.y - 80, 40, "#6b7686");
  const e = cellCenter(m, m.exit.c, m.exit.r);
  p.rect(e.x, e.y, CELL - 30, CELL - 30, "#22a55a");
  p.text("EXIT", e.x, e.y, 60, "#ffffff");
  deadEnds(m).forEach(({ c, r }, i) => {
    const { x, y } = cellCenter(m, c, r);
    p.text(String.fromCharCode(65 + i), x, y, 90, "#b4bfcc");
  });
}

function mazePlayground(id: string, name: string, description: string, seed: () => number): PlaygroundDef<Maze> {
  return {
    id,
    name,
    description,
    size: { w: 2000, h: 2000 },
    start: { x: 128, y: -875, heading: 0 },
    border: false, // the maze's outer walls are the border
    generate() {
      const rand = seeded(seed());
      return makeMaze(8, 8, CELL, rand, START, Math.floor(rand() * 8));
    },
    paintFloor: paintMaze,
    build: (world, m) => buildMaze(world, m),
    status(_world, robot, m) {
      const e = cellCenter(m, m.exit.c, m.exit.r);
      return robotIn(robot, e.x, e.y, CELL, CELL) ? "You reached the exit!" : null;
    },
  };
}

export const wallMaze = mazePlayground(
  "wall-maze",
  "Wall Maze",
  "Navigate through the maze to the green exit. Dead ends are lettered.",
  () => 2024,
);

export const dynamicWallMaze = mazePlayground(
  "dynamic-wall-maze",
  "Dynamic Wall Maze",
  "A new maze every time you reset. Use sensors to find the exit.",
  () => Math.floor(Math.random() * 1e9),
);
