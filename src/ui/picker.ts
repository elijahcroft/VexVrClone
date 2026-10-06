import { PLAYGROUNDS } from "../playgrounds";
import { FloorPainter } from "../render/floor";
import { World } from "../sim/world";

const $ = (id: string) => document.getElementById(id)!;

/** Playground picker: a card per playground with a floor thumbnail. */
export function setupPicker(current: () => string, onPick: (id: string) => void) {
  const modal = $("picker");
  const grid = $("picker-grid");
  const thumbs = new Map<string, string>();

  function thumbnail(id: string) {
    if (!thumbs.has(id)) {
      const def = PLAYGROUNDS.find((p) => p.id === id)!;
      const painter = new FloorPainter(def.size.w, def.size.h, 320);
      const layout = def.generate?.();
      def.paintFloor(painter, layout);
      // Draw walls and objects from above so mazes and castles show up.
      const world = new World();
      def.build?.(world, layout);
      for (const o of world.objects) {
        if (o.tag === "floor") continue;
        const p = World.position(o.body);
        const color = `#${o.color.toString(16).padStart(6, "0")}`;
        if (o.shape.kind === "box") painter.rect(p.x, p.y, o.shape.w, o.shape.d, color);
        else painter.circle(p.x, p.y, o.shape.r, color);
      }
      world.physics.free();
      thumbs.set(id, painter.canvas.toDataURL());
    }
    return thumbs.get(id)!;
  }

  function open() {
    grid.textContent = "";
    for (const def of PLAYGROUNDS) {
      const card = document.createElement("button");
      card.className = "pg-card" + (def.id === current() ? " current" : "");
      const img = document.createElement("img");
      img.src = thumbnail(def.id);
      img.alt = "";
      const info = document.createElement("div");
      const name = document.createElement("b");
      name.textContent = def.name;
      const desc = document.createElement("small");
      desc.textContent = def.description;
      info.append(name, desc);
      card.append(img, info);
      card.addEventListener("click", () => {
        modal.hidden = true;
        onPick(def.id);
      });
      grid.appendChild(card);
    }
    modal.hidden = false;
  }

  $("picker-close").addEventListener("click", () => (modal.hidden = true));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  });
  return { open };
}
