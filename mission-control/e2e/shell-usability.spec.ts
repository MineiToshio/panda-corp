/* eslint-disable testing-library/prefer-screen-queries -- Playwright Page/Locator queries are not RTL render-result queries. */
import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

async function board(page: Page, width: number, theme: string) {
  await page.setViewportSize({ width, height: 900 });
  await gotoHydrated(page, "/board", { selector: '[data-testid="board-search"]' });
  await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
  const header = page.getByTestId("app-shell");
  await expect(header).toBeVisible();
  const box = await header.boundingBox();
  if (!box) throw new Error("Application header missing");
  expect(box.width).toBeGreaterThan(Math.min(width, 1240) - 70);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth + 1)).toBe(true);
  return {
    header,
    box,
    toggle: page.getByTestId("app-nav-toggle"),
    nav: page.getByTestId("app-nav"),
  };
}

for (const theme of ["light", "dark"]) {
  test(`phone navigation is an integrated header disclosure and dismisses on every path (${theme})`, async ({
    page,
  }) => {
    const { header, box, toggle, nav } = await board(page, 320, theme);
    await expect(toggle).toBeVisible();
    const button = await toggle.boundingBox();
    if (!button) throw new Error("Phone navigation toggle missing");
    expect(button.x).toBeGreaterThan(160);
    expect(button.y - box.y).toBeLessThan(25);
    await expect(header.getByTestId("app-nav")).toHaveCount(1);
    await toggle.click();
    await expect(nav.getByRole("link")).toHaveCount(7);
    const navBox = await nav.boundingBox();
    if (!navBox) throw new Error("Expanded phone destinations missing");
    expect(navBox.width).toBeGreaterThan(box.width - 50);
    for (const link of await nav.getByRole("link").all()) {
      await expect(link).toBeVisible();
      const target = await link.boundingBox();
      if (!target) throw new Error("Navigation destination missing");
      expect(target.height).toBeGreaterThanOrEqual(44);
      expect(target.x + target.width).toBeLessThanOrEqual(320);
    }
    await nav.getByRole("link", { name: "Portfolio", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await toggle.click();
    await page.getByRole("heading", { name: "Tablero", exact: true }).click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await nav.getByRole("link", { name: "Tablero", exact: true }).click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await nav.getByRole("link", { name: "Portfolio", exact: true }).click();
    await expect(page.getByTestId("app-nav-toggle")).toHaveAttribute("aria-expanded", "false");
  });

  test(`tablet uses the same full-width header menu (${theme})`, async ({ page }) => {
    const { box, toggle, nav } = await board(page, 1024, theme);
    await expect(toggle).toBeVisible();
    await expect(nav).toBeHidden();
    await toggle.click();
    await expect(nav).toBeVisible();
    const destinations = await nav.boundingBox();
    if (!destinations) throw new Error("Tablet navigation missing");
    expect(destinations.width).toBeGreaterThan(box.width - 50);
    await expect(nav.getByRole("link")).toHaveCount(7);
    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();
  });

  test(`wide desktop centers the 1240px frame with 1200px content and one inline destination row (${theme})`, async ({
    page,
  }) => {
    const { header, box, toggle, nav } = await board(page, 1600, theme);
    expect(await header.locator("..").boundingBox()).toMatchObject({ x: 180, width: 1240 });
    expect(box.width).toBe(1200);
    expect(box.x).toBe(200);
    await expect(toggle).toBeHidden();
    await expect(nav).toBeVisible();
    const rows = await nav.getByRole("link").evaluateAll((links) =>
      links.map((link) => {
        const box = link.getBoundingClientRect();
        return box.y + box.height / 2;
      }),
    );
    for (const center of rows) expect(Math.abs(center - (rows[0] ?? 0))).toBeLessThanOrEqual(1);
  });
}
