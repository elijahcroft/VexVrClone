import type { AnyPlayground } from "../playgrounds/types";
import { World, hexCorners } from "../sim/world";
import { FloorPainter } from "./floor";

/** A top-down picture of a playground: floor art plus walls and objects. */
export function topDown(def: AnyPlayground, layout: unknown, pixels: number) {
  const painter = new FloorPainter(def.size.w, def.size.h, pixels);
  def.paintFloor(painter, layout);
  const world = new World();
  def.build?.(world, layout);
  for (const o of world.objects) {
    if (o.tag === "floor") continue;
    const p = World.position(o.body);
    const color = `#${o.color.toString(16).padStart(6, "0")}`;
    if (o.shape.kind === "box") painter.rect(p.x, p.y, o.shape.w, o.shape.d, color);
    else if (o.shape.kind === "cylinder") painter.circle(p.x, p.y, o.shape.r, color);
    else painter.polygon(hexCorners(o.shape.r).map((c) => ({ x: p.x + c.x, y: p.y + c.y })), color);
  }
  world.physics.free();
  return painter;
}
