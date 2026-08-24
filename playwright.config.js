// playwright.config.js — tests de bout en bout du portail en MODE DÉMO :
// aucun service Microsoft requis (apiFetch répond localement), donc la
// suite tourne partout — poste de dev, CI GitHub, environnement hors ligne.
// Hors CI, PW_EXECUTABLE_PATH permet d'utiliser un Chromium déjà installé.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  // Le banc API (messages.test.cjs) se joue avec « npm run test:api ».
  testMatch: "**/*.spec.js",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1440, height: 900 },
    launchOptions: process.env.PW_EXECUTABLE_PATH
      ? { executablePath: process.env.PW_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
