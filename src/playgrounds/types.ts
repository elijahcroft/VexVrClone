import type { FloorPainter } from "../render/floor";
import type { RobotStart } from "../sim/robot";
import type { World } from "../sim/world";

export interface PlaygroundDef {
  id: string;
  name: string;
  description: string;
  /** Field size in mm. */
  size: { w: number; h: number };
  start: RobotStart;
  /** Low walls around the field (default true). */
  border?: boolean;
  paintFloor(p: FloorPainter): void;
  /** Add walls and objects. */
  build?(world: World): void;
}
