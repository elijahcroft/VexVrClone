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
