import type { PlaygroundDef } from "../playgrounds/types";
import { FloorPainter } from "../render/floor";
import { Robot } from "./robot";
import { STEP, World } from "./world";

/** One playground loaded into a fresh physics world. Reset = new session. */
export class SimSession {
  readonly world = new World();
  readonly robot: Robot;
  readonly floor: FloorPainter;
  private accumulator = 0;

  constructor(readonly def: PlaygroundDef) {
    const { w, h } = def.size;
    this.world.addFloor(w + 2000, h + 2000);
    if (def.border !== false) this.world.addBorder(w, h);
    def.build?.(this.world);
    this.robot = new Robot(this.world, def.start);
    this.floor = new FloorPainter(w, h);
    def.paintFloor(this.floor);
  }

  /** Advance by real elapsed seconds using fixed steps. */
  advance(seconds: number) {
    this.accumulator = Math.min(this.accumulator + seconds, STEP * 6);
    while (this.accumulator >= STEP) {
      this.world.step();
      this.accumulator -= STEP;
    }
  }
}
