import type { Maze } from "../playgrounds/helpers";

type Mode = "walls" | "start" | "exit";

/**
 * A simple maze editor: click between cells to add/remove walls, or set the
 * start and exit cells. Resolves with the edited maze, or null if cancelled.
 */
export function editMaze(original: Maze): Promise<Maze | null> {
  const maze: Maze = structuredClone(original);
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-box maze-editor">
      <div class="panel-head">
        <span>Edit maze</span>
        <div class="seg" role="group" aria-label="Tool">
          <button data-mode="walls" class="active">Walls</button>
          <button data-mode="start">Start</button>
          <button data-mode="exit">Exit</button>
        </div>
      </div>
      <p class="hint">Click between two squares to add or remove a wall. Use Start / Exit, then click a square.</p>
      <canvas width="640" height="640"></canvas>
      <div class="panel-head">
        <button class="small-btn" data-act="clear">Remove all walls</button>
        <div>
          <button class="small-btn" data-act="cancel">Cancel</button>
          <button class="small-btn primary" data-act="save">Use this maze</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const canvas = modal.querySelector("canvas")!;
  const ctx = canvas.getContext("2d")!;
  const S = canvas.width / maze.cols;
  let mode: Mode = "walls";

  function draw() {
    ctx.fillStyle = "#f6f7f9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cellRect = (c: number, r: number) => [c * S, (maze.rows - 1 - r) * S, S, S] as const;
    ctx.fillStyle = "#22a55a";
    ctx.fillRect(...cellRect(maze.exit.c, maze.exit.r));
    ctx.fillStyle = "#ff8a3d";
    ctx.fillRect(...cellRect(maze.start.c, maze.start.r));
    ctx.strokeStyle = "#e1e4ea";
    ctx.lineWidth = 1;
    for (let i = 0; i <= maze.cols; i++) {
      ctx.beginPath();
      ctx.moveTo(i * S, 0);
      ctx.lineTo(i * S, canvas.height);
      ctx.moveTo(0, i * S);
      ctx.lineTo(canvas.width, i * S);
      ctx.stroke();
    }
    ctx.strokeStyle = "#23263a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    ctx.beginPath();
    for (let c = 0; c < maze.cols; c++) {
      for (let r = 0; r < maze.rows; r++) {
        const top = (maze.rows - 1 - r) * S;
        if (r < maze.rows - 1 && maze.north[c][r]) {
          ctx.moveTo(c * S, top);
          ctx.lineTo((c + 1) * S, top);
        }
        if (c < maze.cols - 1 && maze.east[c][r]) {
          ctx.moveTo((c + 1) * S, top);
          ctx.lineTo((c + 1) * S, top + S);
        }
      }
    }
    ctx.stroke();
  }

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const fx = ((e.clientX - rect.left) / rect.width) * maze.cols;
    const fy = maze.rows - ((e.clientY - rect.top) / rect.height) * maze.rows;
    const c = Math.min(maze.cols - 1, Math.floor(fx));
    const r = Math.min(maze.rows - 1, Math.floor(fy));
    if (mode !== "walls") {
      maze[mode] = { c, r };
      draw();
      return;
    }
    const dx = Math.abs(fx - Math.round(fx));
    const dy = Math.abs(fy - Math.round(fy));
    if (Math.min(dx, dy) > 0.3) return;
    if (dx < dy) {
      const edge = Math.round(fx);
      if (edge > 0 && edge < maze.cols) maze.east[edge - 1][r] = !maze.east[edge - 1][r];
    } else {
      const edge = Math.round(fy);
      if (edge > 0 && edge < maze.rows) maze.north[c][edge - 1] = !maze.north[c][edge - 1];
    }
    draw();
  });

  for (const b of modal.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    b.addEventListener("click", () => {
      mode = b.dataset.mode as Mode;
      modal.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("active", x === b));
    });
  }

  draw();
  return new Promise((resolve) => {
    modal.addEventListener("click", (e) => {
      const act = (e.target as HTMLElement).dataset.act;
      if (act === "clear") {
        for (const col of [...maze.north, ...maze.east]) col.fill(false);
        draw();
      }
      if (act === "cancel" || act === "save") {
        modal.remove();
        resolve(act === "save" ? maze : null);
      }
    });
  });
}
