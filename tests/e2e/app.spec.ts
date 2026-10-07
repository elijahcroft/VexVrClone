import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const example = (path: string) => fileURLToPath(new URL(`../../examples/${path}`, import.meta.url));

/** Robot state via the test handle in main.ts. */
const robot = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).rcsim.session();
    const p = s.robot.position;
    const dt = s.robot.drivetrain;
    return { x: Math.round(p.x), y: Math.round(p.y), heading: Math.round(dt.heading()) % 360, moving: dt.is_moving() };
  });

async function openApp(page: Page, url = "/") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("dialog", (d) => d.accept());
  await page.goto(url);
  await expect(page.locator("#python-status")).toBeHidden();
  return errors;
}

/** Click Start and wait until that run has finished. */
async function runToEnd(page: Page) {
  const before = await page.evaluate(() => (window as any).rcsim.runner.runCount);
  await page.click("#btn-start");
  await page.waitForFunction(
    (n) => (window as any).rcsim.runner.runCount > n && !(window as any).rcsim.runner.isRunning,
    before,
    { timeout: 600_000, polling: 200 },
  );
}

test("blocks program runs and matches VEX-style Python", async ({ page }) => {
  const errors = await openApp(page);
  await page.setInputFiles("#open-file", fixture("square-blocks.rcsim"));
  await page.click("#code-viewer-tab");
  await expect(page.locator("#code-viewer-text")).toContainText("def when_started_1():");
  await expect(page.locator("#code-viewer-text")).toContainText("drivetrain.drive_for(FORWARD, 400, MM)");
  await expect(page.locator("#code-viewer-text")).toContainText("vr_thread(when_started_1)");
  await runToEnd(page);
  await expect(page.locator("#console-output > div")).toHaveText(["heading:", "180"]);
  expect(await robot(page)).toEqual({ x: -500, y: -500, heading: 180, moving: false });
  expect(errors).toEqual([]);
});

test("grid map example drives a square back home", async ({ page }) => {
  await openApp(page);
  await page.setInputFiles("#open-file", example("grid-map/square.py"));
  await runToEnd(page);
  await expect(page.locator("#console-output")).toHaveText("Back home at -900 -900");
  expect(await robot(page)).toMatchObject({ x: -900, y: -900, heading: 0 });
});

test("python errors show the line and select it", async ({ page }) => {
  await openApp(page);
  await page.setInputFiles("#open-file", {
    name: "oops.py",
    mimeType: "text/plain",
    buffer: Buffer.from('def main():\n    drivetrain.drive_for(FORWARD, 100, MM)\n    print("x =", location_x)\n\nvr_thread(main)\n'),
  });
  await runToEnd(page);
  await expect(page.locator("#console-output")).toHaveText("Line 3: NameError: name 'location_x' is not defined");
  expect(await page.evaluate(() => getSelection()?.toString())).toContain("location_x");
});

test("stop ends a busy loop and stops the robot", async ({ page }) => {
  await openApp(page);
  await page.setInputFiles("#open-file", {
    name: "loop.py",
    mimeType: "text/plain",
    buffer: Buffer.from("def main():\n    drivetrain.drive(FORWARD)\n    while True:\n        pass\n\nvr_thread(main)\n"),
  });
  await page.click("#btn-start");
  await expect.poll(async () => (await robot(page)).y).toBeGreaterThan(-800);
  await page.click("#btn-stop");
  await expect(page.locator("#btn-stop")).toBeDisabled();
  const stopped = await robot(page);
  expect(stopped.moving).toBe(false);
  await page.waitForTimeout(500);
  expect((await robot(page)).y).toBe(stopped.y);
});

test("step runs one block per press, start finishes", async ({ page }) => {
  await openApp(page);
  await page.setInputFiles("#open-file", fixture("step-blocks.rcsim"));
  await page.click("#btn-step"); // paused before "drive"
  await page.waitForTimeout(500);
  expect(await robot(page)).toMatchObject({ x: -900, y: -900, moving: false });
  await page.click("#btn-step"); // drive runs, paused before "turn"
  await expect.poll(async () => (await robot(page)).y).toBe(-500);
  await page.waitForTimeout(500);
  expect((await robot(page)).heading).toBe(0);
  await page.click("#btn-start"); // run the rest
  await expect(page.locator("#btn-stop")).toBeDisabled();
  expect(await robot(page)).toMatchObject({ x: -900, y: -500, heading: 90 });
});

test("project autosaves and comes back after reload", async ({ page }) => {
  await openApp(page);
  await page.setInputFiles("#open-file", fixture("square-blocks.rcsim"));
  await page.fill("#project-name", "My saved project");
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator("#python-status")).toBeHidden();
  await expect(page.locator("#project-name")).toHaveValue("My saved project");
  await page.click("#code-viewer-tab");
  await expect(page.locator("#code-viewer-text")).toContainText("drivetrain.drive_for(FORWARD, 400, MM)");
});

test("list blocks generate Python lists", async ({ page }) => {
  await openApp(page);
  await page.setInputFiles("#open-file", fixture("lists-blocks.rcsim"));
  await page.click("#code-viewer-tab");
  await expect(page.locator("#code-viewer-text")).toContainText("my_list = []");
  await expect(page.locator("#code-viewer-text")).toContainText("my_list[0] = 'z'");
  await runToEnd(page);
  await expect(page.locator("#console-output > div")).toHaveText(["z", "2"]);
});

test("bumper event hat fires when the robot hits a wall", async ({ page }) => {
  await openApp(page, "/?speed=8");
  await page.setInputFiles("#open-file", fixture("bumper-blocks.rcsim"));
  await page.click("#code-viewer-tab");
  await expect(page.locator("#code-viewer-text")).toContainText("left_bumper.pressed(onevent_left_bumper_pressed_1)");
  await runToEnd(page);
  await expect(page.locator("#console-output")).toHaveText("bump");
  expect((await robot(page)).y).toBeGreaterThan(850);
});

test("rover blocks generate VEX-style Python and run", async ({ page }) => {
  const errors = await openApp(page);
  await page.setInputFiles("#open-file", fixture("rover-blocks.rcsim"));
  await expect(page.locator("#pw-name")).toHaveText("Rover Rescue");
  await page.click("#code-viewer-tab");
  await expect(page.locator("#code-viewer-text")).toContainText("drivetrain.turn_to(BASE)");
  await expect(page.locator("#code-viewer-text")).toContainText("rover.pickup(MINERALS)");
  await expect(page.locator("#code-viewer-text")).toContainText("rover.get_distance(BASE, MM)");
  await expect(page.locator("#code-viewer-text")).toContainText("rover.on_level_up(onevent_rover_level_up_1)");
  await runToEnd(page);
  await expect(page.locator("#console-output > div")).toHaveText(["1", "0"]);
  expect(errors).toEqual([]);
});
