/**
 * Draws playground floor art in field coordinates (mm, origin at the center,
 * +Y north). The canvas becomes the floor texture and is also what the
 * down-facing eye sensor samples.
 */
export class FloorPainter {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Canvas pixels per mm. */
  readonly scale: number;

  constructor(
    readonly width: number,
    readonly depth: number,
    pixels = 2048,
  ) {
    this.scale = pixels / Math.max(width, depth);
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.round(width * this.scale);
    this.canvas.height = Math.round(depth * this.scale);
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
  }

  px(x: number, y: number): [number, number] {
    return [(x + this.width / 2) * this.scale, (this.depth / 2 - y) * this.scale];
  }

  fill(color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Axis-aligned rectangle centered on (x, y). */
  rect(x: number, y: number, w: number, h: number, color: string) {
    const [px, py] = this.px(x - w / 2, y + h / 2);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(px, py, w * this.scale, h * this.scale);
  }

  line(x1: number, y1: number, x2: number, y2: number, width: number, color: string) {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = width * this.scale;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(...this.px(x1, y1));
    c.lineTo(...this.px(x2, y2));
    c.stroke();
  }

  polygon(points: { x: number; y: number }[], color: string) {
    const c = this.ctx;
    c.beginPath();
    points.forEach((p, i) => (i ? c.lineTo(...this.px(p.x, p.y)) : c.moveTo(...this.px(p.x, p.y))));
    c.closePath();
    c.fillStyle = color;
    c.fill();
  }

  circle(x: number, y: number, r: number, color: string, stroke?: number) {
    const c = this.ctx;
    c.beginPath();
    c.arc(...this.px(x, y), r * this.scale, 0, Math.PI * 2);
    if (stroke) {
      c.strokeStyle = color;
      c.lineWidth = stroke * this.scale;
      c.stroke();
    } else {
      c.fillStyle = color;
      c.fill();
    }
  }

  text(str: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center") {
    const c = this.ctx;
    c.fillStyle = color;
    c.font = `600 ${size * this.scale}px system-ui, sans-serif`;
    c.textAlign = align;
    c.textBaseline = "middle";
    c.fillText(str, ...this.px(x, y));
  }

  /**
   * Paint-bucket fill at a field position: recolors the connected area that
   * matches the color there (a grid square, a drawn shape, or open floor).
   */
  floodFill(x: number, y: number, [r, g, b, a]: [number, number, number, number]) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const [fx, fy] = this.px(x, y).map(Math.floor);
    if (fx < 0 || fy < 0 || fx >= W || fy >= H) return;
    const img = this.ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const s = (fy * W + fx) * 4;
    const seed = [d[s], d[s + 1], d[s + 2]];
    const matches = (i: number) =>
      Math.abs(d[i] - seed[0]) + Math.abs(d[i + 1] - seed[1]) + Math.abs(d[i + 2] - seed[2]) < 60;
    const done = new Uint8Array(W * H);
    const stack = [fx, fy];
    while (stack.length) {
      const py = stack.pop()!;
      let px = stack.pop()!;
      while (px > 0 && !done[py * W + px - 1] && matches((py * W + px - 1) * 4)) px--;
      let above = false;
      let below = false;
      for (; px < W; px++) {
        const k = py * W + px;
        if (done[k] || !matches(k * 4)) break;
        done[k] = 1;
        const i = k * 4;
        d[i] = d[i] * (1 - a) + r * a;
        d[i + 1] = d[i + 1] * (1 - a) + g * a;
        d[i + 2] = d[i + 2] * (1 - a) + b * a;
        for (const [ny, flag] of [[py - 1, "above"], [py + 1, "below"]] as const) {
          if (ny < 0 || ny >= H) continue;
          const nk = ny * W + px;
          const open = !done[nk] && matches(nk * 4);
          const seen = flag === "above" ? above : below;
          if (open && !seen) stack.push(px, ny);
          if (flag === "above") above = open;
          else below = open;
        }
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }

  /** RGB at a field position, or null if off the floor. */
  sample(x: number, y: number): [number, number, number] | null {
    const [px, py] = this.px(x, y);
    if (px < 0 || py < 0 || px >= this.canvas.width || py >= this.canvas.height) return null;
    const d = this.ctx.getImageData(Math.floor(px), Math.floor(py), 1, 1).data;
    return [d[0], d[1], d[2]];
  }
}
