import type { FloorPainter } from "../render/floor";
import { downloadUrl, pickFile } from "../ui/files";
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

/** Art Canvas+ background picture; kept across resets until cleared. */
let background: ImageBitmap | null = null;

function paintPlus(p: FloorPainter) {
  p.fill("#ffffff");
  if (!background) return;
  // Fit the picture inside the canvas, centered.
  const { width: W, height: H } = p.canvas;
  const s = Math.min(W / background.width, H / background.height);
  const w = background.width * s;
  const h = background.height * s;
  p.ctx.drawImage(background, (W - w) / 2, (H - h) / 2, w, h);
}

export const artCanvasPlus: PlaygroundDef = {
  id: "art-canvas-plus",
  name: "Art Canvas+",
  description: "Art Canvas with your own background picture to trace, and a Download Canvas button.",
  size: { w: 2000, h: 2000 },
  start: { x: 0, y: 0, heading: 0 },
  paintFloor: paintPlus,
  tools: [
    {
      label: "Background image",
      async run(session) {
        const file = await pickFile("image/png,image/jpeg");
        if (!file) return;
        background = await createImageBitmap(file);
        paintPlus(session.floor);
        session.floorDirty = true;
      },
    },
    {
      label: "Download Canvas",
      run(session) {
        downloadUrl(session.floor.canvas.toDataURL("image/png"), "art-canvas.png");
      },
    },
    {
      label: "Clear",
      run(session) {
        background = null;
        paintPlus(session.floor);
        session.floorDirty = true;
      },
    },
  ],
};
