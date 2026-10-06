import RAPIER from "@dimforge/rapier3d-compat";

/**
 * Field coordinates (what students see): mm, origin at the field center,
 * +X east, +Y north, heading 0 = north, clockwise positive.
 * Physics coordinates (Rapier/Three): meters, +Y up, north = -Z.
 */
export const MM = 0.001;

export function toPhysics(x: number, y: number, z = 0) {
  return { x: x * MM, y: z * MM, z: -y * MM };
}

/** Rotation quaternion about +Y for a field heading in degrees. */
export function headingQuat(headingDeg: number) {
  const half = (-headingDeg * Math.PI) / 360;
  return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
}

/** Field heading (degrees, unwrapped to -180..180) of a body. */
export function bodyHeading(body: RAPIER.RigidBody) {
  const q = body.rotation();
  // Yaw about +Y, then flip sign: Three's +Y rotation is counterclockwise.
  const yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
  return (-yaw * 180) / Math.PI;
}

export type Shape =
  | { kind: "box"; w: number; d: number; h: number } // mm: width (x), depth (y), height
  | { kind: "cylinder"; r: number; h: number };

/** Anything the renderer should draw and keep in sync with physics. */
export interface SimObject {
  body: RAPIER.RigidBody;
  shape: Shape;
  color: number;
  /** Free-form tag playgrounds use to find their objects (e.g. "disk"). */
  tag?: string;
  /** Eye-sensor color, if the object reads as one. */
  eyeColor?: "RED" | "GREEN" | "BLUE";
  removed?: boolean;
}

interface Waiter {
  until: number;
  resolve: () => void;
}

export const STEP = 1 / 60;

export class World {
  readonly physics: RAPIER.World;
  readonly objects: SimObject[] = [];
  /** Simulated seconds since reset. */
  time = 0;
  private waiters: Waiter[] = [];
  private stepHooks: ((dt: number) => void)[] = [];
  private afterStepHooks: (() => void)[] = [];

  constructor() {
    this.physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.physics.timestep = STEP;
  }

  static async init() {
    await RAPIER.init();
  }

  /** Run `fn` before each physics step. */
  onStep(fn: (dt: number) => void) {
    this.stepHooks.push(fn);
  }

  /** Run `fn` after each physics step. */
  onAfterStep(fn: () => void) {
    this.afterStepHooks.push(fn);
  }

  step() {
    for (const hook of this.stepHooks) hook(STEP);
    this.physics.step();
    this.time += STEP;
    for (const hook of this.afterStepHooks) hook();
    const due = this.waiters.filter((w) => w.until <= this.time + 1e-9);
    if (due.length) {
      this.waiters = this.waiters.filter((w) => w.until > this.time + 1e-9);
      for (const w of due) w.resolve();
    }
  }

  /** Resolves after `seconds` of simulated time. */
  wait(seconds: number) {
    return new Promise<void>((resolve) => {
      this.waiters.push({ until: this.time + Math.max(0, seconds), resolve });
    });
  }

  /** Release everything waiting on sim time (used when a program stops). */
  releaseWaiters() {
    for (const w of this.waiters) w.resolve();
    this.waiters = [];
  }

  /** Add a box or cylinder at field position (mm), resting on z (mm). */
  add(
    opts: {
      shape: Shape;
      x: number;
      y: number;
      z?: number;
      heading?: number;
      dynamic?: boolean;
      density?: number;
      friction?: number;
    } & Omit<SimObject, "body" | "shape">,
  ): SimObject {
    const { shape, x, y, z = 0, heading = 0, dynamic = false } = opts;
    const height = shape.h;
    const pos = toPhysics(x, y, z + height / 2);
    const desc = (dynamic ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed())
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation(headingQuat(heading));
    const body = this.physics.createRigidBody(desc);
    const col =
      shape.kind === "box"
        ? RAPIER.ColliderDesc.cuboid((shape.w / 2) * MM, (height / 2) * MM, (shape.d / 2) * MM)
        : RAPIER.ColliderDesc.cylinder((height / 2) * MM, shape.r * MM);
    col.setFriction(opts.friction ?? 0.5).setDensity(opts.density ?? 500);
    this.physics.createCollider(col, body);
    const obj: SimObject = { body, shape, color: opts.color, tag: opts.tag, eyeColor: opts.eyeColor };
    this.objects.push(obj);
    return obj;
  }

  /** Flat floor slab with its top at z = 0, centered on the origin. */
  addFloor(width: number, depth: number) {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.05, 0);
    const body = this.physics.createRigidBody(desc);
    this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid((width / 2) * MM, 0.05, (depth / 2) * MM).setFriction(0.5),
      body,
    );
  }

  /** Low walls around a width x depth field (mm). */
  addBorder(width: number, depth: number, height = 60, thick = 20, color = 0x9aa3ad) {
    const hw = width / 2 + thick / 2;
    const hd = depth / 2 + thick / 2;
    const tag = "wall";
    this.add({ shape: { kind: "box", w: width + thick * 2, d: thick, h: height }, x: 0, y: hd, color, tag });
    this.add({ shape: { kind: "box", w: width + thick * 2, d: thick, h: height }, x: 0, y: -hd, color, tag });
    this.add({ shape: { kind: "box", w: thick, d: depth, h: height }, x: hw, y: 0, color, tag });
    this.add({ shape: { kind: "box", w: thick, d: depth, h: height }, x: -hw, y: 0, color, tag });
  }

  /** Field position (mm) of a body. */
  static position(body: RAPIER.RigidBody) {
    const t = body.translation();
    return { x: t.x / MM, y: -t.z / MM, z: t.y / MM };
  }
}
