import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const example = (path: string) => fileURLToPath(new URL(`../../examples/${path}`, import.meta.url));

/** Open the app fast-forwarded, pick a playground (and start), load a program. */
async function setup(page: Page, playground: string, program: string, start?: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto("/?speed=20");
  await expect(page.locator("#python-status")).toBeHidden();
  await page.click("#select-playground");
  await page.click(`.pg-card:has(b:text-is("${playground}"))`);
  await expect(page.locator("#pw-name")).toHaveText(playground);
  if (start) await page.selectOption("#pw-start", { label: start });
  await page.setInputFiles("#open-file", example(program));
  return errors;
}

/** Click Start and wait until that run has finished without errors. */
async function run(page: Page) {
  const before = await page.evaluate(() => (window as any).rcsim.runner.runCount);
  await page.click("#btn-start");
  await page.waitForFunction(
    (n) => (window as any).rcsim.runner.runCount > n && !(window as any).rcsim.runner.isRunning,
    before,
    { timeout: 600_000, polling: 500 },
  );
  await expect(page.locator("#console-output .err")).toHaveCount(0);
}

const consoleText = (page: Page) => page.locator("#console-output");
const status = (page: Page) => page.locator("#pw-status");

/** Eye-sensor color of the painted floor at a field point. */
const floorColor = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).rcsim.floorColor(x, y), [x, y]);

test.describe.configure({ mode: "parallel", timeout: 600_000 });

test("Number Grid Map: count to square 45", async ({ page }) => {
  await setup(page, "Number Grid Map", "number-grid-map/count.py");
  await run(page);
  await expect(consoleText(page)).toHaveText("I am on square 45");
});

test("Wall Maze: right-hand rule finds the exit", async ({ page }) => {
  await setup(page, "Wall Maze", "wall-maze/right_hand_rule.py");
  await run(page);
  await expect(status(page)).toHaveText("You reached the exit!");
  await expect(consoleText(page)).toHaveText("Found the exit!");
});

test("Dynamic Wall Maze: same program solves a random maze", async ({ page }) => {
  await setup(page, "Dynamic Wall Maze", "wall-maze/right_hand_rule.py");
  await run(page);
  await expect(status(page)).toHaveText("You reached the exit!");
});

test("Castle Crasher: pieces get pushed off, robot stops at the edge", async ({ page }) => {
  await setup(page, "Castle Crasher", "castle-crasher/push_through.py");
  await run(page);
  await expect(consoleText(page)).toHaveText("Stopped at the edge");
  const knocked = Number((await status(page).textContent())!.match(/(\d+) \//)?.[1] ?? 99);
  expect(knocked).toBeGreaterThanOrEqual(5);
  const robotZ = await page.evaluate(() => (window as any).rcsim.session().robot.position.z);
  expect(robotZ).toBeGreaterThan(0); // still on the table
});

test("Shape Tracer: pen traces the square", async ({ page }) => {
  await setup(page, "Shape Tracer", "shape-tracer/square.py", "Square");
  await run(page);
  expect(await floorColor(page, -700, 475)).toBe("BLUE");
  expect(await floorColor(page, -475, 700)).toBe("BLUE");
  expect(await floorColor(page, -475, 475)).toBe("NONE");
});

test("Art Canvas: star drawn in red", async ({ page }) => {
  await setup(page, "Art Canvas", "art-canvas/star.py");
  await run(page);
  expect(await floorColor(page, 0, 0)).toBe("RED");
});

test("Line Detector: lane A colors in order", async ({ page }) => {
  await setup(page, "Line Detector", "line-detector/read_lines.py", "Lane A");
  await run(page);
  await expect(consoleText(page)).toHaveText("['RED', 'GREEN', 'BLUE', 'RED']");
});

test("Disk Maze: color markers lead to the goal", async ({ page }) => {
  await setup(page, "Disk Maze", "disk-maze/follow_colors.py");
  await run(page);
  await expect(status(page)).toHaveText("Goal reached!");
});

test("Disk Mover: every disk sorted with the magnet", async ({ page }) => {
  await setup(page, "Disk Mover", "disk-mover/sort_disks.py");
  await run(page);
  await expect(status(page)).toHaveText("All 9 disks sorted!");
});

test("Encoded Message: decodes ROBOT", async ({ page }) => {
  await setup(page, "Encoded Message", "encoded-message/decode.py");
  await run(page);
  await expect(consoleText(page)).toHaveText("ROBOT");
});

test("Hidden Pixel Art: reads and fills the picture", async ({ page }) => {
  await setup(page, "Hidden Pixel Art", "hidden-pixel-art/reveal.py");
  await run(page);
  await expect(consoleText(page)).toHaveText("40 red pixels");
  expect(await floorColor(page, -100, 100)).toBe("RED"); // a heart pixel
  expect(await floorColor(page, -100, -700)).toBe("GREEN"); // the stem
});

// ------------------------------------------------------------- milestone 3

/** Load an inline Python program as if opened from a .py file. */
async function loadPython(page: Page, code: string) {
  await page.setInputFiles("#open-file", { name: "test.py", mimeType: "text/plain", buffer: Buffer.from(code) });
}

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

test("Coral Reef Cleanup: all trash recycled before the battery dies", async ({ page }) => {
  await setup(page, "Coral Reef Cleanup", "coral-reef-cleanup/collect_trash.py");
  await run(page);
  await expect(consoleText(page)).toHaveText("Reef is clean!");
  await expect(status(page)).toHaveText("All 8 pieces of trash collected!");
});

test("Coral Reef Cleanup: the battery runs out and the robot stops", async ({ page }) => {
  await setup(page, "Coral Reef Cleanup", "coral-reef-cleanup/collect_trash.py");
  await loadPython(page, "while True:\n    drivetrain.drive_for(FORWARD, 300, MM)\n    drivetrain.drive_for(REVERSE, 300, MM)\n");
  await page.click("#btn-start");
  await expect(status(page)).toContainText("Battery empty!", { timeout: 300_000 });
  const y1 = await page.evaluate(() => (window as any).rcsim.session().robot.position.y);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as any).rcsim.session().robot.position.y)).toBeCloseTo(y1, 0);
  await page.click("#btn-stop");
});

