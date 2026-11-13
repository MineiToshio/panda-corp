import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { pandacorpVitest } from "./.pandacorp/vitest-policy";
import domSpecs from "./scripts/test/dom-specs.json";

export default defineConfig(
  pandacorpVitest(
    {
      plugins: [react()],
      test: {
        globals: true,
        setupFiles: ["./vitest.setup.ts"],
        include: ["**/*.{test,spec}.{ts,tsx}"],
        // Runtime archives and worktrees are never part of the product test corpus.
        exclude: [
          "**/node_modules/**",
          ".next",
          "prototype",
          "e2e/**",
          "**/.claude/worktrees/**",
          ".pandacorp/run/**",
          ".stryker-tmp/**",
          ".mutation-cache/**",
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
    },
    { dom: domSpecs, domSetupFiles: ["./vitest.dom.setup.ts"] },
  ),
);
