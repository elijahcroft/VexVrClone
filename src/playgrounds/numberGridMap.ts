import type { PlaygroundDef } from "./types";

export const numberGridMap: PlaygroundDef = {
  id: "number-grid-map",
  name: "Number Grid Map",
  description: "Count and navigate across squares numbered 1 to 100.",
  size: { w: 2000, h: 2000 },
  start: { x: -900, y: -900, heading: 0 },
  paintFloor(p) {
    p.fill("#ffffff");
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const x = -900 + c * 200;
        const y = -900 + r * 200;
        p.rect(x, y, 200, 200, (r + c) % 2 ? "#eef3fb" : "#fdf6ea");
        p.text(String(r * 10 + c + 1), x, y, 70, "#3d4a5c");
      }
    }
    for (let v = -1000; v <= 1000; v += 200) {
      p.line(v, -1000, v, 1000, 4, "#9aa4b1");
      p.line(-1000, v, 1000, v, 4, "#9aa4b1");
    }
  },
};
