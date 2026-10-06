import type { FloorPainter } from "../render/floor";
import type { Robot } from "../sim/robot";
import { downloadText, pickFile } from "../ui/files";
import { editMaze } from "../ui/mazeEditor";
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
      p.rect(x, y, m.cell - 6, m.cell - 6, (c + r) % 2 ? "#e9edf2" : "#f6f7f9");
    }
  }
  const s = cellCenter(m, m.start.c, m.start.r);
  p.text("START", s.x, s.y - 80, 40, "#6b7686");
  const e = cellCenter(m, m.exit.c, m.exit.r);
  p.rect(e.x, e.y, m.cell - 30, m.cell - 30, "#22a55a");
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
    status: exitStatus,
  };
}

function exitStatus(_world: unknown, robot: Robot, m: Maze) {
  const e = cellCenter(m, m.exit.c, m.exit.r);
  return robotIn(robot, e.x, e.y, m.cell, m.cell) ? "You reached the exit!" : null;
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

// ---------------------------------------------------------------- Wall Maze+

const PLUS_KEY = "robocode-sim:wall-maze-plus";
const PLUS_SIZE = 20;

function plusMaze(seed: number) {
  const rand = seeded(seed);
  return makeMaze(PLUS_SIZE, PLUS_SIZE, CELL, rand, { c: 1, r: 1 }, Math.floor(rand() * PLUS_SIZE));
}

/** A teacher's custom maze, if one was saved in this browser. */
function savedMaze(): Maze | null {
  try {
    const m = JSON.parse(localStorage.getItem(PLUS_KEY) ?? "null");
    return isMaze(m) ? m : null;
  } catch {
    return null;
  }
}

function saveMaze(m: Maze | null) {
  try {
    if (m) localStorage.setItem(PLUS_KEY, JSON.stringify(m));
    else localStorage.removeItem(PLUS_KEY);
  } catch {
    // Storage blocked; the maze still works until the page reloads.
  }
}

function isMaze(m: unknown): m is Maze {
  const x = m as Maze;
  const grid = (g: unknown) =>
    Array.isArray(g) && g.length === PLUS_SIZE && g.every((col) => Array.isArray(col) && col.length === PLUS_SIZE);
  const cell = (c: unknown) => {
    const p = c as { c: number; r: number };
    return Number.isInteger(p?.c) && Number.isInteger(p?.r) && p.c >= 0 && p.r >= 0 && p.c < PLUS_SIZE && p.r < PLUS_SIZE;
  };
  return !!x && x.cols === PLUS_SIZE && x.rows === PLUS_SIZE && x.cell === CELL && grid(x.north) && grid(x.east) && cell(x.start) && cell(x.exit);
}

export const wallMazePlus: PlaygroundDef<Maze> = {
  id: "wall-maze-plus",
  name: "Wall Maze+",
  description: "A big 5 m maze for the MazeBot (left, right and front distance sensors). Edit and share your own mazes.",
  size: { w: PLUS_SIZE * CELL, h: PLUS_SIZE * CELL },
  start: { x: -2125, y: -2125, heading: 0 },
  robot: "mazebot",
  border: false,
  minimap: true,
  generate: () => savedMaze() ?? plusMaze(5150),
  startFor: (m) => ({ ...cellCenter(m, m.start.c, m.start.r), heading: 0 }),
  paintFloor: paintMaze,
  build: (world, m) => buildMaze(world, m),
  status: exitStatus,
  tools: [
    {
      label: "Edit maze",
      async run(session, reset) {
        const edited = await editMaze(session.layout as Maze);
        if (edited) {
          saveMaze(edited);
          reset();
        }
      },
    },
    {
      label: "Random maze",
      run(_session, reset) {
        saveMaze(plusMaze(Math.floor(Math.random() * 1e9)));
        reset();
      },
    },
    {
      label: "Built-in maze",
      run(_session, reset) {
        saveMaze(null);
        reset();
      },
    },
    {
      label: "Download maze",
      run(session) {
        downloadText(JSON.stringify(session.layout), "maze.json");
      },
    },
    {
      label: "Upload maze",
      async run(_session, reset) {
        const file = await pickFile(".json,application/json");
        if (!file) return;
        try {
          const m = JSON.parse(await file.text());
          if (isMaze(m)) {
            saveMaze(m);
            reset();
          }
        } catch {
          // Not a maze file; ignore it.
        }
      },
    },
  ],
};
