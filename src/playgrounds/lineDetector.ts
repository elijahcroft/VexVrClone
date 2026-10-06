import { COLOR, type ColorName } from "./helpers";
import type { PlaygroundDef } from "./types";

const LANES: { label: string; x: number; lines: ColorName[] }[] = [
  { label: "A", x: -750, lines: ["RED", "GREEN", "BLUE", "RED"] },
  { label: "B", x: -250, lines: ["BLUE", "BLUE", "GREEN", "RED"] },
  { label: "C", x: 250, lines: ["GREEN", "RED", "RED", "BLUE"] },
  { label: "D", x: 750, lines: ["RED", "BLUE", "GREEN", "GREEN"] },
];
const LINE_Y = [-500, -100, 300, 700];

export const lineDetector: PlaygroundDef = {
  id: "line-detector",
  name: "Line Detector",
  description: "Drive up a lane and use the down eye to report each colored line you cross.",
  size: { w: 2000, h: 2000 },
  start: { x: LANES[0].x, y: -880, heading: 0 },
  starts: LANES.map((l) => ({ label: `Lane ${l.label}`, pose: { x: l.x, y: -880, heading: 0 } })),
  paintFloor(p) {
    p.fill("#f6f5f2");
    for (const lane of LANES) {
      LINE_Y.forEach((y, i) => p.rect(lane.x, y, 420, 50, COLOR[lane.lines[i]].css));
      p.text(lane.label, lane.x, -980 + 40, 50, "#6b7686");
    }
    for (const x of [-500, 0, 500]) p.line(x, -1000, x, 1000, 6, "#d9dce2");
  },
};
