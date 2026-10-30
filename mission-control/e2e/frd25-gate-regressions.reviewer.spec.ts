import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const WORKSPACE = "/portfolio/mission-control";

const queryValue = (page: Page, key: string): string | null =>
  new URL(page.url()).searchParams.get(key);

test("AC-25-002.1/004.1: Cuentas survives its legacy alias, canonicalization and reload", async ({
  page,
}) => {
  await gotoHydrated(page, "/portfolio?portfolioView=accounts", {
    selector: '[data-testid="portfolio-page"]',
  });
  await expect.poll(() => queryValue(page, "view")).toBe("cuentas");
  await page.reload();
  await expect(page.getByTestId("portfolio-page")).toBeVisible();
  await expect(page.getByTestId("portfolio-page-workspace")).toHaveCount(0);
});

test("AC-25-002.1/004.1: the dependency view survives view=dag, canonicalization and reload", async ({
  page,
}) => {
  await gotoHydrated(page, `${WORKSPACE}/observability?view=dag`, {
    selector: '[data-testid="obs-toggle"]',
  });
  await expect.poll(() => queryValue(page, "view")).toBe("deps");
  await page.reload();
  await expect(page.getByTestId("obs-toggle")).toBeVisible();
  await expect(page.getByTestId("obs-view-timeline")).toHaveCount(0);
});

test("FRD-25 v2 families: no Party or separate Work orders tab, and every offered tab opens", async ({
  page,
}) => {
  await gotoHydrated(page, `${WORKSPACE}/summary`, { selector: '[data-testid="tabbar"]' });
  await expect(page.getByTestId("tab-party")).toHaveCount(0);
  await expect(page.getByTestId("tab-work-orders")).toHaveCount(0);
  const tabs = page.getByTestId("tabbar").getByRole("tab");
  for (let index = 0; index < (await tabs.count()); index += 1) {
    const tab = tabs.nth(index);
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }
});

test("AC-25-009.1: Observability keeps the work orders reachable and detail returns to them", async ({
  page,
}) => {
  await gotoHydrated(page, `${WORKSPACE}/observability`, { selector: '[data-testid="tabbar"]' });
  await expect(page.getByTestId("wo-board")).toBeVisible();
  await page.getByTestId("wo-card-link").first().click();
  await expect(page.getByTestId("wo-detail")).toBeVisible();
  await page.getByTestId("wo-detail-back").click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`${WORKSPACE}/observability`);
  await expect.poll(() => queryValue(page, "wo")).toBeNull();
  await expect(page.getByTestId("wo-board")).toBeVisible();
});

for (const path of [
  "/projects/mission-control/summary",
  "/configuration",
  "/configuration/rules/DR-009",
]) {
  test(`AC-25-010.1: ${path} keeps one shell, one main, one h1 and no sideways scroll`, async ({
    page,
  }) => {
    await gotoHydrated(page, path, { selector: '[data-testid="app-shell"]' });
    await expect(page.getByTestId("app-shell")).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("#main-content")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Saltar al contenido" })).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    const toggle = page.locator("[data-nav-toggle]");
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    }
    if (path.startsWith("/projects/")) {
      await expect(page.getByTestId("app-nav-portfolio")).toHaveAttribute("aria-current", "page");
    }
  });
}
