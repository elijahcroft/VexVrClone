import type { CameraMode, SceneView } from "../render/scene";
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

  const timerEl = $("pw-timer");
  const fmt = (n: number, digits = 0) => n.toFixed(digits);
  /** Heading for display: 359.97 shows as 0.0, not 360.0. */
  const deg = (n: number) => `${((Math.round(n * 10) / 10) % 360).toFixed(1)}°`;

  /** Refresh text overlays; call once per frame. */
  function update() {
    showCamera(opts.view.cameraMode);
    timerEl.textContent = `${opts.timer().toFixed(1)} s`;
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
    const section = (name: string, list: [string, string][]) =>
      `<h4>${name}</h4>` + list.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join("");
    dashboard.innerHTML = section("Drivetrain", rows) + section("Location", location);
  }

  return { update, setOpen, setTitle: (name: string) => ($("pw-name").textContent = name) };
}
