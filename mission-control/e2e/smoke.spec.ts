import { expect, test } from "@playwright/test";
import { BLESSED } from "./routes";

/**
 * Preview Smoke Gate (DR-055): every blessed surface renders real content with no console
 * error / pageerror / non-2xx. Fail-closed — the harness is always present; the trivial
 * sentinel keeps the suite non-empty while no surface is blessed yet (Phase 2 start).
 */
test("smoke harness present", () => {
  expect(BLESSED.length).toBeGreaterThanOrEqual(0);
});

for (const s of BLESSED) {
  test(`smoke · ${s.id} (${s.path}) renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));

    const res = await page.goto(s.path, { waitUntil: "networkidle" });
    expect(res?.status(), `${s.path} HTTP status`).toBeLessThan(400);
    await expect(page.locator("main, h1").first()).toBeVisible();
    expect(errors, `console/page errors on ${s.path}`).toEqual([]);
  });
}
