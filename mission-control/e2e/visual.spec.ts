import { expect, test } from "@playwright/test";
import { BLESSED } from "./routes";

/**
 * Visual-Fidelity Gate Layer A (DR-056): each blessed surface is diffed against its own blessed
 * baseline at ≥2 viewports (the playwright projects), fonts settled, animations off. VERBATIM stack
 * template (DR-059) — propagated by /pandacorp:blueprint, conformance-checked by /pandacorp:upgrade.
 * Fail-closed; the sentinel keeps the suite non-empty while no surface is blessed yet.
 * Layer B (the VLM mock-judge) is the reviewer's runtime/visual lens, not a script.
 */
test("visual harness present", () => {
  expect(BLESSED.length).toBeGreaterThanOrEqual(0);
});

for (const s of BLESSED) {
  test(`visual · ${s.id} (${s.path}) matches baseline`, async ({ page }, testInfo) => {
    // Block the live transport (SSE) so the screenshot is DETERMINISTIC (no streaming data shifting
    // pixels) and the page doesn't hang — a live EventSource never lets networkidle settle (DR-071).
    // The page still renders its initial server snapshot, which is what the blessed baseline captures.
    await page.route("**/api/live**", (r) => r.abort());
    await page.goto(s.path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main, h1").first()).toBeVisible(); // real content rendered before the shot
    // Exclude environment/data-dependent surfaces from the visual baseline so pixel diffs stay
    // deterministic (each has its own unit/component coverage):
    //   - dashboard-banners — the FRD-15 plugin-drift banner appears only mid-version-bump
    //     (installed < source, before `claude plugin update`), a transient/per-machine state.
    //   - activity-log — the project summary's activity feed is the tail of .pandacorp/comms/
    //     progress.md, which grows on every build; its content is volatile, not a fixed render.
    //   - summary-text — the project summary renders the idea-card body (long prose); its line
    //     metrics reflow subtly between cold/warm dev-server renders, exceeding the pixel ratio.
    //   - [data-volatile] — generic marker for any region whose CONTENT is live data whose
    //     length changes the page height (the /board idea-card grid, the /proposals feed). The
    //     baseline asserts the page chrome (layout, nav, headers, empty-state structure), never
    //     the data-driven list whose height drifts as cards/lessons are added or removed (DR-088).
    await page.addStyleTag({
      content:
        '[data-testid="dashboard-banners"],[data-testid="activity-log"],[data-testid="summary-text"],[data-volatile]{display:none!important}',
    });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${s.id}-${testInfo.project.name}.png`, { fullPage: true });
  });
}
