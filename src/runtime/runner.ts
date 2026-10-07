import type { PyodideAPI } from "pyodide";
import type { SimSession } from "../sim/session";
import { dispatchEvent, installRuntime, monitorValues, runProgram, stopProgram, type VrBridge } from "./bridge";

export interface ConsoleSink {
  print(text: string): void;
  newLine(): void;
  clear(): void;
  setColor(color: string): void;
  error(message: string): void;
}

export interface RunnerHost {
  session(): SimSession;
  console: ConsoleSink;
  /** Highlight a block (null clears). */
  highlight(blockId: string | null): void;
  onError(line: number): void;
  onRunningChange(running: boolean): void;
}

/** Resolve on a fresh macrotask so the browser can render in between. */
function makeYield() {
  const channel = new MessageChannel();
  const queue: (() => void)[] = [];
  channel.port1.onmessage = () => queue.shift()?.();
  return () =>
    new Promise<void>((resolve) => {
      queue.push(resolve);
      channel.port2.postMessage(0);
    });
}

/** Loads Python once and runs student programs against the current session. */
export class Runner {
  private py: Promise<PyodideAPI> | null = null;
  private running = false;
  /** Number of runs started (lets tests wait for a run to finish). */
  runCount = 0;
  private stepping = false;
  private stepWaiters: (() => void)[] = [];
  private timerStart = 0;
  private loaded: PyodideAPI | null = null;
  /** monitor_variable / monitor_sensor names for the current program. */
  readonly monitored: { kind: "variable" | "sensor"; name: string }[] = [];
  /** Timer value shown while no program is running. */
  private frozenTimer = 0;

  constructor(private host: RunnerHost) {}

  /** Start loading Python in the background. */
  load() {
    if (!this.py) {
      this.py = (async () => {
        const { loadPyodide } = await import("pyodide");
        const py = await loadPyodide({ indexURL: new URL("pyodide/", document.baseURI).href });
        installRuntime(py, this.bridge());
        this.loaded = py;
        return py;
      })();
    }
    return this.py;
  }

  get isRunning() {
    return this.running;
  }

  get isStepping() {
    return this.stepping;
  }

  /** Brain timer, in seconds; holds its last value between runs. */
  timer() {
    return this.running ? this.host.session().world.time - this.timerStart : this.frozenTimer;
  }

  async start(source: string, step = false) {
    if (this.running) {
      // Start while stepping switches to a normal run.
      if (!step && this.stepping) {
        this.stepping = false;
        this.releaseSteps();
      }
      return;
    }
    const py = await this.load();
    this.running = true;
    this.runCount++;
    this.stepping = step;
    this.monitored.length = 0;
    this.timerStart = this.host.session().world.time;
    this.host.onRunningChange(true);
    const robot = this.host.session().robot;
    robot.onEvent = (event) => dispatchEvent(py, event);
    try {
      await runProgram(py, source);
    } finally {
      robot.onEvent = null;
      this.frozenTimer = this.timer();
      this.running = false;
      this.stepping = false;
      this.releaseSteps();
      this.host.session().robot.drivetrain.stop();
      this.host.highlight(null);
      this.host.onRunningChange(false);
    }
  }

  async stop() {
    if (!this.running) return;
    stopProgram(await this.load());
  }

  /** [name, value] rows for the Monitor panel. */
  monitorRows(): [string, string][] {
    const vars = this.monitored.filter((m) => m.kind === "variable").map((m) => m.name);
    const varValues = this.loaded && vars.length ? monitorValues(this.loaded, vars) : [];
    let v = 0;
    return this.monitored.map((m) =>
      m.kind === "variable" ? [m.name, varValues[v++] ?? ""] : [m.name, this.readSensor(m.name)],
    );
  }

  /** A sensor reading by VEX-style name, e.g. "front_eye.brightness". */
  private readSensor(name: string): string {
    if (name === "brain.timer" || name === "brain.timer_time") return this.timer().toFixed(2);
    const [device, prop = ""] = name.split(".");
    const robot = this.host.session().robot;
    if (device === "location") {
      const p = robot.position;
      return prop.includes("angle") ? robot.heading.toFixed(1) : `${p.x.toFixed(0)}, ${p.y.toFixed(0)}`;
    }
    const api = robot.device<Record<string, unknown>>(device);
    if (!api) return "?";
    const aliases: Record<string, string> = {
      distance: "get_distance",
      color: "color",
      battery: "battery_level",
      level: "current_level",
    };
    const fn = api[aliases[prop] ?? prop];
    if (typeof fn !== "function") return "?";
    let value: unknown;
    try {
      value = (fn as () => unknown).call(api);
    } catch {
      return "?"; // needs an argument (e.g. rover.angle)
    }
    return typeof value === "number" ? String(Math.round(value * 100) / 100) : String(value);
  }

  /** Step: start in step mode, or let the next block run. */
  step(source: string) {
    if (!this.running) {
      void this.start(source, true);
      return;
    }
    this.stepping = true;
    this.stepWaiters.shift()?.();
  }

  private releaseSteps() {
    const waiters = this.stepWaiters;
    this.stepWaiters = [];
    for (const w of waiters) w();
  }

  private bridge(): VrBridge {
    const host = this.host;
    const world = () => host.session().world;
    return {
      now: () => performance.now(),
      yield_frame: makeYield(),
      wait: (s) => world().wait(s),
      highlight: (id) => {
        host.highlight(id);
        if (!this.stepping) return undefined;
        return new Promise<void>((resolve) => this.stepWaiters.push(resolve));
      },
      timer_time: () => world().time - this.timerStart,
      timer_reset: () => {
        this.timerStart = world().time;
      },
      console_print: (t) => host.console.print(t),
      console_new_line: () => host.console.newLine(),
      console_clear: () => host.console.clear(),
      console_set_color: (c) => host.console.setColor(c),
      report_error: (message, line) => {
        host.console.error(message);
        host.onError(line);
      },
      on_program_stopped: () => {
        host.session().robot.drivetrain.stop();
        world().releaseWaiters();
        this.releaseSteps();
      },
      monitor_add: (kind, name) => {
        if (!this.monitored.some((m) => m.kind === kind && m.name === name)) this.monitored.push({ kind, name });
      },
      device_list: () => host.session().robot.deviceList(),
      device: (name) => host.session().robot.devices.get(name)?.api,
    };
  }
}
