import RAPIER from "@dimforge/rapier3d-compat";
import { MM, World, bodyHeading, headingQuat, toPhysics } from "./world";
import type { DeviceInfo } from "../runtime/bridge";
import { Bumper, Distance, Eye, Mounting, type EyeColor, type FloorReader } from "./devices";
import { Magnet, Pen, type DrawSurface } from "./tools";

/** Speed at 100% velocity. */
const MAX_DRIVE_MM_S = 500;
const MAX_TURN_DEG_S = 180;

/**
 * Body size in mm. The physics footprint is round (radius) so turning in
 * place never sweeps into a wall: from the middle of a 200 mm square next to
 * a wall, the robot can always turn.
 */
export const ROBOT_SIZE = { w: 150, l: 176, h: 110, radius: 95 };

const wrap360 = (a: number) => ((a % 360) + 360) % 360;
const wrap180 = (a: number) => wrap360(a + 180) - 180;

type Motion =
  | { kind: "idle" }
  | { kind: "drive"; dir: 1 | -1 }
  | { kind: "turn"; dir: 1 | -1 }
  | { kind: "driveFor"; dir: 1 | -1; remaining: number; started: number }
  | { kind: "turnFor"; dir: 1 | -1; remaining: number; started: number };

/**
 * Drive and turn commands. Progress is measured like wheel encoders: the
 * commanded motion is counted even if a wall blocks the robot, so a blocked
 * drive_for still finishes instead of hanging the program.
 */
export class Drivetrain {
  private motion: Motion = { kind: "idle" };
  private pending: (() => void) | null = null;
  private driveVelocity = 50;
  private turnVelocity = 50;
  private timeout = 0;
  private headingZero = 0;
  private rotationZero = 0;
  /** Unwrapped actual heading since reset (the gyro). */
  private rot = 0;
  private lastHeading: number;

  constructor(
    private world: World,
    private body: RAPIER.RigidBody,
  ) {
    this.lastHeading = bodyHeading(body);
    this.rot = this.lastHeading;
  }

  /** Apply the current command's velocity for one step. */
  update(dt: number) {
    const m = this.motion;
    let v = 0; // mm/s, along heading
    let w = 0; // deg/s, clockwise
    const driveSpeed = (MAX_DRIVE_MM_S * this.driveVelocity) / 100;
    const turnSpeed = (MAX_TURN_DEG_S * this.turnVelocity) / 100;
    if (m.kind === "drive") v = m.dir * driveSpeed;
    if (m.kind === "turn") w = m.dir * turnSpeed;
    if ((m.kind === "driveFor" || m.kind === "turnFor") && !this.finishing) {
      const timedOut = this.timeout > 0 && this.world.time - m.started >= this.timeout - 1e-6;
      const speed = m.kind === "driveFor" ? driveSpeed : turnSpeed;
      const step = timedOut ? 0 : Math.min(speed * dt, m.remaining);
      m.remaining -= step;
      if (m.kind === "driveFor") v = (m.dir * step) / dt;
      else w = (m.dir * step) / dt;
      if (m.remaining <= 1e-9 || timedOut) this.finishAfterStep();
    }

    const h = (bodyHeading(this.body) * Math.PI) / 180;
    const vy = this.body.linvel().y;
    this.body.setLinvel({ x: Math.sin(h) * v * MM, y: vy, z: -Math.cos(h) * v * MM }, true);
    this.body.setAngvel({ x: 0, y: (-w * Math.PI) / 180, z: 0 }, true);
  }

  /** Track the unwrapped heading after the physics step. */
  afterStep() {
    const h = bodyHeading(this.body);
    this.rot += wrap180(h - this.lastHeading);
    this.lastHeading = h;
    if (this.finishing) {
      this.finishing = false;
      if (this.motion.kind === "driveFor" || this.motion.kind === "turnFor") this.motion = { kind: "idle" };
      this.resolvePending();
    }
  }

  private finishing = false;
  private finishAfterStep() {
    this.finishing = true;
  }

  private resolvePending() {
    const p = this.pending;
    this.pending = null;
    if (p) {
      p();
      this.world.settled++;
    }
  }

  private start(motion: Motion): Promise<void> {
    this.resolvePending();
    this.finishing = false;
    this.motion = motion;
    if (motion.kind === "driveFor" || motion.kind === "turnFor") {
      if (motion.remaining <= 0) {
        this.motion = { kind: "idle" };
        return Promise.resolve();
      }
      return new Promise((resolve) => (this.pending = resolve));
    }
    return Promise.resolve();
  }

  // ---- Python-facing API (see vexcode_vr.py) ----

  drive(dir: string) {
    this.start({ kind: "drive", dir: dir === "REVERSE" ? -1 : 1 });
  }

  turn(dir: string) {
    this.start({ kind: "turn", dir: dir === "LEFT" ? -1 : 1 });
  }

  drive_for(dir: string, mm: number) {
    const sign = (dir === "REVERSE" ? -1 : 1) * Math.sign(mm || 1);
    return this.start({
      kind: "driveFor",
      dir: sign as 1 | -1,
      remaining: Math.abs(mm),
      started: this.world.time,
    });
  }

  turn_for(dir: string, deg: number) {
    const sign = (dir === "LEFT" ? -1 : 1) * Math.sign(deg || 1);
    return this.start({
      kind: "turnFor",
      dir: sign as 1 | -1,
      remaining: Math.abs(deg),
      started: this.world.time,
    });
  }

  turn_to_heading(deg: number) {
    const delta = wrap180(deg - this.heading());
    return this.turn_for("RIGHT", delta);
  }

  turn_to_rotation(deg: number) {
    return this.turn_for("RIGHT", deg - this.rotation());
  }

  stop() {
    this.start({ kind: "idle" });
  }

