import type { PyodideAPI } from "pyodide";
import type { SimSession } from "../sim/session";
import { installRuntime, runProgram, stopProgram, type VrBridge } from "./bridge";

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
  private stepping = false;
  private stepWaiters: (() => void)[] = [];
  private timerStart = 0;
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
    this.stepping = step;
    this.timerStart = this.host.session().world.time;
    this.host.onRunningChange(true);
    try {
      await runProgram(py, source);
    } finally {
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
      device_list: () => host.session().robot.deviceList(),
      device: (name) => host.session().robot.devices.get(name)?.api,
    };
  }
}
