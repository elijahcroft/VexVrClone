import { beforeAll, describe, expect, it } from "vitest";
import { loadPyodide, type PyodideAPI } from "pyodide";
import { dispatchEvent, installRuntime, runProgram, stopProgram, type VrBridge } from "../../src/runtime/bridge";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A fake robot that logs calls; moves take `moveMs` of real time. */
function mockBridge(moveMs = 5) {
  const log: string[] = [];
  let line = "";
  const output: string[] = [];
  const errors: string[] = [];
  const move = (what: string) => {
    log.push(what);
    return sleep(moveMs);
  };
  const drivetrain = {
    drive_for: (dir: string, mm: number) => move(`drive_for ${dir} ${mm}`),
    turn_for: (dir: string, deg: number) => move(`turn_for ${dir} ${deg}`),
    drive: (dir: string) => log.push(`drive ${dir}`),
    stop: () => log.push("stop"),
    heading: () => 90,
  };
  const bridge: VrBridge = {
    now: () => performance.now(),
    yield_frame: () => sleep(0),
    wait: (s) => sleep(s * 1000),
    highlight: () => undefined,
    timer_time: () => 0,
    timer_reset: () => {},
    console_print: (t) => (line += t),
    console_new_line: () => {
      output.push(line);
      line = "";
    },
    console_clear: () => {},
    console_set_color: () => {},
    report_error: (m) => errors.push(m),
    on_program_stopped: () => log.push("program_stopped"),
    monitor_add: () => {},
    device_list: () => [
      { name: "drivetrain", kind: "Drivetrain" },
      { name: "left_bumper", kind: "Bumper" },
    ],
    device: (name) => (name === "left_bumper" ? { pressed: () => true } : drivetrain),
  };
  return { bridge, log, output, errors };
}

let py: PyodideAPI;
let current: ReturnType<typeof mockBridge>;

beforeAll(async () => {
  py = await loadPyodide();
  // The bridge object is registered once; route calls to the current mock.
  const proxy = new Proxy({} as VrBridge, {
    get: (_, key: string) => (current.bridge as any)[key],
  });
  installRuntime(py, proxy);
});

async function run(source: string, moveMs = 5) {
  current = mockBridge(moveMs);
  await runProgram(py, source);
  return current;
}

describe("python runtime", () => {
  it("runs VEX-style main thread in order", async () => {
    const r = await run(`
def main():
    drivetrain.drive_for(FORWARD, 200, MM)
    drivetrain.turn_for(RIGHT, 90, DEGREES)
    print("heading", drivetrain.heading())

vr_thread(main)
`);
    expect(r.log).toEqual(["drive_for FORWARD 200", "turn_for RIGHT 90"]);
    expect(r.output).toEqual(["heading 90"]);
    expect(r.errors).toEqual([]);
  });

  it("converts inches (the VEX default unit) to mm", async () => {
    const r = await run(`drivetrain.drive_for(FORWARD, 10)`);
    expect(r.log).toEqual(["drive_for FORWARD 254"]);
  });

  it("supports the old template with imports and constructors", async () => {
    const r = await run(`
from vexcode_vr import *
brain = Brain()
drivetrain = Drivetrain("drivetrain", 0)
def main():
    drivetrain.drive_for(FORWARD, 100, MM)
    brain.print("done")
    brain.new_line()
vr_thread(main)
`);
    expect(r.log).toEqual(["drive_for FORWARD 100"]);
    expect(r.output).toEqual(["done"]);
  });

  it("interleaves two threads", async () => {
    const r = await run(`
def a():
    print("a1")
    wait(30, MSEC)
    print("a2")
def b():
    wait(10, MSEC)
    print("b1")
    wait(40, MSEC)
    print("b2")
vr_thread(a)
vr_thread(b)
`);
    expect(r.output).toEqual(["a1", "b1", "a2", "b2"]);
  });

  it("blocks inside user functions, methods and comprehensions", async () => {
    const r = await run(`
def square(n):
    for i in range(4):
        drivetrain.drive_for(FORWARD, n, MM)
        drivetrain.turn_for(RIGHT, 90, DEGREES)
    return n * 4

class Bot:
    def __init__(self, d):
        self.d = d
    def go(self):
        drivetrain.drive_for(FORWARD, self.d, MM)
        return self.d

print(square(10))
print(Bot(7).go())
print([square(1) for _ in range(2)])
print(sum(x * 2 for x in range(5)))
print(sorted([3, 1, 2], key=lambda v: -v))
`);
    expect(r.errors).toEqual([]);
    expect(r.output).toEqual(["40", "7", "[4, 4]", "20", "[3, 2, 1]"]);
    expect(r.log.filter((l) => l.startsWith("drive_for")).length).toBe(4 + 1 + 8);
  });

  it("reports runtime errors with the student's line number", async () => {
    const r = await run(`
def main():
    drivetrain.drive_for(FORWARD, 100, MM)
    print(undefined_name)
vr_thread(main)
`);
    expect(r.errors).toEqual(["Line 4: NameError: name 'undefined_name' is not defined"]);
  });

  it("reports syntax errors with a line number", async () => {
    const r = await run(`x = 1\nif x\n    print(x)\n`);
    expect(r.errors[0]).toMatch(/^Line 2: SyntaxError/);
  });

  it("Event broadcast_and_wait waits for handlers", async () => {
    const r = await run(`
go = Event()
def handler():
    wait(20, MSEC)
    print("handled")
go(handler)
def main():
    go.broadcast_and_wait()
    print("after")
vr_thread(main)
`);
    expect(r.output).toEqual(["handled", "after"]);
  });

  it("stops a busy loop with no waits", async () => {
    current = mockBridge();
    const done = runProgram(py, `
count = 0
while True:
    count += 1
`);
    await sleep(100);
    stopProgram(py);
    await done;
    expect(current.log).toContain("program_stopped");
  });

  it("stops in the middle of a long move", async () => {
    current = mockBridge(60_000);
    const done = runProgram(py, `drivetrain.drive_for(FORWARD, 5000, MM)\nprint("never")`);
    await sleep(50);
    stopProgram(py);
    await done;
    expect(current.output).toEqual([]);
  });

  it("runs event handlers when JS dispatches sensor events", async () => {
    current = mockBridge();
    const done = runProgram(py, `
bumper = Bumper("leftBumper", 2)   # old-style name
def hit():
    print("ouch", bumper.pressed())
left_bumper.pressed(hit)
`);
    await sleep(20);
    dispatchEvent(py, "left_bumper.pressed");
    await sleep(20);
    dispatchEvent(py, "left_bumper.pressed");
    await sleep(20);
    stopProgram(py); // handlers keep a program alive until Stop
    await done;
    expect(current.errors).toEqual([]);
    expect(current.output).toEqual(["ouch True", "ouch True"]);
  });

  it("stop_project() ends the program from inside", async () => {
    const r = await run(`
def main():
    print("one")
    stop_project()
    print("two")
vr_thread(main)
`);
    expect(r.output).toEqual(["one"]);
  });
});
