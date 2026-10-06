import type { AnyPlayground } from "../playgrounds/types";
import { FloorPainter } from "../render/floor";
import { Robot } from "./robot";
import { STEP, World } from "./world";

/** How far below a raised field the ground is (mm). */
export const TABLE_HEIGHT = 400;

/** One playground loaded into a fresh physics world. Reset = new session. */
export class SimSession {
  readonly world = new World();
  readonly robot: Robot;
  readonly floor: FloorPainter;
  readonly layout: unknown;
  /** The floor canvas changed (pen) and the texture needs re-uploading. */
  floorDirty = false;
  private accumulator = 0;

  constructor(
    readonly def: AnyPlayground,
    readonly startIndex = 0,
  ) {
    const { w, h } = def.size;
    this.layout = def.generate?.(startIndex);
    this.floor = new FloorPainter(w, h);
    def.paintFloor(this.floor, this.layout);
    if (def.raised) {
      this.world.addFloor(w + 6000, h + 6000, -TABLE_HEIGHT);
      this.world.add({
        shape: def.raised === "hex" ? { kind: "hex", r: w / 2, h: TABLE_HEIGHT } : { kind: "box", w, d: h, h: TABLE_HEIGHT },
        x: 0,
        y: 0,
        z: -TABLE_HEIGHT,
        color: 0x8a6f55,
        tag: "floor",
      });
    } else {
      this.world.addFloor(w + 2000, h + 2000);
      if (def.border !== false) this.world.addBorder(w, h);
    }
    def.build?.(this.world, this.layout);
    const start = def.startFor?.(this.layout) ?? def.starts?.[startIndex]?.pose ?? def.start;
    this.robot = new Robot(this.world, start, {
      kind: def.robot,
      floor: () => this.floor,
      colorAt: def.colorAt && ((x, y) => def.colorAt!(x, y, this.layout)),
      onDraw: () => (this.floorDirty = true),
    });
    if (def.onStep) this.world.onStep((dt) => def.onStep!(this.world, this.robot, this.layout, dt));
  }

  /** Goal progress text for the playground window, if the playground has one. */
  status() {
    return this.def.status?.(this.world, this.robot, this.layout) ?? null;
  }

  /** Advance by real elapsed seconds using fixed steps; `speed` > 1 fast-forwards. */
  advance(seconds: number, speed = 1) {
    this.accumulator = Math.min(this.accumulator + seconds * speed, STEP * 6 * speed);
    while (this.accumulator >= STEP) {
      const settled = this.world.settled;
      this.world.step();
      this.accumulator -= STEP;
      // A program just got unblocked: let it run before simulating further.
      if (this.world.settled !== settled) break;
    }
  }
}
