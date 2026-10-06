import { beforeAll, describe, expect, it } from "vitest";
import { World } from "../../src/sim/world";
import { Robot, ROBOT_SIZE, type RobotStart } from "../../src/sim/robot";

beforeAll(() => World.init());

function setup(start: RobotStart = { x: 0, y: 0, heading: 0 }) {
  const world = new World();
  world.addFloor(2000, 2000);
  world.addBorder(2000, 2000);
  const robot = new Robot(world, start);
  for (let i = 0; i < 30; i++) world.step(); // settle onto the floor
  return { world, robot };
}

/** Step the world until `p` resolves; returns simulated seconds taken. */
async function until(world: World, p: Promise<void>, maxSteps = 6000) {
  let done = false;
  p.then(() => (done = true));
  const t0 = world.time;
  for (let i = 0; i < maxSteps && !done; i++) {
    world.step();
    await Promise.resolve();
  }
  expect(done).toBe(true);
  return world.time - t0;
}

describe("drivetrain", () => {
  it("drive_for lands within 1 mm", async () => {
    const { world, robot } = setup();
    await until(world, robot.drivetrain.drive_for("FORWARD", 200));
    expect(robot.position.y).toBeCloseTo(200, 0);
    expect(Math.abs(robot.position.x)).toBeLessThan(1);
    await until(world, robot.drivetrain.drive_for("REVERSE", 350));
    expect(robot.position.y).toBeCloseTo(-150, 0);
  });

  it("turn_for lands within half a degree and keeps position", async () => {
    const { world, robot } = setup();
    await until(world, robot.drivetrain.turn_for("RIGHT", 90));
    expect(robot.drivetrain.heading()).toBeCloseTo(90, 0);
    expect(robot.drivetrain.rotation()).toBeCloseTo(90, 0);
    expect(Math.hypot(robot.position.x, robot.position.y)).toBeLessThan(1);
    // Now driving forward goes east.
    await until(world, robot.drivetrain.drive_for("FORWARD", 300));
    expect(robot.position.x).toBeCloseTo(300, 0);
    expect(Math.abs(robot.position.y)).toBeLessThan(1);
  });

  it("turn_to_heading takes the short way; rotation is unwrapped", async () => {
    const { world, robot } = setup();
    await until(world, robot.drivetrain.turn_to_heading(270));
    expect(robot.drivetrain.heading()).toBeCloseTo(270, 0);
    expect(robot.drivetrain.rotation()).toBeCloseTo(-90, 0);
    await until(world, robot.drivetrain.turn_to_rotation(360));
    expect(robot.drivetrain.rotation()).toBeCloseTo(360, 0);
    expect(robot.drivetrain.heading()).toBeCloseTo(0, 0);
  });

  it("a wall stops the robot but drive_for still finishes", async () => {
    const { world, robot } = setup({ x: 0, y: 700, heading: 0 });
    await until(world, robot.drivetrain.drive_for("FORWARD", 1000));
    const wallInside = 1000;
    expect(robot.position.y).toBeLessThan(wallInside - ROBOT_SIZE.radius + 2);
    expect(robot.position.y).toBeGreaterThan(wallInside - ROBOT_SIZE.radius - 5);
  });

  it("can turn in place next to a wall without losing the turn", async () => {
    const { world, robot } = setup({ x: -900, y: -900, heading: 0 });
    for (let i = 0; i < 4; i++) await until(world, robot.drivetrain.turn_for("RIGHT", 90));
    expect(robot.drivetrain.rotation()).toBeCloseTo(360, 0);
    expect(robot.position.x).toBeCloseTo(-900, 0);
    expect(robot.position.y).toBeCloseTo(-900, 0);
  });

  it("velocity changes speed; timeout cuts a move short", async () => {
    const { world, robot } = setup();
    robot.drivetrain.set_drive_velocity(100);
    const t = await until(world, robot.drivetrain.drive_for("FORWARD", 500));
    expect(t).toBeCloseTo(1, 1); // 500 mm/s at 100%

    robot.drivetrain.set_timeout(0.5);
    await until(world, robot.drivetrain.drive_for("REVERSE", 2000));
    expect(robot.position.y).toBeCloseTo(500 - 250, -1);
  });

  it("a new command replaces a running one", async () => {
    const { world, robot } = setup();
    const first = robot.drivetrain.drive_for("FORWARD", 1000);
    for (let i = 0; i < 10; i++) world.step();
    const second = robot.drivetrain.stop();
    await first; // resolved by the interruption
    expect(second).toBeUndefined();
    expect(robot.drivetrain.is_moving()).toBe(false);
  });
});
