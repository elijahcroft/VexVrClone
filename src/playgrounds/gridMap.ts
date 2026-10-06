import type { PlaygroundDef } from "./types";

export const gridMap: PlaygroundDef = {
  id: "grid-map",
  name: "Grid Map",
  description: "Practice driving and turning on a 200 mm grid with labeled coordinates.",
  size: { w: 2000, h: 2000 },
  start: { x: -900, y: -900, heading: 0 },
  paintFloor(p) {
    p.fill("#f3f1ec");
    for (let v = -1000; v <= 1000; v += 100) {
      const major = v % 200 === 0;
      const width = major ? 4 : 1.5;
      const color = major ? "#9aa4b1" : "#d3d7dd";
      p.line(v, -1000, v, 1000, width, color);
      p.line(-1000, v, 1000, v, width, color);
    }
    p.line(0, -1000, 0, 1000, 6, "#6b7686");
    p.line(-1000, 0, 1000, 0, 6, "#6b7686");
    for (let v = -800; v <= 800; v += 200) {
      if (v === 0) continue;
      p.text(String(v), v + 4, -40, 40, "#5b6573", "left");
      p.text(String(v), 8, v - 40, 40, "#5b6573", "left");
    }
    p.text("0", 8, -40, 40, "#5b6573", "left");
  },
};
