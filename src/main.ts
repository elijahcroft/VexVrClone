import "./style.css";
import * as Blockly from "blockly/core";
import { DEFAULT_BLOCKS, createBlocksEditor, loadBlocks, saveBlocks } from "./editor/blocksEditor";
import { generatePython } from "./editor/generate";
import { DEFAULT_PYTHON, createPythonEditor, selectLine, setPythonCode } from "./editor/pythonEditor";
import { getPlayground } from "./playgrounds";
import { autosave, downloadProject, loadAutosave, parseProject, type Project } from "./project/storage";
import { SceneView } from "./render/scene";
import { Runner } from "./runtime/runner";
import { SimSession } from "./sim/session";
import { World } from "./sim/world";
import { ConsoleView } from "./ui/console";
import { setupPicker } from "./ui/picker";
import { setupPlaygroundWindow } from "./ui/playgroundWindow";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

async function main() {
  await World.init();

  const state = { mode: "blocks" as Project["mode"], playground: "grid-map" };
  const nameInput = $<HTMLInputElement>("project-name");

  // ---------------------------------------------------------------- editors
  const ws = createBlocksEditor($("blockly"));
  const pyEditor = createPythonEditor($("python-editor"), () => scheduleSave());
  const codeViewer = $("code-viewer");
  const codeViewerText = $("code-viewer-text");

  function refreshCodeViewer() {
    if (!codeViewer.hidden) codeViewerText.textContent = generatePython(ws, false);
  }

  ws.addChangeListener((e) => {
    if (e.isUiEvent) return;
    scheduleSave();
    refreshCodeViewer();
  });

  function setMode(mode: Project["mode"]) {
    state.mode = mode;
    const blocks = mode === "blocks";
    $("blockly").hidden = !blocks;
    $("python-editor").hidden = blocks;
    $("code-viewer-tab").hidden = !blocks;
    $("btn-step").hidden = !blocks;
    if (!blocks) codeViewer.hidden = true;
    $("mode-badge").textContent = blocks ? "Blocks" : "Python";
    if (blocks) Blockly.svgResize(ws);
  }

  $("code-viewer-tab").addEventListener("click", () => {
    codeViewer.hidden = !codeViewer.hidden;
    refreshCodeViewer();
  });
  $("copy-to-python").addEventListener("click", () => {
    const code = generatePython(ws, false);
    if (!confirm("Start a new Python project with this code? Your blocks stay saved in the file you downloaded, if any.")) return;
    setPythonCode(pyEditor, code);
    setMode("python");
    scheduleSave();
  });

  // ------------------------------------------------------------- simulator
  let session = new SimSession(getPlayground(state.playground));
  const view = new SceneView($("pw-view"));
  view.load(session);

  const consoleView = new ConsoleView($("console-output"));
  const runner = new Runner({
    session: () => session,
    console: consoleView,
    highlight: (id) => ws.highlightBlock(id),
    onError: (line) => {
      if (state.mode === "python") selectLine(pyEditor, line);
    },
    onRunningChange: () => updateButtons(),
  });

  const status = $("python-status");
  runner
    .load()
    .then(() => (status.hidden = true))
    .catch((err) => {
      status.textContent = "Python failed to load";
      console.error(err);
    });

  const window_ = setupPlaygroundWindow({
    view,
    session: () => session,
    timer: () => runner.timer(),
    onReset: () => void reset(),
    onVisibilityChange: (open) => ($("toggle-playground").textContent = open ? "Close Playground" : "Open Playground"),
  });
  window_.setTitle(session.def.name);
  window_.setOpen(true);
  $("toggle-playground").addEventListener("click", () => window_.setOpen(!!$("playground-window").hidden));

  async function reset(playgroundId = state.playground) {
    await runner.stop();
    state.playground = playgroundId;
    session = new SimSession(getPlayground(playgroundId));
    view.load(session);
    window_.setTitle(session.def.name);
  }

  const picker = setupPicker(
    () => state.playground,
    (id) => {
      void reset(id);
      window_.setOpen(true);
      scheduleSave();
    },
  );
  $("select-playground").addEventListener("click", () => picker.open());

  let last = performance.now();
  function frame(now: number) {
    session.advance((now - last) / 1000);
    last = now;
    if (!$("playground-window").hidden) {
      view.render();
      window_.update();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ------------------------------------------------------------ run buttons
  const startBtn = $<HTMLButtonElement>("btn-start");
  const stopBtn = $<HTMLButtonElement>("btn-stop");
  const stepBtn = $<HTMLButtonElement>("btn-step");

  function updateButtons() {
    const running = runner.isRunning;
    startBtn.disabled = running && !runner.isStepping;
    stopBtn.disabled = !running;
  }

  const source = () => (state.mode === "blocks" ? generatePython(ws, true) : pyEditor.state.doc.toString());

  startBtn.addEventListener("click", () => {
    window_.setOpen(true);
    void runner.start(source());
    updateButtons();
  });
  stopBtn.addEventListener("click", () => void runner.stop());
  stepBtn.addEventListener("click", () => {
    window_.setOpen(true);
    runner.step(source());
    updateButtons();
  });

  // ---------------------------------------------------------------- console
  $("console-clear").addEventListener("click", () => consoleView.clear());
  $("console-toggle").addEventListener("click", (e) => {
    const panel = $("console-panel");
    panel.classList.toggle("collapsed");
    (e.target as HTMLElement).textContent = panel.classList.contains("collapsed") ? "Show" : "Hide";
    Blockly.svgResize(ws);
  });

  // ---------------------------------------------------------- save and load
  function currentProject(): Project {
    return {
      format: "robocode-sim",
      version: 1,
      name: nameInput.value,
      mode: state.mode,
      playground: state.playground,
      blocks: saveBlocks(ws),
      python: pyEditor.state.doc.toString(),
    };
  }

  let saveTimer = 0;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => autosave(currentProject()), 400);
  }
  nameInput.addEventListener("input", scheduleSave);

  function applyProject(p: Project) {
    nameInput.value = p.name || "Untitled Project";
    loadBlocks(ws, p.blocks ?? DEFAULT_BLOCKS);
    setPythonCode(pyEditor, p.python ?? DEFAULT_PYTHON);
    setMode(p.mode);
    if (p.playground && p.playground !== state.playground) void reset(p.playground);
  }

  // File menu.
  const fileMenu = $("file-menu");
  $("file-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    fileMenu.hidden = !fileMenu.hidden;
  });
  document.addEventListener("click", () => (fileMenu.hidden = true));
  const openInput = $<HTMLInputElement>("open-file");
  fileMenu.addEventListener("click", async (e) => {
    const action = (e.target as HTMLElement).dataset.action;
    if (action === "new-blocks" || action === "new-python") {
      if (!confirm("Start a new project? Unsaved changes to this one will be lost.")) return;
      await runner.stop();
      applyProject({
        format: "robocode-sim",
        version: 1,
        name: "Untitled Project",
        mode: action === "new-blocks" ? "blocks" : "python",
        playground: state.playground,
      });
      scheduleSave();
    } else if (action === "open") {
      openInput.click();
    } else if (action === "save") {
      downloadProject(currentProject());
    }
  });
  openInput.addEventListener("change", async () => {
    const file = openInput.files?.[0];
    openInput.value = "";
    if (!file) return;
    const project = parseProject(await file.text(), file.name);
    if (!project) {
      consoleView.error(`Couldn't open "${file.name}": not a project file.`);
      return;
    }
    await runner.stop();
    applyProject(project);
    scheduleSave();
  });

  // Handle for automated tests.
  Object.assign(window, { rcsim: { runner, session: () => session, view } });

  const saved = loadAutosave();
  applyProject(saved ?? { format: "robocode-sim", version: 1, name: "Untitled Project", mode: "blocks", playground: state.playground });
  updateButtons();
}

void main();
