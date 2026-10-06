import type { FloorPainter } from "../render/floor";
import type { EyeColor } from "../sim/devices";
import type { Robot, RobotStart } from "../sim/robot";
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
  /** Other selectable starting positions. */
  starts?: { label: string; pose: RobotStart }[];
  /** Low walls around the field (default true). */
  border?: boolean;
  /** The field is a table: things pushed off the edge fall (no border). */
  raised?: boolean;
  /** Decide this reset's layout (random variants). */
  generate?(): L;
  paintFloor(p: FloorPainter, layout: L): void;
  /** Add walls and objects. */
  build?(world: World, layout: L): void;
  /** What the eye sensor reads at a spot, if not the painted color. */
  colorAt?(x: number, y: number, layout: L): EyeColor | null;
  /** Goal progress shown over the playground, e.g. "Disks sorted: 3 / 9". */
  status?(world: World, robot: Robot, layout: L): string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPlayground = PlaygroundDef<any>;
