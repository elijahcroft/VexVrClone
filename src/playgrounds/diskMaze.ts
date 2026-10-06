import { COLOR, robotIn, type ColorName } from "./helpers";
import type { PlaygroundDef } from "./types";

/** Turn points along the track and the marker telling the robot what to do. */
const TRACK: { x: number; y: number; marker: ColorName }[] = [
  { x: -562, y: -350, marker: "RED" }, // red: turn right
  { x: 350, y: -350, marker: "BLUE" }, // blue: turn left
  { x: 350, y: 250, marker: "BLUE" },
  { x: -450, y: 250, marker: "RED" },
  { x: -450, y: 780, marker: "GREEN" }, // green: you made it
];
const START = { x: -562, y: -907, heading: 0 };
const MARKER = 160;

export const diskMaze: PlaygroundDef = {
  id: "disk-maze",
  name: "Disk Maze",
  description: "Follow the track: red means turn right, blue means turn left, green is the goal.",
  size: { w: 2000, h: 2000 },
  start: START,
  paintFloor(p) {
    p.fill("#f4f2ee");
    const pts = [START, ...TRACK];
    for (let i = 0; i < pts.length - 1; i++) p.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 230, "#d7dbe2");
    for (const t of TRACK) p.circle(t.x, t.y, MARKER / 2, COLOR[t.marker].css);
    p.rect(650, -820, 560, 250, "#ffffff");
    p.text("red: turn right", 650, -740, 40, COLOR.RED.css);
    p.text("blue: turn left", 650, -820, 40, COLOR.BLUE.css);
    p.text("green: goal", 650, -900, 40, COLOR.GREEN.css);
  },
  status(_w, robot) {
    const goal = TRACK[TRACK.length - 1];
    return robotIn(robot, goal.x, goal.y, MARKER, MARKER) ? "Goal reached!" : null;
  },
};
