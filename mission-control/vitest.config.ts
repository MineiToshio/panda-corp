import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    // `.pandacorp/run/` is gitignored runtime scratch (incl. DR-107 preserved-test archives) — those
    // are staged into `src/**/_tests/` by the FRD gate, never collected from their archive location
    // (where their relative repo-root resolution is wrong). Excluding it keeps discovery to real tests.
    exclude: [
      "**/node_modules/**",
      ".next",
      "prototype",
      "e2e/**",
      "**/.claude/worktrees/**",
      ".pandacorp/run/**",
    ],
    // Raised from the default 5 000 ms to accommodate:
    //   - WO-13-003 large-list keyboard-nav stress test (1 100 fireEvent × 1 000 items in jsdom)
    //   - WO-13-002 adversarial tests that invoke npx @tailwindcss/cli (cold-cache download)
    // Per-test overrides can narrow this further when needed (see a11y-primitives.test.tsx).
    testTimeout: 120000,
  },
  resolve: {
    alias: {
      "@": new URL("./src/", import.meta.url).pathname,
    },
  },
});
