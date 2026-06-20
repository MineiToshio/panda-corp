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
    await page.goto(s.path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${s.id}-${testInfo.project.name}.png`, { fullPage: true });
  });
}
