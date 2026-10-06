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

  /** RGB at a field position, or null if off the floor. */
  sample(x: number, y: number): [number, number, number] | null {
    const [px, py] = this.px(x, y);
    if (px < 0 || py < 0 || px >= this.canvas.width || py >= this.canvas.height) return null;
    const d = this.ctx.getImageData(Math.floor(px), Math.floor(py), 1, 1).data;
    return [d[0], d[1], d[2]];
  }
}
