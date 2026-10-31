import { expect, test } from "@playwright/test";
import { gotoHydrated } from "../_hydration";

test("nested destinations retain global highlights and configuration retains its integrated shell", async ({
  page,
}) => {
  await gotoHydrated(page, "/board/idea-in-pipeline/spec", {
    selector: '[data-testid="card-detail-tab-spec"]',
  });
  await expect(page.getByTestId("app-nav-tablero")).toHaveAttribute("aria-current", "page");
  const toggle = page.locator("#menu");
  if (await toggle.isVisible()) {
    await toggle.click();
    await expect(page.getByTestId("app-nav-tablero")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  }
  await page.goto("/manual/reference/rules/DR-009");
  await expect(page.getByTestId("app-nav-documentacion")).toHaveAttribute("aria-current", "page");
  await page.goto("/configuration/rules/DR-009");
  await expect(page.getByTestId("rule-detail")).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveCount(1);
  await expect(
    page.locator('[data-testid="app-shell"] a[href="/configuration"][aria-current="page"]'),
  ).toHaveCount(1);
});
