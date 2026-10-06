# RoboCode Sim

A free, browser-based robot coding simulator for the classroom. Students code a
virtual robot with blocks or Python and watch it drive in a 3D playground.

Commands follow VEXcode VR's Python names (`drivetrain.drive_for(FORWARD, 200, MM)`,
`vr_thread(main)`, ...) so lessons written for it carry over. This project is
independent and is not affiliated with or endorsed by VEX Robotics.

## Run it locally

```sh
npm install
npm run dev        # http://localhost:5173
```

## Tests

```sh
npm test           # unit tests (simulator + Python runtime)
npm run e2e        # browser tests against the production build
```

## Put it online (free, GitHub Pages)

1. Create a GitHub repository and push this folder to its `main` branch.
2. In the repository: **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` builds, tests and publishes the site. The link appears
   under **Settings → Pages**.

Python (Pyodide) is served from the site itself, so it works on school
networks that block outside CDNs.

## Layout

- `src/runtime/` Python runtime: `transform.py` makes blocking robot commands
  async; `vexcode_vr.py` is the student-facing API.
- `src/sim/` physics world, robot and drivetrain (Rapier).
- `src/render/` 3D view (Three.js) and floor painting.
- `src/editor/` blocks (Blockly) and Python (CodeMirror) editors.
- `src/playgrounds/` one file per playground.
- `examples/` reference programs, also used by the browser tests.
