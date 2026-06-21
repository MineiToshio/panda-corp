import { expect, test } from "@playwright/test";
import { BLESSED } from "./routes";

/**
 * Visual-Fidelity Gate Layer A (DR-056): each blessed surface is diffed against its own
 * blessed baseline at ≥2 viewports (the playwright projects), fonts settled, animations off.
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
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${s.id}-${testInfo.project.name}.png`, { fullPage: true });
  });
}
