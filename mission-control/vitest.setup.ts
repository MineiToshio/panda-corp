import "@testing-library/jest-dom/vitest";
import { act } from "@testing-library/react";
import { vi } from "vitest";
import "vitest";

/**
 * vi.runAllMicrotasksAsync — polyfill for vitest 4.x.
 *
 * vitest 4.1.9 exposes `vi.runAllTimersAsync` / `vi.runOnlyPendingTimersAsync`
 * but not `vi.runAllMicrotasksAsync`. The test-writer authored tests against
 * the microtask-flush helper; we fill the gap here so the test file compiles
 * and runs without modification.
 *
 * Implementation: wraps multiple microtask flushes inside React's `act` so
 * that pending state updates (setState calls inside async handlers) are flushed
 * to the DOM before the test assertion runs. Without `act`, React batches the
 * update and the DOM still shows the pre-click state when asserted.
 */
if (!("runAllMicrotasksAsync" in vi)) {
  (vi as unknown as Record<string, unknown>).runAllMicrotasksAsync = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  };
}

declare module "vitest" {
  interface VitestUtils {
    /**
     * Flush the JavaScript microtask queue inside a React `act` boundary.
     * Polyfilled in vitest.setup.ts — not natively available in vitest 4.x.
     */
    runAllMicrotasksAsync(): Promise<void>;
  }
}
