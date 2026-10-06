import type { PyodideAPI } from "pyodide";
import transformPy from "./transform.py?raw";
import vexcodePy from "./vexcode_vr.py?raw";

/** A device the Python side should create a global for, e.g. drivetrain. */
export interface DeviceInfo {
  name: string;
  kind: string;
}

/**
 * Everything Python's vexcode_vr module can call (imported there as `vrjs`).
 * Units: mm, degrees, seconds. Methods returning Promises block the calling
 * Python thread until they resolve.
 */
export interface VrBridge {
  now(): number;
  yield_frame(): Promise<void>;
  wait(seconds: number): Promise<void>;
  highlight(blockId: string): Promise<void> | undefined;
  timer_time(): number;
  timer_reset(): void;
  console_print(text: string): void;
  console_new_line(): void;
  console_clear(): void;
  console_set_color(color: string): void;
  report_error(message: string, line: number): void;
  on_program_stopped(): void;
  monitor_add(kind: "variable" | "sensor", name: string): void;
  device_list(): DeviceInfo[];
  device(name: string): unknown;
}

/** Load our Python modules into a Pyodide instance and connect the bridge. */
export function installRuntime(py: PyodideAPI, bridge: VrBridge) {
  py.FS.writeFile("/home/pyodide/transform.py", transformPy);
  py.FS.writeFile("/home/pyodide/vexcode_vr.py", vexcodePy);
  py.registerJsModule("vrjs", bridge);
}

/** Run a program; resolves when it finishes or is stopped. */
export async function runProgram(py: PyodideAPI, source: string) {
  const runtime = py.pyimport("vexcode_vr");
  try {
    await runtime.run_program(source);
  } finally {
    runtime.destroy();
  }
}

export function stopProgram(py: PyodideAPI) {
  const runtime = py.pyimport("vexcode_vr");
  runtime.stop_project();
  runtime.destroy();
}

/** Display strings for monitored global variables. */
export function monitorValues(py: PyodideAPI, names: string[]): string[] {
  const runtime = py.pyimport("vexcode_vr");
  const proxy = runtime._vr_monitor_values(names);
  const values = proxy.toJs() as string[];
  proxy.destroy();
  runtime.destroy();
  return values;
}

/** Tell Python a sensor event fired (e.g. "left_bumper.pressed"). */
export function dispatchEvent(py: PyodideAPI, event: string) {
  const runtime = py.pyimport("vexcode_vr");
  runtime._vr_dispatch(event);
  runtime.destroy();
}
