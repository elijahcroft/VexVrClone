import RAPIER from "@dimforge/rapier3d-compat";
import { MM, World, bodyHeading, toPhysics, type SimObject } from "./world";

export type EyeColor = "RED" | "GREEN" | "BLUE" | "NONE";

/** What the robot's sensors can read from the playground floor. */
export interface FloorReader {
  /** RGB (0-255) at a field position, or null off the floor. */
  sample(x: number, y: number): [number, number, number] | null;
}

/** Classify an RGB floor color the way the eye sensor reports it. */
export function classifyColor([r, g, b]: [number, number, number]): EyeColor {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 60 || max - min < 70) return "NONE";
  if (r === max && r - Math.max(g, b) > 50) return "RED";
  if (g === max && g - Math.max(r, b) > 30) return "GREEN";
  if (b === max && b - Math.max(r, g) > 30) return "BLUE";
  return "NONE";
}

/** Perceived brightness 0-100 of an RGB color. */
export function brightness([r, g, b]: [number, number, number]) {
  return Math.round(((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * 100);
}

/** A point and direction on the robot, in robot-relative field mm. */
interface Mount {
  /** Right of center (mm). */
  x: number;
  /** Ahead of center (mm). */
  y: number;
  /** Above the floor (mm). */
  z: number;
}

/**
 * Helpers for sensors mounted on a robot body: world-space points and rays.
 */
export class Mounting {
  constructor(
    private world: World,
    readonly body: RAPIER.RigidBody,
    private halfHeight: number,
  ) {}

  /** Field position of a mount point (mm). */
  point(m: Mount) {
    const p = World.position(this.body);
    const h = (bodyHeading(this.body) * Math.PI) / 180;
    // Robot frame: +y ahead, +x right. Field heading is clockwise from north.
    return {
      x: p.x + m.x * Math.cos(h) + m.y * Math.sin(h),
      y: p.y - m.x * Math.sin(h) + m.y * Math.cos(h),
      z: p.z - this.halfHeight + m.z,
    };
  }

  /** Cast a ray from a mount; `down` points at the floor, else straight ahead. */
  cast(m: Mount, maxMm: number, down = false, angleDeg = 0) {
    const o = this.point(m);
    const origin = toPhysics(o.x, o.y, o.z);
    let dir;
    if (down) {
      dir = { x: 0, y: -1, z: 0 };
    } else {
      const h = ((bodyHeading(this.body) + angleDeg) * Math.PI) / 180;
      dir = { x: Math.sin(h), y: 0, z: -Math.cos(h) };
    }
    const ray = new RAPIER.Ray(origin, dir);
    const notHeld = (c: RAPIER.Collider) => !this.world.objectFor(c)?.held;
    const hit = this.world.physics.castRay(ray, maxMm * MM, true, undefined, undefined, undefined, this.body, notHeld);
    if (!hit) return null;
    const object = this.world.objectFor(hit.collider);
    return { distance: hit.timeOfImpact / MM, object };
  }
}

/** Front bumper switch: pressed when something touches that side of the front. */
export class Bumper {
  constructor(
    private mount: Mounting,
    private side: -1 | 1,
    private radius: number,
  ) {}

  pressed() {
    // Short rays fanned across this half of the front, just past the body.
    for (const angle of [8, 22, 36]) {
      const hit = this.mount.cast({ x: 0, y: 0, z: 40 }, this.radius + 4, false, this.side * angle);
      if (hit && hit.object?.tag !== "floor") return true;
    }
    return false;
  }
}

/** Eye sensor: front-facing sees objects; down-facing sees the floor. */
export class Eye {
  /** How far ahead (front) or below (down) the sensor notices things, mm. */
  private range: number;

  constructor(
    private mount: Mounting,
    private where: Mount,
    private facing: "front" | "down",
    private floor: () => FloorReader | null,
    private colorOverride?: (x: number, y: number) => EyeColor | null,
  ) {
    this.range = facing === "front" ? 100 : 40;
  }

  private look(): { color: EyeColor; bright: number } | null {
    const hit = this.mount.cast(this.where, this.range, this.facing === "down");
    if (!hit) return null;
    const obj = hit.object;
    if (obj && obj.tag !== "floor") {
      const rgb = hexToRgb(obj.color);
      return { color: obj.eyeColor ?? "NONE", bright: brightness(rgb) };
    }
    // The floor: use the painted floor (including pen drawings).
    const p = this.mount.point(this.where);
    const override = this.colorOverride?.(p.x, p.y);
    const rgb = this.floor()?.sample(p.x, p.y) ?? [128, 128, 128];
    return { color: override ?? classifyColor(rgb), bright: brightness(rgb) };
  }

  near_object() {
    return this.look() !== null;
  }

  detect(color: string) {
    const seen = this.look()?.color ?? "NONE";
    return seen === color;
  }

  color(): EyeColor {
    return this.look()?.color ?? "NONE";
  }

  brightness() {
    return this.look()?.bright ?? 0;
  }
}

/** Distance sensor: a ray from the front (or underside) of the robot. */
export class Distance {
  static readonly MAX = 3000;

  constructor(
    private mount: Mounting,
    private where: Mount,
    private down: boolean,
  ) {}

  private hit() {
    return this.mount.cast(this.where, Distance.MAX, this.down);
  }

  found_object() {
    return this.hit() !== null;
  }

  get_distance() {
    const hit = this.hit();
    return hit ? Math.round(hit.distance) : Distance.MAX;
  }
}

export function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

export type { SimObject };
