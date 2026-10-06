import { downloadText } from "../ui/files";

/** A saved project: what's in the editor plus which playground it's for. */
export interface Project {
  format: "robocode-sim";
  version: 1;
  name: string;
  mode: "blocks" | "python";
  playground: string;
  blocks?: object;
  python?: string;
}

const KEY = "robocode-sim:project";

export function loadAutosave(): Project | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseProject(raw, "") : null;
  } catch {
    return null;
  }
}

export function autosave(project: Project) {
  try {
    localStorage.setItem(KEY, JSON.stringify(project));
  } catch {
    // Storage full or blocked (private window); the file download still works.
  }
}

/** Parse a project file; plain .py text becomes a Python project. */
export function parseProject(text: string, filename: string): Project | null {
  if (/\.(py|txt)$/i.test(filename)) {
    return {
      format: "robocode-sim",
      version: 1,
      name: filename.replace(/\.[^.]+$/, ""),
      mode: "python",
      playground: "",
      python: text,
    };
  }
  try {
    const p = JSON.parse(text);
    if (p?.format !== "robocode-sim") return null;
    return p as Project;
  } catch {
    return null;
  }
}

export function downloadProject(project: Project) {
  downloadText(JSON.stringify(project, null, 1), `${project.name.trim() || "project"}.rcsim`);
}
