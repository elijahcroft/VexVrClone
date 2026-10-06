import { artCanvas, artCanvasPlus, shapeTracer } from "./artCanvas";
import { castleCrasher, castleCrasherPlus, dynamicCastleCrasher } from "./castleCrasher";
import { coralReefCleanup } from "./coralReef";
import { diskMaze } from "./diskMaze";
import { diskMover, diskTransport } from "./disks";
import { encodedMessage } from "./encodedMessage";
import { gridMap } from "./gridMap";
import { hiddenPixelArt } from "./hiddenPixelArt";
import { lineDetector } from "./lineDetector";
import { numberGridMap } from "./numberGridMap";
import type { AnyPlayground } from "./types";
import { dynamicWallMaze, wallMaze, wallMazePlus } from "./wallMaze";

export const PLAYGROUNDS: AnyPlayground[] = [
  gridMap,
  numberGridMap,
  wallMaze,
  dynamicWallMaze,
  castleCrasher,
  dynamicCastleCrasher,
  artCanvas,
  shapeTracer,
  lineDetector,
  diskMaze,
  diskMover,
  diskTransport,
  encodedMessage,
  hiddenPixelArt,
  coralReefCleanup,
  artCanvasPlus,
  castleCrasherPlus,
  wallMazePlus,
];

export function getPlayground(id: string) {
  return PLAYGROUNDS.find((p) => p.id === id) ?? PLAYGROUNDS[0];
}
