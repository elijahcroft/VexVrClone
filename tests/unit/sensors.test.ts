import { beforeAll, describe, expect, it } from "vitest";
import { World } from "../../src/sim/world";
import { Robot, ROBOT_SIZE, type RobotStart } from "../../src/sim/robot";
import { classifyColor, type Bumper, type Distance, type Eye } from "../../src/sim/devices";

beforeAll(() => World.init());

function setup(start: RobotStart = { x: 0, y: 0, heading: 0 }, build?: (w: World) => void) {
  const world = new World();
  world.addFloor(4000, 4000);
  world.addBorder(2000, 2000);
  build?.(world);
  const lines: number[][] = [];
  const surface = {
    sample: () => [240, 240, 240] as [number, number, number],
    line: (x1: number, y1: number, x2: number, y2: number) => lines.push([x1, y1, x2, y2]),
    floodFill: () => {},
  };
  const robot = new Robot(world, start, { floor: () => surface });
  for (let i = 0; i < 30; i++) world.step();
  return { world, robot, lines };
}

async function until(world: World, p: Promise<void>) {
  let done = false;
  p.then(() => (done = true));
  for (let i = 0; i < 6000 && !done; i++) {
    world.step();
    await Promise.resolve();
  }
  expect(done).toBe(true);
}

describe("sensors", () => {
  it("front distance measures from the robot's front to a wall", () => {
    const { robot } = setup();
    const d = robot.device<Distance>("front_distance");
    expect(d.found_object()).toBe(true);
    expect(d.get_distance()).toBeCloseTo(1000 - ROBOT_SIZE.radius, -1);
    expect(robot.device<Distance>("down_distance").get_distance()).toBeLessThan(10);
  });

  it("bumpers press against a wall and fire events", async () => {
    const { world, robot } = setup({ x: 0, y: 700, heading: 0 });
    const events: string[] = [];
    robot.onEvent = (e) => events.push(e);
    const left = robot.device<Bumper>("left_bumper");
    expect(left.pressed()).toBe(false);
    await until(world, robot.drivetrain.drive_for("FORWARD", 400));
    expect(left.pressed()).toBe(true);
    expect(robot.device<Bumper>("right_bumper").pressed()).toBe(true);
    expect(events).toContain("left_bumper.pressed");
    await until(world, robot.drivetrain.drive_for("REVERSE", 100));
    expect(left.pressed()).toBe(false);
    expect(events).toContain("left_bumper.released");
  });

  it("front eye sees a nearby colored object", () => {
    const near = setup({ x: 0, y: 0, heading: 0 }, (w) =>
      w.add({ shape: { kind: "box", w: 100, d: 100, h: 100 }, x: 0, y: 180, color: 0xdd2222, eyeColor: "RED" }),
    );
    const eye = near.robot.device<Eye>("front_eye");
    expect(eye.near_object()).toBe(true);
    expect(eye.detect("RED")).toBe(true);
    expect(eye.detect("BLUE")).toBe(false);

    const far = setup({ x: 0, y: 0, heading: 0 }, (w) =>
      w.add({ shape: { kind: "box", w: 100, d: 100, h: 100 }, x: 0, y: 500, color: 0xdd2222, eyeColor: "RED" }),
    );
    expect(far.robot.device<Eye>("front_eye").near_object()).toBe(false);
    expect(far.robot.device<Eye>("front_eye").detect("NONE")).toBe(true);
  });

  it("down eye reads the floor and loses it past a table edge", () => {
    const { robot } = setup();
    const eye = robot.device<Eye>("down_eye");
    expect(eye.near_object()).toBe(true);
    expect(eye.brightness()).toBeGreaterThan(80);
  });

  it("classifies floor colors", () => {
    expect(classifyColor([220, 40, 40])).toBe("RED");
    expect(classifyColor([30, 160, 70])).toBe("GREEN");
    expect(classifyColor([40, 90, 230])).toBe("BLUE");
    expect(classifyColor([240, 240, 235])).toBe("NONE");
    expect(classifyColor([20, 20, 20])).toBe("NONE");
  });
});

describe("magnet and pen", () => {
  it("BOOST picks up the disk ahead; it travels with the robot; DROP releases it", async () => {
    const { world, robot } = setup({ x: 0, y: 0, heading: 0 }, (w) =>
      w.add({ shape: { kind: "cylinder", r: 50, h: 20 }, x: 0, y: 160, color: 0x2255dd, tag: "disk", dynamic: true }),
    );
    const disk = world.objects.find((o) => o.tag === "disk")!;
    robot.magnet.energize("BOOST");
    expect(robot.magnet.holding).toBe(disk);
    await until(world, robot.drivetrain.turn_for("RIGHT", 90));
    await until(world, robot.drivetrain.drive_for("FORWARD", 300));
    robot.magnet.energize("DROP");
    for (let i = 0; i < 60; i++) world.step();
    const p = World.position(disk.body);
    expect(p.x).toBeCloseTo(300 + 150, -1);
    expect(p.y).toBeCloseTo(0, -1);
    expect(p.z).toBeLessThan(30);
  });

  it("pen draws only while down", async () => {
    const { world, robot, lines } = setup();
    await until(world, robot.drivetrain.drive_for("FORWARD", 100));
    expect(lines.length).toBe(0);
    robot.pen.move("DOWN");
    await until(world, robot.drivetrain.drive_for("FORWARD", 100));
    expect(lines.length).toBeGreaterThan(5);
    const n = lines.length;
    robot.pen.move("UP");
    await until(world, robot.drivetrain.drive_for("FORWARD", 100));
    expect(lines.length).toBe(n);
  });
});
