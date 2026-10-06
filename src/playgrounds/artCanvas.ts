import type { FloorPainter } from "../render/floor";
import type { PlaygroundDef } from "./types";

function canvasFloor(p: FloorPainter) {
  p.fill("#ffffff");
  for (let x = -900; x <= 900; x += 100) {
    for (let y = -900; y <= 900; y += 100) p.circle(x, y, 3, "#d5d9e0");
  }
}

export const artCanvas: PlaygroundDef = {
  id: "art-canvas",
  name: "Art Canvas",
  description: "A blank canvas: draw with the pen in different colors and widths.",
  size: { w: 2000, h: 2000 },
  start: { x: 0, y: 0, heading: 0 },
  paintFloor: canvasFloor,
};

const OUTLINE = "#b7bec9";

/** Regular polygon points, starting at (x, y) heading `heading`, turning right. */
function polygon(x: number, y: number, heading: number, sides: number, side: number) {
  const pts = [{ x, y }];
  let h = heading;
  for (let i = 0; i < sides; i++) {
    const r = (h * Math.PI) / 180;
    x += Math.sin(r) * side;
    y += Math.cos(r) * side;
    pts.push({ x, y });
    h += 360 / sides;
  }
  return pts;
}

const SHAPES = {
  square: { start: { x: -700, y: 250, heading: 0 }, sides: 4, side: 450 },
  triangle: { start: { x: 250, y: 300, heading: 30 }, sides: 3, side: 500 },
  hexagon: { start: { x: 350, y: -750, heading: 0 }, sides: 6, side: 250 },
};
const CIRCLE = { cx: -480, cy: -450, r: 280 };

export const shapeTracer: PlaygroundDef = {
  id: "shape-tracer",
  name: "Shape Tracer",
  description: "Trace the outlined shapes with the pen. Pick a start next to each shape.",
  size: { w: 2000, h: 2000 },
  start: SHAPES.square.start,
  starts: [
    { label: "Square", pose: SHAPES.square.start },
    { label: "Triangle", pose: SHAPES.triangle.start },
    { label: "Circle", pose: { x: CIRCLE.cx - CIRCLE.r, y: CIRCLE.cy, heading: 0 } },
    { label: "Hexagon", pose: SHAPES.hexagon.start },
  ],
  paintFloor(p) {
    canvasFloor(p);
    for (const s of Object.values(SHAPES)) {
      const pts = polygon(s.start.x, s.start.y, s.start.heading, s.sides, s.side);
      for (let i = 0; i < s.sides; i++) p.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 12, OUTLINE);
      p.circle(s.start.x, s.start.y, 22, "#22a55a");
    }
    p.circle(CIRCLE.cx, CIRCLE.cy, CIRCLE.r, OUTLINE, 12);
    p.circle(CIRCLE.cx - CIRCLE.r, CIRCLE.cy, 22, "#22a55a");
  },
};
