import type { CameraMode, SceneView } from "../render/scene";
import { topDown } from "../render/topdown";
import type { SimSession } from "../sim/session";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** The floating playground window: drag, expand, camera, dashboard. */
export function setupPlaygroundWindow(opts: {
  view: SceneView;
  session: () => SimSession;
  timer: () => number;
  onReset: () => void;
  onVisibilityChange: (open: boolean) => void;
}) {
  const win = $("playground-window");
  const title = $("pw-title");
  const dashboard = $("dashboard");

  // Drag by the title bar.
  title.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button") || win.classList.contains("expanded")) return;
    const start = { x: e.clientX, y: e.clientY, left: win.offsetLeft, top: win.offsetTop };
    title.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const parent = win.parentElement!.getBoundingClientRect();
      const left = Math.max(0, Math.min(parent.width - 80, start.left + ev.clientX - start.x));
      const top = Math.max(0, Math.min(parent.height - 40, start.top + ev.clientY - start.y));
      Object.assign(win.style, { left: `${left}px`, top: `${top}px`, right: "auto" });
    };
    const up = () => {
      title.removeEventListener("pointermove", move);
      title.removeEventListener("pointerup", up);
    };
    title.addEventListener("pointermove", move);
    title.addEventListener("pointerup", up);
  });

  $("pw-expand").addEventListener("click", () => win.classList.toggle("expanded"));
  const setOpen = (open: boolean) => {
    win.hidden = !open;
    opts.onVisibilityChange(open);
  };
  $("pw-close").addEventListener("click", () => setOpen(false));
  $("pw-reset").addEventListener("click", opts.onReset);
  $("pw-dashboard").addEventListener("click", () => (dashboard.hidden = !dashboard.hidden));

  const cameraButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-camera]")];
  const showCamera = (mode: CameraMode) => {
    for (const b of cameraButtons) b.classList.toggle("active", b.dataset.camera === mode);
  };
  for (const b of cameraButtons) {
    b.addEventListener("click", () => {
      opts.view.setCamera(b.dataset.camera as CameraMode);
      showCamera(opts.view.cameraMode);
    });
  }

  const minimap = $<HTMLCanvasElement>("pw-minimap");
  const minimapCtx = minimap.getContext("2d")!;
  let minimapBase: HTMLCanvasElement | null = null;
  const tools = $("pw-tools");

  /** Rebuild per-playground extras (minimap, tool buttons) for a new session. */
  function setSession(session: SimSession) {
    minimap.hidden = !session.def.minimap;
    minimapBase = session.def.minimap ? topDown(session.def, session.layout, 360).canvas : null;
    tools.textContent = "";
    for (const tool of session.def.tools ?? []) {
      const b = document.createElement("button");
      b.className = "small-btn";
      b.textContent = tool.label;
      b.addEventListener("click", () => void tool.run(opts.session(), opts.onReset));
      tools.appendChild(b);
    }
  }

  function drawMinimap(session: SimSession) {
    if (!minimapBase) return;
    const { w, h } = session.def.size;
    const W = minimap.width;
    minimapCtx.drawImage(minimapBase, 0, 0, W, W);
    const p = session.robot.position;
    const x = ((p.x + w / 2) / w) * W;
    const y = ((h / 2 - p.y) / h) * W;
    const a = (session.robot.heading * Math.PI) / 180;
    minimapCtx.save();
    minimapCtx.translate(x, y);
    minimapCtx.rotate(a);
    minimapCtx.fillStyle = "#ff8a3d";
    minimapCtx.strokeStyle = "#23263a";
    minimapCtx.lineWidth = 2;
    minimapCtx.beginPath();
    minimapCtx.moveTo(0, -9);
    minimapCtx.lineTo(7, 7);
    minimapCtx.lineTo(-7, 7);
    minimapCtx.closePath();
    minimapCtx.fill();
    minimapCtx.stroke();
    minimapCtx.restore();
  }

  const timerEl = $("pw-timer");
  const statusEl = $("pw-status");
  const fmt = (n: number, digits = 0) => n.toFixed(digits);
  /** Heading for display: 359.97 shows as 0.0, not 360.0. */
  const deg = (n: number) => `${((Math.round(n * 10) / 10) % 360).toFixed(1)}°`;

  /** Refresh text overlays; call once per frame. */
  function update() {
    showCamera(opts.view.cameraMode);
    drawMinimap(opts.session());
    timerEl.textContent = `${opts.timer().toFixed(1)} s`;
    const status = opts.session().status();
    statusEl.hidden = !status;
    if (status && statusEl.textContent !== status) statusEl.textContent = status;
    if (dashboard.hidden) return;
    const robot = opts.session().robot;
    const dt = robot.drivetrain;
    const p = robot.position;
    const rows: [string, string][] = [
      ["Heading", deg(dt.heading())],
      ["Rotation", `${fmt(dt.rotation(), 1)}°`],
      ["Drive velocity", `${dt.velocities.drive}%`],
      ["Turn velocity", `${dt.velocities.turn}%`],
      ["Moving", dt.is_moving() ? "yes" : "no"],
    ];
    const location: [string, string][] = [
      ["X", `${fmt(p.x)} mm`],
      ["Y", `${fmt(p.y)} mm`],
      ["Angle", deg(robot.heading)],
    ];
    type Api = Record<string, () => unknown>;
    const yes = (v: unknown) => (v ? "yes" : "no");
    const sensors: [string, string][] = [];
    for (const [name, { kind, api }] of robot.devices) {
      const d = api as Api;
      const label = name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
      if (kind === "Bumper") sensors.push([label, d.pressed() ? "pressed" : "released"]);
      if (kind === "EyeSensor") {
        sensors.push([label, `${yes(d.near_object())} · ${String(d.color()).toLowerCase()} · ${d.brightness()}%`]);
      }
      if (kind === "Distance") sensors.push([label, d.found_object() ? `${d.get_distance()} mm` : "none"]);
      if (kind === "Electromagnet") sensors.push([label, robot.magnet.holding ? "holding" : "empty"]);
    }
    const section = (name: string, list: [string, string][]) =>
      `<h4>${name}</h4>` + list.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join("");
    dashboard.innerHTML = section("Drivetrain", rows) + section("Location", location) + section("Sensors", sensors);
  }

  return { update, setOpen, setSession, setTitle: (name: string) => ($("pw-name").textContent = name) };
}
