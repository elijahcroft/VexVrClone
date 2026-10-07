import type { Robot } from "./robot";
import { World, toPhysics, type SimObject } from "./world";

/**
 * Rover Rescue game rules and the rover's "rover" device (Python: rover.*).
 * VEX documents the commands, zones and XP values; the mechanics below
 * (ranges, drain rates, enemy behavior, level thresholds) are our own.
 */

export type Thing = "BASE" | "ENEMY" | "MINERALS" | "OBSTACLE" | "HAZARD";

export interface Zone {
  name: string;
  x0: number;
  x1: number;
  /** Seconds between mineral respawns (0 = never). */
  respawn: number;
  minerals: number;
}

export interface EnemyKind {
  name: string;
  level: number;
  radiation: number;
  xp: number;
  speed: number; // mm/s
  color: number;
}

export interface Hazard {
  x: number;
  y: number;
  r: number;
}

export const SEE_RANGE = 1000;
export const SEE_HALF_ANGLE = 20;
export const DETECT_RANGE = 800;
const CLAW_RANGE = 300;
const ATTACK_RANGE = 250;
const ABSORB_RANGE = 500;
const CHASE_GIVE_UP = 1300;
/** Battery % per second. */
const DRAIN = { idle: 0.05, moving: 0.4, hazard: 2, attackPerLevel: 1.5, standby: 3, base: 6 };
/** Total XP needed to reach level 2, 3, 4, 5. */
const LEVEL_XP = [20, 50, 90, 140];
const XP = { deposit: 5, use: 2 };

interface Enemy {
  kind: EnemyKind;
  obj: SimObject;
  home: { x: number; y: number };
  zone: Zone;
  target: { x: number; y: number };
  chasing: boolean;
}

interface Mineral {
  obj: SimObject;
  zone: Zone;
}