  set_heading(deg: number) {
    this.headingZero = this.rot - deg;
  }

  set_rotation(deg: number) {
    this.rotationZero = this.rot - deg;
  }

  set_timeout(seconds: number) {
    this.timeout = seconds;
  }

  set_drive_velocity(pct: number) {
    this.driveVelocity = Math.max(0, Math.min(100, pct));
  }

  set_turn_velocity(pct: number) {
    this.turnVelocity = Math.max(0, Math.min(100, pct));
  }

  heading() {
    return Math.round(wrap360(this.rot - this.headingZero) * 100) / 100 % 360;
  }

  rotation() {
    return Math.round((this.rot - this.rotationZero) * 100) / 100;
  }

  is_done() {
    return this.motion.kind !== "driveFor" && this.motion.kind !== "turnFor";
  }

  is_moving() {
    return this.motion.kind !== "idle";
  }

  /** Commanded velocities, for the dashboard. */
  get velocities() {
    return { drive: this.driveVelocity, turn: this.turnVelocity };
  }
}

export interface RobotStart {
  x: number;
  y: number;
  heading: number;
}

export interface RobotOptions {
  /** The painted floor, for down-facing eye sensors and the pen. */
  floor?: () => (FloorReader & DrawSurface) | null;
  /** Playground override for what the eye reads at a spot (hidden art). */
  colorAt?: (x: number, y: number) => EyeColor | null;
  /** The pen drew on the floor (repaint it). */
  onDraw?: () => void;
}

/** Sensor states that fire events when they change. */
type Watch = { event: string; on: string; off: string; read: () => boolean; last: boolean };

/** The standard VR Robot: drivetrain, bumpers, eyes, distance, pen, magnet. */
export class Robot {
  readonly body: RAPIER.RigidBody;
  readonly drivetrain: Drivetrain;
  readonly pen: Pen;
  readonly magnet: Magnet;
  readonly devices = new Map<string, { kind: string; api: unknown }>();
  /** Set by the runner to receive sensor events like "left_bumper.pressed". */
  onEvent: ((event: string) => void) | null = null;
  private watches: Watch[] = [];

  constructor(
    readonly world: World,
    start: RobotStart,
    opts: RobotOptions = {},
  ) {
    const { h, radius } = ROBOT_SIZE;
    const p = toPhysics(start.x, start.y, h / 2 + 1);
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(p.x, p.y, p.z)
      .setRotation(headingQuat(start.heading))
      .enabledRotations(false, true, false)
      .setCanSleep(false);
    this.body = world.physics.createRigidBody(desc);
    // Frictionless so the floor doesn't slow commanded moves; heavy so it
    // pushes game objects rather than being pushed.
    const col = RAPIER.ColliderDesc.cylinder((h / 2) * MM, radius * MM)
      .setFriction(0)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setDensity(1500);
    world.physics.createCollider(col, this.body);

    const mount = new Mounting(world, this.body, h / 2);
    const floor = opts.floor ?? (() => null);
    this.drivetrain = new Drivetrain(world, this.body);
    this.pen = new Pen(mount, floor, opts.onDraw ?? (() => {}));
    this.magnet = new Magnet(world, mount);
    const leftBumper = new Bumper(mount, -1, radius);
    const rightBumper = new Bumper(mount, 1, radius);
    const frontEye = new Eye(mount, { x: 0, y: radius, z: 30 }, "front", floor);
    const downEye = new Eye(mount, { x: 0, y: 60, z: 5 }, "down", floor, opts.colorAt);
    const frontDistance = new Distance(mount, { x: 0, y: radius, z: 50 }, false);
    const downDistance = new Distance(mount, { x: 0, y: 60, z: 5 }, true);

    const add = (name: string, kind: string, api: unknown) => this.devices.set(name, { kind, api });
    add("drivetrain", "Drivetrain", this.drivetrain);
    add("location", "Location", {
      x: () => this.position.x,
      y: () => this.position.y,
      angle: () => this.heading,
    });
    add("left_bumper", "Bumper", leftBumper);
    add("right_bumper", "Bumper", rightBumper);
    add("front_eye", "EyeSensor", frontEye);
    add("down_eye", "EyeSensor", downEye);
    add("front_distance", "Distance", frontDistance);
    add("down_distance", "Distance", downDistance);
    add("pen", "Pen", this.pen);
    add("magnet", "Electromagnet", this.magnet);

    const watch = (event: string, on: string, off: string, read: () => boolean) =>
      this.watches.push({ event, on, off, read, last: read() });
    watch("left_bumper", "pressed", "released", () => leftBumper.pressed());
    watch("right_bumper", "pressed", "released", () => rightBumper.pressed());
    watch("front_eye", "object_detected", "object_lost", () => frontEye.near_object());
    watch("down_eye", "object_detected", "object_lost", () => downEye.near_object());

    world.onStep((dt) => {
      this.drivetrain.update(dt);
      this.magnet.update();
    });
    world.onAfterStep(() => {
      this.drivetrain.afterStep();
      this.pen.update();
      this.checkEvents();
    });
  }

  private checkEvents() {
    if (!this.onEvent) return;
    for (const w of this.watches) {
      const now = w.read();
      if (now !== w.last) this.onEvent(`${w.event}.${now ? w.on : w.off}`);
      w.last = now;
    }
  }

  deviceList(): DeviceInfo[] {
    return [...this.devices].map(([name, d]) => ({ name, kind: d.kind }));
  }

  /** A device's Python-facing object, e.g. device<Eye>("front_eye"). */
  device<T>(name: string) {
    return this.devices.get(name)?.api as T;
  }

  get position() {
    return World.position(this.body);
  }

  get heading() {
    return wrap360(bodyHeading(this.body));
  }
}
