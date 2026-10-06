import { defineConfig } from "@playwright/test";

// Runs against the production build so paths (e.g. self-hosted Pyodide) are
// tested the way GitHub Pages will serve them. Set BASE_URL to test another
// server (e.g. the dev server) instead.
const base = process.env.BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 60_000 },
  use: {
    baseURL: base ?? "http://localhost:4173/",
    viewport: { width: 1400, height: 860 },
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: base
    ? undefined
    : {
        command: "npm run build && npx vite preview --port 4173 --strictPort",
        url: "http://localhost:4173/",
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
