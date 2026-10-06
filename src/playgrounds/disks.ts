import type { FloorPainter } from "../render/floor";
import type { World } from "../sim/world";
import { diskColor, disk, inside, objectsTagged, plainFloor, positionOf, wall, type ColorName } from "./helpers";
import type { PlaygroundDef } from "./types";

interface Zone {
  color: ColorName;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Zone fills: light enough to look like zones, strong enough for the eye. */
const ZONE_FILL: Record<ColorName, string> = { RED: "#ef6b6b", GREEN: "#5ec27a", BLUE: "#6b9cf0" };

function paintZones(p: FloorPainter, zones: Zone[]) {
  for (const z of zones) {
    p.rect(z.x, z.y, z.w, z.h, ZONE_FILL[z.color]);
    p.text(`${z.color.toLowerCase()} zone`, z.x, z.y, 45, "#ffffff");
  }
}

function sortedStatus(world: World, zones: Zone[]) {
  const disks = objectsTagged(world, "disk");
  const sorted = disks.filter((d) => {
    if (d.held) return false;
    const p = positionOf(d);
    return zones.some((z) => z.color === diskColor(d) && inside(p, z.x, z.y, z.w, z.h));
  }).length;
  return sorted === disks.length ? `All ${sorted} disks sorted!` : `Disks sorted: ${sorted} / ${disks.length}`;
}

const MOVER_ZONES: Zone[] = [
  { color: "RED", x: -600, y: 760, w: 450, h: 400 },
  { color: "GREEN", x: 0, y: 760, w: 450, h: 400 },
  { color: "BLUE", x: 600, y: 760, w: 450, h: 400 },
];
const MOVER_DISKS: [number, number, ColorName][] = [
  [-500, -200, "BLUE"],
  [0, -200, "RED"],
  [500, -200, "GREEN"],
  [-500, 100, "GREEN"],
  [0, 100, "BLUE"],
  [500, 100, "RED"],
  [-250, -500, "RED"],
  [250, -500, "GREEN"],
  [600, -650, "BLUE"],
];

export const diskMover: PlaygroundDef = {
  id: "disk-mover",
  name: "Disk Mover",
  description: "Use the magnet to move each colored disk into its matching zone.",
  size: { w: 2000, h: 2000 },
  start: { x: -800, y: -800, heading: 0 },
  paintFloor(p) {
    plainFloor(p);
    paintZones(p, MOVER_ZONES);
  },
  build(world) {
    for (const [x, y, c] of MOVER_DISKS) disk(world, x, y, c);
  },
  status: (world) => sortedStatus(world, MOVER_ZONES),
};

const TRANSPORT_ZONES: Zone[] = [
  { color: "RED", x: -750, y: 750, w: 400, h: 400 },
  { color: "GREEN", x: 0, y: 800, w: 400, h: 300 },
  { color: "BLUE", x: 750, y: 750, w: 400, h: 400 },
];
const TRANSPORT_DISKS: [number, number, ColorName][] = [
  [-700, -300, "GREEN"],
  [700, -300, "RED"],
  [-400, -600, "BLUE"],
  [400, -600, "GREEN"],
  [-780, 150, "BLUE"],
  [780, 150, "RED"],
];

export const diskTransport: PlaygroundDef = {
  id: "disk-transport",
  name: "Disk Transport",
  description: "Drive around the castle and carry each disk to its matching zone.",
  size: { w: 2000, h: 2000 },
  start: { x: 0, y: -800, heading: 0 },
  paintFloor(p) {
    plainFloor(p);
    paintZones(p, TRANSPORT_ZONES);
    p.rect(0, 0, 560, 560, "#cfc6b8");
  },
  build(world) {
    // The castle: thick walls with corner towers.
    const castle = 0xa89f91;
    wall(world, -250, -250, 250, -250, { thick: 60, h: 220, color: castle });
    wall(world, -250, 250, 250, 250, { thick: 60, h: 220, color: castle });
    wall(world, -250, -250, -250, 250, { thick: 60, h: 220, color: castle });
    wall(world, 250, -250, 250, 250, { thick: 60, h: 220, color: castle });
    for (const [x, y] of [[-250, -250], [250, -250], [-250, 250], [250, 250]]) {
      world.add({ shape: { kind: "cylinder", r: 70, h: 300 }, x, y, color: 0x968c7d, tag: "wall" });
    }
    for (const [x, y, c] of TRANSPORT_DISKS) disk(world, x, y, c);
  },
  status: (world) => sortedStatus(world, TRANSPORT_ZONES),
};