test("Castle Crasher+: castles pushed into the water, robot stays dry", async ({ page }) => {
  await setup(page, "Castle Crasher+", "castle-crasher-plus/bulldoze.py");
  await run(page);
  await expect(consoleText(page)).toHaveText("Safe on shore");
  const text = (await status(page).textContent())!;
  expect(text).not.toContain("fell in");
  expect(Number(text.match(/water: ([\d.]+)/)![1])).toBeGreaterThan(2);
});

test("Castle Crasher+ Level 2: the eye sees trees as green", async ({ page }) => {
  await setup(page, "Castle Crasher+", "castle-crasher-plus/bulldoze.py", "Level 2 (trees)");
  await loadPython(
    page,
    "import math\n" +
      "drivetrain.turn_to_heading(math.degrees(math.atan2(500 - 1014, 420 - 50)) % 360, DEGREES)\n" +
      "while not front_eye.near_object():\n    drivetrain.drive_for(FORWARD, 20, MM)\n" +
      "print(front_eye.detect(GREEN))\n",
  );
  await run(page);
  await expect(consoleText(page)).toHaveText("True");
});

test("Wall Maze+: MazeBot side sensors solve the big maze", async ({ page }) => {
  await setup(page, "Wall Maze+", "wall-maze-plus/right_wall.py");
  await expect(page.locator("#pw-minimap")).toBeVisible();
  await run(page);
  await expect(status(page)).toHaveText("You reached the exit!");
  await expect(consoleText(page)).toHaveText("Escaped the big maze!");
});

test("Wall Maze+: edit the maze, then go back to the built-in one", async ({ page }) => {
  await setup(page, "Wall Maze+", "wall-maze-plus/right_wall.py");
  const ahead = () =>
    page.evaluate(() => (window as any).rcsim.session().robot.device("front_distance").get_distance());
  expect(await ahead()).toBeLessThan(3000);
  await page.click("#pw-tools button:text-is('Edit maze')");
  await page.click("[data-act=clear]");
  await page.click("[data-act=save]");
  await expect.poll(ahead).toBe(3000); // nothing ahead but the far outer wall
  await page.click("#pw-tools button:text-is('Built-in maze')");
  await expect.poll(ahead).toBeLessThan(3000);
});

test("Art Canvas+: background image, clear, download", async ({ page }) => {
  await setup(page, "Art Canvas+", "art-canvas/star.py");
  const chooser = page.waitForEvent("filechooser");
  await page.click("#pw-tools button:text-is('Background image')");
  await (await chooser).setFiles(fixture("red.png"));
  await expect.poll(() => floorColor(page, 0, 0)).toBe("RED");
  const download = page.waitForEvent("download");
  await page.click("#pw-tools button:text-is('Download Canvas')");
  expect((await download).suggestedFilename()).toBe("art-canvas.png");
  await page.click("#pw-tools button:text-is('Clear')");
  await expect.poll(() => floorColor(page, 0, 0)).toBe("NONE");
});
