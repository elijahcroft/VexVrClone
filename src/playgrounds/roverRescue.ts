import { RoverGame, type EnemyKind, type Hazard, type RoverMap, type Zone } from "../sim/rover";
import { seeded } from "./helpers";
import type { PlaygroundDef } from "./types";

/**
 * Rover Rescue: a 12 x 6 m alien landscape split into zones A-E, with the
 * research base in the southwest corner and a river crossed by two bridges.
 * Sizes and zone rules follow VEX's public description; the layout itself
 * (rocks, hazards, river course) is our own.
 */
const W = 12000;
const H = 6000;
const BASE = { x: -5250, y: -2250, w: 1500, h: 1500 };

const ZONES: Zone[] = [
  { name: "A", x0: -6000, x1: -3600, respawn: 0, minerals: 4 },
  { name: "B", x0: -3600, x1: -1200, respawn: 0, minerals: 4 },
  { name: "C", x0: -1200, x1: 1200, respawn: 60, minerals: 3 },
  { name: "D", x0: 1200, x1: 3600, respawn: 40, minerals: 3 },
  { name: "E", x0: 3600, x1: 6000, respawn: 25, minerals: 3 },
];

const SPIDER: EnemyKind = { name: "Alien Spider", level: 1, radiation: 20, xp: 5, speed: 120, color: 0x2f2f3a };
const SERPENTS: Record<string, EnemyKind> = {
  C: { name: "Orange Alien Serpent", level: 2, radiation: 40, xp: 10, speed: 160, color: 0xff8c1a },
  D: { name: "Blue Alien Serpent", level: 3, radiation: 60, xp: 10, speed: 180, color: 0x3b82f6 },
  E: { name: "Purple Alien Serpent", level: 4, radiation: 80, xp: 15, speed: 200, color: 0x9b59b6 },
};

/** The river runs north-south between zones B and C; bridges cross it here. */
const RIVER = { x: -1200, w: 400 };
const BRIDGES = [-1500, 1500];
const BRIDGE_W = 700;

/** Rocks: x, y, radius. */
const ROCKS: [number, number, number][] = [
  [-4700, 1900, 200],
  [-2600, 1200, 250],
  [-2100, -900, 200],
  [0, 2000, 250],
  [500, -500, 200],
  [-300, -2200, 220],
  [2200, 1000, 250],
  [2800, -1800, 220],
  [4500, 0, 250],
  [5200, 2200, 200],
];

const HAZARDS: Hazard[] = [
  { x: 800, y: 1500, r: 300 },
  { x: 2000, y: -300, r: 350 },
  { x: 4200, y: -1800, r: 400 },
  { x: 5000, y: 1200, r: 350 },
];

interface Rescue {
  seed: number;
  game?: RoverGame;
}

function blocked(x: number, y: number, margin: number) {
  if (Math.abs(x - RIVER.x) < RIVER.w / 2 + margin) return true;
  if (ROCKS.some(([rx, ry, r]) => Math.hypot(x - rx, y - ry) < r + margin)) return true;
  return HAZARDS.some((h) => Math.hypot(x - h.x, y - h.y) < h.r + margin);
}

/** River segments between the bridges: [y0, y1]. */
function riverSegments() {
  const edges = [-H / 2, ...BRIDGES.flatMap((b) => [b - BRIDGE_W / 2, b + BRIDGE_W / 2]), H / 2];
  const segs: [number, number][] = [];
  for (let i = 0; i < edges.length; i += 2) segs.push([edges[i], edges[i + 1]]);
  return segs;
}

export const roverRescue: PlaygroundDef<Rescue> = {
  id: "rover-rescue",
  name: "Rover Rescue",
  description: "Collect minerals, avoid or neutralize enemies, keep the battery up and level up the rover.",
  size: { w: W, h: H },
  start: { x: BASE.x, y: BASE.y, heading: 0 },
  robot: "rover",
  generate: () => ({ seed: Math.floor(Math.random() * 1e9) }),
  paintFloor(p) {
    p.fill("#c8794f");
    for (let x = -W / 2 + 500; x < W / 2; x += 500) p.line(x, -H / 2, x, H / 2, 12, "#bb6f47");
    for (let y = -H / 2 + 500; y < H / 2; y += 500) p.line(-W / 2, y, W / 2, y, 12, "#bb6f47");
    for (const z of ZONES) {
      if (z.x0 > -W / 2) p.line(z.x0, -H / 2, z.x0, H / 2, 30, "#a65c38");
      p.text(z.name, (z.x0 + z.x1) / 2, H / 2 - 400, 400, "#a65c38");
    }
    for (const h of HAZARDS) {
      p.circle(h.x, h.y, h.r, "#9acd32");
      p.circle(h.x, h.y, h.r * 0.7, "#c6f04a");
    }
    p.rect(RIVER.x, 0, RIVER.w, H, "#3fbf5a");
    for (const b of BRIDGES) {
      p.rect(RIVER.x, b, RIVER.w + 300, BRIDGE_W, "#8b5a2b");
      for (let x = RIVER.x - 250; x <= RIVER.x + 250; x += 100) p.line(x, b - BRIDGE_W / 2, x, b + BRIDGE_W / 2, 10, "#6e451f");
    }
    p.rect(BASE.x, BASE.y, BASE.w, BASE.h, "#9aa3ad");
    p.rect(BASE.x, BASE.y, BASE.w - 80, BASE.h - 80, "#c4cad1");
    p.text("BASE", BASE.x, BASE.y + 500, 220, "#4c566a");
  },
  build(world) {
    // The river: a low green slab the rover can't cross except on bridges.
    for (const [y0, y1] of riverSegments()) {
      world.add({ shape: { kind: "box", w: RIVER.w, d: y1 - y0, h: 20 }, x: RIVER.x, y: (y0 + y1) / 2, color: 0x3fbf5a, tag: "river" });
    }
    for (const [x, y, r] of ROCKS) {
      world.add({ shape: { kind: "cylinder", r, h: 260 }, x, y, color: 0x6b5a4e, tag: "obstacle" });
    }
  },
  setup(world, robot, rescue) {
    const map: RoverMap = {
      w: W,
      h: H,
      base: BASE,
      zones: ZONES,
      hazards: HAZARDS,
      rand: seeded(rescue.seed),
      blocked,
      enemiesIn: (zone) => {
        if (zone.name === "A") return [SPIDER];
        if (zone.name === "B") return [SPIDER, SPIDER];
        return [SPIDER, SERPENTS[zone.name]];
      },
    };
    rescue.game = new RoverGame(world, robot, map);
    robot.devices.set("rover", { kind: "Rover", api: rescue.game });
  },
  status: (_world, _robot, rescue) => rescue.game?.status ?? null,
};
