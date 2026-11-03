import { expect, test } from "@playwright/test";

test.use({ javaScriptEnabled: false });

for (const [path, title] of [
  ["/board", "Tablero"],
  ["/configuration", "Configuración"],
] as const) {
  test(`AC-19-001: SSR serves ${title} without JavaScript`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path, { waitUntil: "load" });
    await expect(page.locator("#where > span")).toHaveText(title);
  });
}

test("AC-19-005.1: SSR marks the current project without JavaScript", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/portfolio/mission-control/summary", { waitUntil: "load" });
  await expect(
    page.locator('#projlist a[href="/portfolio/mission-control/summary"]'),
  ).toHaveAttribute("aria-current", "page");
});
