import { TABLE_HEIGHT } from "../sim/session";
import { hexCorners, type World } from "../sim/world";
import { COLOR, COLOR_NAMES, objectsTagged, positionOf, type ColorName } from "./helpers";
import type { PlaygroundDef } from "./types";

const BLOCK = 90; // mm cube

interface Castle {
  x: number;
  y: number;
  color: ColorName;
  /** Blocks high. */
  levels: number;
}

/** A castle: a 2x2 base of blocks with a tower block on top per level. */
function buildCastle(world: World, c: Castle, density = 250) {
  const offsets = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
  ];
  for (let level = 0; level < c.levels; level++) {
    const spots = level === c.levels - 1 && level > 0 ? [[0, 0]] : offsets;
    for (const [dx, dy] of spots) {
      world.add({
        shape: { kind: "box", w: BLOCK, d: BLOCK, h: BLOCK },
        x: c.x + dx * (BLOCK + 2),
        y: c.y + dy * (BLOCK + 2),
        z: level * (BLOCK + 1),
        color: COLOR[c.color].hex,
        eyeColor: c.color,
        tag: "castle",
        dynamic: true,
        density,
        friction: 0.6,
      });
    }
  }
}

function paintTable(p: import("../render/floor").FloorPainter) {
  p.fill("#efe6d8");
  for (let v = -1000; v <= 1000; v += 250) {
    p.line(v, -1000, v, 1000, 3, "#e1d5c2");
    p.line(-1000, v, 1000, v, 3, "#e1d5c2");
  }
  // A dark rim so the edge is easy to see from above.
  p.ctx.strokeStyle = "#7a5c3e";
  p.ctx.lineWidth = 30 * p.scale;
  p.ctx.strokeRect(0, 0, p.canvas.width, p.canvas.height);
}

function castleStatus(world: World) {
  const pieces = objectsTagged(world, "castle");
  const down = pieces.filter((o) => positionOf(o).z < -TABLE_HEIGHT / 2).length;
  return down === pieces.length ? `All ${down} castle pieces knocked off!` : `Castle pieces knocked off: ${down} / ${pieces.length}`;
}

const FIXED: Castle[] = [
  { x: 0, y: 150, color: "RED", levels: 3 },
  { x: -550, y: 450, color: "BLUE", levels: 2 },
  { x: 550, y: 450, color: "GREEN", levels: 2 },
  { x: -600, y: -350, color: "GREEN", levels: 2 },
  { x: 600, y: -350, color: "BLUE", levels: 2 },
  { x: 0, y: 750, color: "RED", levels: 2 },
];

export const castleCrasher: PlaygroundDef = {
  id: "castle-crasher",
  name: "Castle Crasher",
  description: "Push every castle piece off the table. Careful: the robot can fall off too!",
  size: { w: 2000, h: 2000 },
  start: { x: 0, y: -800, heading: 0 },
  raised: true,
  paintFloor: paintTable,
  build(world) {
    for (const c of FIXED) buildCastle(world, c);
  },
  status: castleStatus,
};

export const dynamicCastleCrasher: PlaygroundDef<Castle[]> = {
  id: "dynamic-castle-crasher",
  name: "Dynamic Castle Crasher",
  description: "Castles appear in new places every reset. Find them with your sensors.",
  size: { w: 2000, h: 2000 },
  start: { x: 0, y: -800, heading: 0 },
  raised: true,
  generate() {
    const castles: Castle[] = [];
    let tries = 0;
    while (castles.length < 5 && tries++ < 500) {
      const x = Math.round((Math.random() * 1500 - 750) / 10) * 10;
      const y = Math.round((Math.random() * 1400 - 550) / 10) * 10;
      const clear = castles.every((c) => Math.hypot(c.x - x, c.y - y) > 400) && Math.hypot(x, y + 800) > 450;
      if (!clear) continue;
      const color = COLOR_NAMES[Math.floor(Math.random() * 3)];
      castles.push({ x, y, color, levels: 2 + Math.floor(Math.random() * 2) });
    }
    return castles;
  },
  paintFloor: paintTable,
  build(world, castles) {
    for (const c of castles) buildCastle(world, c);
  },
  status: castleStatus,
};

// ------------------------------------------------------------ Castle Crasher+

const HEX_R = 1644; // 3288 mm across
const PLUS_CASTLES: Castle[] = [
  { x: 0, y: 0, color: "RED", levels: 3 },
  { x: -650, y: 550, color: "BLUE", levels: 2 },
  { x: -650, y: -550, color: "RED", levels: 2 },
  { x: 250, y: 800, color: "BLUE", levels: 2 },
  { x: 250, y: -800, color: "RED", levels: 2 },
  { x: -1100, y: 0, color: "BLUE", levels: 3 },
];
const TREES: [number, number][] = [
  [500, 420],
  [500, -380],
  [-300, 950],
  [-320, -950],
  [-1000, 650],
  [-1000, -650],
];

function addTree(world: World, x: number, y: number) {
  // The trunk is what sensors hit; the eye reads trees as green.
  world.add({ shape: { kind: "cylinder", r: 45, h: 260 }, x, y, color: 0x7a5230, eyeColor: "GREEN", tag: "tree" });
  world.add({ shape: { kind: "cylinder", r: 150, h: 170 }, x, y, z: 220, color: 0x2f8f46, tag: "tree" });
}

export const castleCrasherPlus: PlaygroundDef<{ trees: boolean }> = {
  id: "castle-crasher-plus",
  name: "Castle Crasher+",
  description: "Push castles off the island into the water without falling in. Level 2 adds trees that can't be moved.",
  size: { w: HEX_R * 2, h: HEX_R * 2 },
  start: { x: 1014, y: 50, heading: 270 },
  starts: [
    { label: "Level 1", pose: { x: 1014, y: 50, heading: 270 } },
    { label: "Level 2 (trees)", pose: { x: 1014, y: 50, heading: 270 } },
  ],
  raised: "hex",
  theme: "island",
  generate: (level) => ({ trees: level === 1 }),
  paintFloor(p) {
    p.ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);
    p.polygon(hexCorners(HEX_R), "#8a6f55");
    p.polygon(hexCorners(HEX_R - 40), "#c9b48f");
    for (let r = 300; r < HEX_R - 100; r += 300) p.circle(0, 0, r, "#bca57f", 4);
  },
  build(world, { trees }) {
    for (const c of PLUS_CASTLES) buildCastle(world, c, 1200);
    if (trees) for (const [x, y] of TREES) addTree(world, x, y);
  },
  status(world, robot) {
    const pieces = objectsTagged(world, "castle");
    const inWater = (o: (typeof pieces)[number]) => positionOf(o).z < -100;
    const kg = (list: typeof pieces) => list.reduce((sum, o) => sum + o.body.mass(), 0).toFixed(1);
    const score = `In the water: ${kg(pieces.filter(inWater))} of ${kg(pieces)} kg`;
    return robot.position.z < -100 ? `Robot fell in! ${score}` : score;
  },
};
