import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "prototype"],
    // Raised from the default 5 000 ms to accommodate:
    //   - WO-13-003 large-list keyboard-nav stress test (1 100 fireEvent × 1 000 items in jsdom)
    //   - WO-13-002 adversarial tests that invoke npx @tailwindcss/cli (cold-cache download)
    // Per-test overrides can narrow this further when needed (see a11y-primitives.test.tsx).
    testTimeout: 120000,
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname,
    },
  },
});
