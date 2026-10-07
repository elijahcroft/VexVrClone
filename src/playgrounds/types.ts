import type { FloorPainter } from "../render/floor";
import type { EyeColor } from "../sim/devices";
import type { Robot, RobotKind, RobotStart } from "../sim/robot";
import type { SimSession } from "../sim/session";
import type { World } from "../sim/world";

/**
 * A playground. `L` is its layout: anything decided once per reset (a random
 * maze, castle positions) that floor painting, objects and scoring share.
 */
export interface PlaygroundDef<L = void> {
  id: string;
  name: string;
  description: string;
  /** Field size in mm. */
  size: { w: number; h: number };
  start: RobotStart;
  /** Which robot (default: the standard VR Robot). */
  robot?: RobotKind;
  /** Selectable starting positions or levels ("State Select"). */
  starts?: { label: string; pose: RobotStart }[];
  /** Scene look: underwater (blue haze, sand) or an island in water. */
  theme?: "underwater" | "island";
  /** Show a top-down minimap in the corner of the playground. */
  minimap?: boolean;
  /** Extra buttons in the playground window (e.g. "Download Canvas"). */
  tools?: PlaygroundTool[];
  /** Low walls around the field (default true). */
  border?: boolean;
  /** The field is a table (square, or a hexagon as wide as the field):
   * things pushed off the edge fall (no border). */
  raised?: boolean | "hex";
  /** Decide this reset's layout; `start` is the chosen start/level index. */
  generate?(start: number): L;
  /** Robot start that depends on the layout (e.g. a custom maze's start cell). */
  startFor?(layout: L): RobotStart;
  paintFloor(p: FloorPainter, layout: L): void;
  /** Add walls and objects. */
  build?(world: World, layout: L): void;
  /** What the eye sensor reads at a spot, if not the painted color. */
  colorAt?(x: number, y: number, layout: L): EyeColor | null;
  /** Goal progress shown over the playground, e.g. "Disks sorted: 3 / 9". */
  status?(world: World, robot: Robot, layout: L): string | null;
  /** Runs once the robot exists (e.g. to attach playground devices). */
  setup?(world: World, robot: Robot, layout: L): void;
  /** Game rules that run every physics step (battery drain, scoring). */
  onStep?(world: World, robot: Robot, layout: L, dt: number): void;
}

export interface PlaygroundTool {
  label: string;
  /** `reset` reloads the playground (e.g. after changing its layout). */
  run(session: SimSession, reset: () => void): void | Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPlayground = PlaygroundDef<any>;
