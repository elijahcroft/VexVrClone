import RAPIER from "@dimforge/rapier3d-compat";
import type { Mounting } from "./devices";
import { World, headingQuat, bodyHeading, toPhysics, type SimObject } from "./world";

/** Anything the pen can draw on (the painted floor). */
export interface DrawSurface {
  line(x1: number, y1: number, x2: number, y2: number, width: number, color: string): void;
  floodFill(x: number, y: number, rgba: [number, number, number, number]): void;
}

const PEN_COLORS: Record<string, string> = {
  BLACK: "rgb(20,20,24)",
  RED: "rgb(220,38,38)",
  GREEN: "rgb(22,163,74)",
  BLUE: "rgb(37,99,235)",
};
const PEN_WIDTHS: Record<string, number> = { EXTRA_THIN: 2, THIN: 5, MEDIUM: 10, WIDE: 20, EXTRA_WIDE: 40 };

/** The VR pen: draws a trail under the center of the robot while down. */
export class Pen {
  private down = false;
  private color = PEN_COLORS.BLACK;
  private width = PEN_WIDTHS.THIN;
  private last: { x: number; y: number } | null = null;

  constructor(
    private mount: Mounting,
    private surface: () => DrawSurface | null,
    private onDraw: () => void,
  ) {}

  /** Called after each physics step. */
  update() {
    if (!this.down) return;
    const p = this.mount.point({ x: 0, y: 0, z: 0 });
    if (this.last && (p.x !== this.last.x || p.y !== this.last.y)) {
      this.surface()?.line(this.last.x, this.last.y, p.x, p.y, this.width, this.color);
      this.onDraw();
    }
    this.last = { x: p.x, y: p.y };
  }

  move(action: string) {
    this.down = action === "DOWN";
    this.last = null;
    // A dot where the pen touches down.
    if (this.down) this.update();
  }

  set_pen_color(color: string) {
    this.color = PEN_COLORS[color] ?? this.color;
  }

  set_pen_width(width: string) {
    this.width = PEN_WIDTHS[width] ?? this.width;
  }

  set_pen_color_rgb(r: number, g: number, b: number, opacity = 100) {
    this.color = `rgba(${r},${g},${b},${opacity / 100})`;
  }

  fill(r: number, g: number, b: number, opacity = 100) {
    const p = this.mount.point({ x: 0, y: 0, z: 0 });
    this.surface()?.floodFill(p.x, p.y, [r, g, b, opacity / 100]);
    this.onDraw();
  }
}

/** Where a held disk sits: just ahead of the robot, lifted to the magnet. */
const HOLD = { x: 0, y: 150, z: 40 };
const PICKUP_RANGE = 80;

/** Electromagnet: BOOST picks up the disk in front, DROP lets it go. */
export class Magnet {
  private held: SimObject | null = null;

  constructor(
    private world: World,
    private mount: Mounting,
  ) {}

  energize(action: string) {
    if (action === "BOOST" && !this.held) this.pickUp();
    if (action === "DROP" && this.held) this.drop();
  }

  private pickUp() {
    const at = this.mount.point({ ...HOLD, z: 0 });
    let best: SimObject | null = null;
    let bestDist = PICKUP_RANGE;
    for (const obj of this.world.objects) {
      if (!obj.pickable || obj.removed) continue;
      const p = World.position(obj.body);
      const d = Math.hypot(p.x - at.x, p.y - at.y);
      if (d < bestDist && p.z < 100) {
        best = obj;
        bestDist = d;
      }
    }
    if (!best) return;
    this.held = best;
    best.held = true;
    best.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    best.body.collider(0).setSensor(true);
    this.update();
  }

  private drop() {
    const obj = this.held!;
    this.held = null;
    obj.held = false;
    const p = this.mount.point({ ...HOLD, z: 0 });
    const h = obj.shape.h;
    const pos = toPhysics(p.x, p.y, h / 2 + 1);
    obj.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    obj.body.collider(0).setSensor(false);
    obj.body.setTranslation(pos, true);
    obj.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    obj.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  /** Called before each physics step: carry the held disk. */
  update() {
    if (!this.held) return;
    const p = this.mount.point(HOLD);
    this.held.body.setNextKinematicTranslation(toPhysics(p.x, p.y, p.z + this.held.shape.h / 2));
    this.held.body.setNextKinematicRotation(headingQuat(bodyHeading(this.mount.body)));
  }

  get holding() {
    return this.held;
  }
}
