// Copy Pyodide's runtime files into public/ so they're served from our own
// site (school firewalls often block CDNs).
import { copyFileSync, mkdirSync } from "node:fs";

const files = ["pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];
mkdirSync("public/pyodide", { recursive: true });
for (const f of files) copyFileSync(`node_modules/pyodide/${f}`, `public/pyodide/${f}`);
