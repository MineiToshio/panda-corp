import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";
import { notSkipped } from "./_skip";
import { SURFACES } from "./routes";

/**
 * Page-Error Sweep (DR-143) — every declared surface loads without an uncaught browser error on the
 * production-build server. A production build drops React's console diagnostics, but a hydration
 * mismatch still throws (minified #418), so this keeps that signal on every route, blessed or not.
 * VERBATIM stack template (DR-059). On `next dev` the sentinel reports an explicit not-applicable skip.
 */
const GATE_PROD = process.env.PANDACORP_E2E_SERVER === "prod";

test("page-error sweep harness present", () => {
  // biome-ignore lint/suspicious/noSkippedTests: explicit gate applicability (DR-144).
  test.skip(!GATE_PROD, "Page-error sweep requires the production-build server (DR-143).");
  // biome-ignore lint/suspicious/noSkippedTests: server mode does not imply UI applicability.
  test.skip(SURFACES.length === 0, "No UI surfaces declared; page-error sweep is not applicable.");
  expect(SURFACES.length).toBeGreaterThan(0);
});

if (GATE_PROD) {
  for (const s of notSkipped(SURFACES)) {
    test(`page errors · ${s.id} (${s.path})`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.route("**/api/live**", (r) => r.abort());
      await gotoHydrated(page, s.path, { optional: true });
      expect(errors, `uncaught page errors on ${s.path}`).toEqual([]);
    });
  }
}
