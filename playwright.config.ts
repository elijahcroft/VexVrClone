import { defineConfig } from "@playwright/test";

// Runs against the production build so paths (e.g. self-hosted Pyodide) are
// tested the way GitHub Pages will serve them.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 60_000 },
  use: {
    baseURL: "http://localhost:4173/",
    viewport: { width: 1400, height: 860 },
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173/",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
