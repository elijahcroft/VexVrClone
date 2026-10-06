import { COLOR } from "./helpers";
import type { PlaygroundDef } from "./types";

const MESSAGE = "ROBOT";
const COLUMN_X = (i: number) => -700 + i * 300;
const BIT_Y = (bit: number) => -650 + bit * 200; // bit 0 = first square you reach
const SQUARE = 120;

export const encodedMessage: PlaygroundDef = {
  id: "encoded-message",
  name: "Encoded Message",
  description: "Each column is one letter in binary (blue = 1, white = 0). Read the bits, decode the word.",
  size: { w: 2000, h: 2000 },
  start: { x: -700, y: -900, heading: 0 },
  paintFloor(p) {
    p.fill("#f6f5f2");
    [...MESSAGE].forEach((ch, i) => {
      const bits = ch.charCodeAt(0).toString(2).padStart(8, "0");
      const x = COLUMN_X(i);
      p.line(x, -800, x, 900, 4, "#dfe2e8");
      [...bits].forEach((b, bit) => {
        const y = BIT_Y(bit);
        p.rect(x, y, SQUARE + 8, SQUARE + 8, "#9aa4b1");
        p.rect(x, y, SQUARE, SQUARE, b === "1" ? COLOR.BLUE.css : "#ffffff");
      });
      p.text(`letter ${i + 1}`, x, -790, 34, "#6b7686");
    });
    p.rect(700, 870, 520, 170, "#ffffff");
    p.text("blue = 1   white = 0", 700, 900, 38, "#3d4a5c");
    p.text("first square = highest bit", 700, 840, 30, "#6b7686");
  },
};
