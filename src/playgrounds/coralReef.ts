import type { World } from "../sim/world";
import { COLOR, inside, objectsTagged, positionOf, type ColorName } from "./helpers";
import type { PlaygroundDef } from "./types";

/** Recycling zone the trash has to be dropped in. */
const ZONE = { x: 0, y: -820, w: 600, h: 320 };
/** Battery: seconds of driving on a full charge, and drain while idle (%/s). */
const DRIVE_SECONDS = 150;
const IDLE_DRAIN = 0.1;

const TRASH: [number, number, ColorName][] = [
  [-700, -400, "RED"],
  [700, -400, "GREEN"],
  [-500, 200, "BLUE"],
  [500, 200, "RED"],
  [-150, 500, "GREEN"],
  [250, 600, "BLUE"],
  [-750, 750, "RED"],
  [750, 750, "GREEN"],
];
/** Coral sits between the routes from the recycling zone to the trash. */
const CORAL: [number, number, number, number][] = [
  // x, y, radius, color
  [-655, -100, 80, 0xff7f6e],
  [655, -100, 80, 0xc56cf0],
  [-850, 200, 70, 0xffb347],
  [850, 200, 70, 0xff6fa8],
  [-300, 850, 70, 0xc56cf0],
  [300, 950, 60, 0xff7f6e],
  [-800, -800, 60, 0xff6fa8],
  [800, -800, 60, 0xffb347],
];

interface Reef {
  battery: number;
}

function collected(world: World) {
  return objectsTagged(world, "trash").filter((t) => !t.held && inside(positionOf(t), ZONE.x, ZONE.y, ZONE.w, ZONE.h)).length;
}

export const coralReefCleanup: PlaygroundDef<Reef> = {
  id: "coral-reef-cleanup",
  name: "Coral Reef Cleanup",
  description: "Use the magnet to bring all the trash to the recycling zone before the battery runs out.",
  size: { w: 2000, h: 2000 },
  start: { x: 0, y: -800, heading: 0 },
  robot: "underwater",
  theme: "underwater",
  generate: () => ({ battery: 100 }),
  paintFloor(p) {
    p.fill("#d8c79a");
    // Sand ripples.
    for (let row = 0, y = -950; y < 1000; row++, y += 90) {
      for (let x = -1000 + (row % 2) * 130; x < 1000; x += 260) p.line(x, y, x + 160, y + 25, 6, "#cbb98a");
    }
    p.rect(ZONE.x, ZONE.y, ZONE.w, ZONE.h, "#f5d76e");
    p.rect(ZONE.x, ZONE.y, ZONE.w - 30, ZONE.h - 30, "#e9c84a");
    p.text("RECYCLING", ZONE.x, ZONE.y + 90, 50, "#7a5c00");
  },
  build(world) {
    for (const [x, y, r, color] of CORAL) {
      world.add({ shape: { kind: "cylinder", r, h: 180 }, x, y, color, tag: "coral" });
      world.add({ shape: { kind: "cylinder", r: r * 0.6, h: 120 }, x: x + r * 0.5, y: y + r * 0.4, color, tag: "coral" });
    }
    for (const [x, y, c] of TRASH) {
      world.add({
        shape: { kind: "cylinder", r: 32, h: 70 },
        x,
        y,
        color: COLOR[c].hex,
        eyeColor: c,
        tag: "trash",
        pickable: true,
        dynamic: true,
        density: 400,
      });
    }
  },
  onStep(_world, robot, reef, dt) {
    if (reef.battery <= 0) return;
    const drain = robot.drivetrain.is_moving() ? 100 / DRIVE_SECONDS : IDLE_DRAIN;
    reef.battery = Math.max(0, reef.battery - drain * dt);
    if (reef.battery === 0) robot.drivetrain.disabled = true;
  },
  status(world, _robot, reef) {
    const n = collected(world);
    const total = TRASH.length;
    if (n === total) return `All ${total} pieces of trash collected!`;
    if (reef.battery <= 0) return `Battery empty! Trash collected: ${n} / ${total}`;
    return `Trash collected: ${n} / ${total} · Battery ${Math.ceil(reef.battery)}%`;
  },
};