export interface RoverMap {
  w: number;
  h: number;
  base: { x: number; y: number; w: number; h: number };
  zones: Zone[];
  hazards: Hazard[];
  rand: () => number;
  /** Spots minerals and enemies must keep clear of (obstacles, river). */
  blocked: (x: number, y: number, margin: number) => boolean;
  /** Which enemy kinds live in a zone (by zone name). */
  enemiesIn: (zone: Zone) => EnemyKind[];
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Bearing (0 = north, clockwise) from a to b. */
export const bearing = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  ((Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI + 360) % 360;

export class RoverGame {
  battery = 100;
  xp = 0;
  level = 1;
  stored = 0;
  deposited = 0;
  neutralized = 0;
  private enemies: Enemy[] = [];
  private minerals: Mineral[] = [];
  private respawnClock = new Map<Zone, number>();
  private attacked = false;
  private standbyTarget: { pct: number; resolve: () => void } | null = null;

  constructor(
    private world: World,
    private robot: Robot,
    private map: RoverMap,
  ) {
    for (const zone of map.zones) {
      for (let i = 0; i < zone.minerals; i++) this.spawnMineral(zone);
      for (const kind of map.enemiesIn(zone)) this.spawnEnemy(zone, kind);
      this.respawnClock.set(zone, 0);
    }
    world.onStep((dt) => this.step(dt));
  }

  // ------------------------------------------------------------- world

  private randomSpot(zone: Zone, margin: number) {
    for (let i = 0; i < 200; i++) {
      const x = zone.x0 + margin + this.map.rand() * (zone.x1 - zone.x0 - 2 * margin);
      const y = -this.map.h / 2 + margin + this.map.rand() * (this.map.h - 2 * margin);
      const p = { x, y };
      if (this.map.blocked(x, y, margin)) continue;
      if (dist(p, this.map.base) < 1500) continue;
      if (this.minerals.some((m) => dist(World.position(m.obj.body), p) < 400)) continue;
      return p;
    }
    return { x: (zone.x0 + zone.x1) / 2, y: 0 };
  }

  /** Make an object's colliders sensors: game pieces don't push the rover. */
  private ghost(obj: SimObject) {
    for (let i = 0; i < obj.body.numColliders(); i++) obj.body.collider(i).setSensor(true);
    return obj;
  }

  private spawnMineral(zone: Zone) {
    const p = this.randomSpot(zone, 300);
    const obj = this.ghost(
      this.world.add({ shape: { kind: "hex", r: 60, h: 90 }, ...p, color: 0x38e8ff, tag: "mineral", eyeColor: "BLUE" }),
    );
    this.minerals.push({ obj, zone });
    this.world.notifyAdded(obj);
  }

  private spawnEnemy(zone: Zone, kind: EnemyKind) {
    const p = this.randomSpot(zone, 400);
    const serpent = kind.name !== "Alien Spider";
    const obj = this.ghost(
      this.world.add({
        shape: serpent ? { kind: "box", w: 120, d: 360, h: 90 } : { kind: "cylinder", r: 90, h: 70 },
        ...p,
        color: kind.color,
        tag: "enemy",
      }),
    );
    this.enemies.push({ kind, obj, home: p, zone, target: p, chasing: false });
    this.world.notifyAdded(obj);
  }

  private removeMineral(m: Mineral) {
    this.minerals = this.minerals.filter((x) => x !== m);
    this.world.remove(m.obj);
  }

  // -------------------------------------------------------------- step

  private step(dt: number) {
    const rover = this.robot.position;
    const dt_ = this.robot.drivetrain;

    // Enemies wander their zone, chase the rover when it's near, attack up close.
    let attackers = 0;
    for (const e of this.enemies) {
      const p = World.position(e.obj.body);
      const d = dist(p, rover);
      if (d < DETECT_RANGE) e.chasing = true;
      if (d > CHASE_GIVE_UP) e.chasing = false;
      if (e.chasing) e.target = rover;
      else if (dist(p, e.target) < 50) {
        const a = this.map.rand() * Math.PI * 2;
        const r = this.map.rand() * 900;
        e.target = { x: e.home.x + Math.cos(a) * r, y: e.home.y + Math.sin(a) * r };
      }
      const step = Math.min(e.kind.speed * dt, Math.max(0, dist(p, e.target) - (e.chasing ? ATTACK_RANGE * 0.8 : 0)));
      if (step > 0) {
        const h = (bearing(p, e.target) * Math.PI) / 180;
        let x = p.x + Math.sin(h) * step;
        let y = p.y + Math.cos(h) * step;
        // Enemies stay in their own zone.
        x = Math.min(e.zone.x1 - 100, Math.max(e.zone.x0 + 100, x));
        y = Math.min(this.map.h / 2 - 100, Math.max(-this.map.h / 2 + 100, y));
        e.obj.body.setTranslation(toPhysics(x, y, p.z), true);
        e.obj.body.setRotation({ x: 0, y: Math.sin(-h / 2), z: 0, w: Math.cos(-h / 2) }, true);
      }
      if (d < ATTACK_RANGE) attackers += e.kind.level;
    }
    const wasAttacked = this.attacked;
    this.attacked = attackers > 0;
    if (this.attacked && !wasAttacked) this.robot.onEvent?.("rover.under_attack");

    // Battery.
    const inBase = this.inBase(rover);
    let delta = -(dt_.is_moving() ? DRAIN.moving : DRAIN.idle);
    if (this.map.hazards.some((hz) => dist(hz, rover) < hz.r)) delta -= DRAIN.hazard;
    delta -= attackers * DRAIN.attackPerLevel;
    if (this.standbyTarget) delta += DRAIN.standby;
    if (inBase && !dt_.is_moving()) delta += DRAIN.base;
    this.battery = Math.max(0, Math.min(100, this.battery + delta * dt));
    dt_.disabled = this.battery <= 0 || this.standbyTarget !== null;
    if (this.standbyTarget && this.battery >= this.standbyTarget.pct) {
      const { resolve } = this.standbyTarget;
      this.standbyTarget = null;
      dt_.disabled = this.battery <= 0;
      resolve();
    }

    // Minerals regrow in the far zones.
    for (const zone of this.map.zones) {
      if (!zone.respawn) continue;
      const have = this.minerals.filter((m) => m.zone === zone).length;
      if (have >= zone.minerals) {
        this.respawnClock.set(zone, 0);
        continue;
      }
      const t = this.respawnClock.get(zone)! + dt;
      this.respawnClock.set(zone, t);
      if (t >= zone.respawn) {
        this.respawnClock.set(zone, 0);
        this.spawnMineral(zone);
      }
    }
  }

  private inBase(p: { x: number; y: number }) {
    const b = this.map.base;
    return Math.abs(p.x - b.x) <= b.w / 2 && Math.abs(p.y - b.y) <= b.h / 2;
  }

  private gainXp(n: number) {
    this.xp += n;
    while (this.level <= LEVEL_XP.length && this.xp >= LEVEL_XP[this.level - 1]) {
      this.level++;
      this.robot.onEvent?.("rover.level_up");
    }
  }

  // ------------------------------------------------------------ queries

  private nearestMineral(range: number) {
    const p = this.robot.position;
    let best: Mineral | null = null;
    for (const m of this.minerals) {
      const d = dist(World.position(m.obj.body), p);
      if (d <= range && (!best || d < dist(World.position(best.obj.body), p))) best = m;
    }
    return best;
  }

  private nearestEnemy(range: number) {
    const p = this.robot.position;
    let best: Enemy | null = null;
    for (const e of this.enemies) {
      const d = dist(World.position(e.obj.body), p);
      if (d <= range && (!best || d < dist(World.position(best.obj.body), p))) best = e;
    }
    return best;
  }

  /** Positions (and sizes) of everything of one kind on the map. */
  private things(thing: Thing): { x: number; y: number; r: number }[] {
    const r = (o: SimObject) => (o.shape.kind === "box" ? Math.max(o.shape.w, o.shape.d) / 2 : o.shape.r);
    switch (thing) {
      case "BASE":
        return [{ ...this.map.base, r: 0 }];
      case "MINERALS":
        return this.minerals.map((m) => ({ ...World.position(m.obj.body), r: 0 }));
      case "ENEMY":
        return this.enemies.map((e) => ({ ...World.position(e.obj.body), r: 0 }));
      case "HAZARD":
        return this.map.hazards;
      case "OBSTACLE":
        return this.world.objects.filter((o) => o.tag === "obstacle").map((o) => ({ ...World.position(o.body), r: r(o) }));
    }
  }

  private visible(t: { x: number; y: number; r: number }) {
    const p = this.robot.position;
    const d = dist(t, p) - t.r;
    let off = Math.abs(bearing(p, t) - this.robot.heading) % 360;
    if (off > 180) off = 360 - off;
    return d <= SEE_RANGE && off <= SEE_HALF_ANGLE;
  }

  /** The thing the other queries report on: base always; others if visible/detected. */
  private target(thing: Thing) {
    const p = this.robot.position;
    const list = this.things(thing);
    if (thing === "BASE") return list[0];
    const candidates = list.filter((t) =>
      thing === "MINERALS" || thing === "ENEMY" ? dist(t, p) <= DETECT_RANGE || this.visible(t) : this.visible(t),
    );
    candidates.sort((a, b) => dist(a, p) - a.r - (dist(b, p) - b.r));
    return candidates[0] ?? null;
  }

  // ------------------------------------------- Python-facing API (rover.*)

  pickup(thing: string) {
    if (thing !== "MINERALS" || this.stored >= this.storage_capacity()) return;
    const m = this.nearestMineral(CLAW_RANGE);
    if (!m) return;
    this.removeMineral(m);
    this.stored++;
  }

  drop(thing: string) {
    if (thing !== "MINERALS" || this.stored === 0) return;
    if (this.inBase(this.robot.position)) {
      this.gainXp(this.stored * XP.deposit);
      this.deposited += this.stored;
      this.stored = 0;
      return;
    }
    this.stored--;
    const p = this.robot.position;
    const h = (this.robot.heading * Math.PI) / 180;
    const zone = this.map.zones.find((z) => p.x >= z.x0 && p.x < z.x1) ?? this.map.zones[0];
    const obj = this.ghost(
      this.world.add({
        shape: { kind: "hex", r: 60, h: 90 },
        x: p.x + Math.sin(h) * 200,
        y: p.y + Math.cos(h) * 200,
        color: 0x38e8ff,
        tag: "mineral",
        eyeColor: "BLUE",
      }),
    );
    this.minerals.push({ obj, zone });
    this.world.notifyAdded(obj);
  }

  use(thing: string) {
    if (thing !== "MINERALS") return;
    const m = this.nearestMineral(CLAW_RANGE);
    if (!m) return;
    this.removeMineral(m);
    this.battery = 100;
    this.gainXp(XP.use);
  }

  absorb_radiation(thing: string) {
    if (thing !== "ENEMY") return;
    const e = this.nearestEnemy(ABSORB_RANGE);
    if (!e || e.kind.level > this.level) return;
    this.enemies = this.enemies.filter((x) => x !== e);
    this.world.remove(e.obj);
    this.battery = Math.min(100, this.battery + e.kind.radiation / 4);
    this.neutralized++;
    this.gainXp(e.kind.xp);
    // A replacement shows up somewhere else in the same zone.
    this.spawnEnemy(e.zone, e.kind);
  }

  /** Resolves when the battery has recharged to `pct` (the rover can't move meanwhile). */
  standby(pct: number) {
    if (this.battery >= pct) return Promise.resolve();
    this.standbyTarget?.resolve();
    return new Promise<void>((resolve) => (this.standbyTarget = { pct: Math.min(100, pct), resolve }));
  }

  angle(thing: string) {
    const t = this.target(thing as Thing);
    return t ? Math.round(bearing(this.robot.position, t) * 100) / 100 : 0;
  }

  get_distance(thing: string) {
    const t = this.target(thing as Thing);
    if (!t) return SEE_RANGE;
    return Math.max(0, Math.round(dist(t, this.robot.position) - t.r));
  }

  location(thing: string, axis: string) {
    const t = this.target(thing as Thing);
    if (!t) return 0;
    return Math.round(axis === "Y" ? t.y : t.x);
  }

  battery_level() {
    return Math.round(this.battery);
  }

  minerals_stored() {
    return this.stored;
  }

  storage_capacity() {
    return 1 + this.level;
  }

  current_level() {
    return this.level;
  }

  exp() {
    return this.xp;
  }

  enemy_level() {
    return this.nearestEnemy(DETECT_RANGE)?.kind.level ?? 0;
  }

  enemy_radiation() {
    return this.nearestEnemy(DETECT_RANGE)?.kind.radiation ?? 0;
  }

  detects(thing: string) {
    if (thing === "MINERALS") return this.nearestMineral(DETECT_RANGE) !== null;
    if (thing === "ENEMY") return this.nearestEnemy(DETECT_RANGE) !== null;
    return false;
  }

  sees(thing: string) {
    return this.things(thing as Thing).some((t) => this.visible(t));
  }

  under_attack() {
    return this.attacked;
  }

  /** drivetrain.turn_to / drive_to / go_to: face and/or drive to a thing. */
  async approach(thing: string, turn: boolean, drive: boolean) {
    const t = this.target(thing as Thing);
    if (!t) return;
    const dt = this.robot.drivetrain;
    const p = this.robot.position;
    if (turn) await dt.turn_to_heading(bearing(p, t));
    if (drive) {
      // Stop where the claw can reach minerals, or just short of enemies.
      const stop = thing === "MINERALS" ? 200 : thing === "ENEMY" ? 350 : 0;
      await dt.drive_for("FORWARD", Math.max(0, dist(this.robot.position, t) - stop));
    }
  }

  get status() {
    const next = LEVEL_XP[this.level - 1];
    const xp = next ? `XP ${this.xp}/${next}` : `XP ${this.xp}`;
    const zone = this.map.zones.find((z) => this.robot.position.x < z.x1)?.name ?? "";
    const battery = this.battery <= 0 ? "Battery empty!" : `Battery ${Math.ceil(this.battery)}%`;
    return `Zone ${zone} · Level ${this.level} · ${xp} · ${battery} · Minerals ${this.stored}/${this.storage_capacity()}`;
  }
}
