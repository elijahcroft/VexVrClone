import type { ConsoleSink } from "../runtime/runner";

const COLORS: Record<string, string> = { BLACK: "", RED: "#d62f35", GREEN: "#1f9d55", BLUE: "#2563eb" };

/** The Print Console: brain.print writes at the cursor, new_line moves down. */
export class ConsoleView implements ConsoleSink {
  private line: HTMLDivElement | null = null;
  private color = "";

  constructor(private el: HTMLElement) {}

  private currentLine() {
    if (!this.line) {
      this.line = document.createElement("div");
      this.el.appendChild(this.line);
    }
    return this.line;
  }

  private scroll() {
    this.el.scrollTop = this.el.scrollHeight;
  }

  print(text: string) {
    const span = document.createElement("span");
    span.textContent = text;
    if (this.color) span.style.color = this.color;
    this.currentLine().appendChild(span);
    this.scroll();
  }

  newLine() {
    // An empty row still takes up space, like a blank printed line.
    if (!this.line) this.currentLine().innerHTML = "&nbsp;";
    this.line = null;
  }

  clear() {
    this.el.textContent = "";
    this.line = null;
  }

  setColor(color: string) {
    this.color = COLORS[color] ?? "";
  }

  error(message: string) {
    this.line = null;
    const div = document.createElement("div");
    div.className = "err";
    div.textContent = message;
    this.el.appendChild(div);
    this.scroll();
  }
}
