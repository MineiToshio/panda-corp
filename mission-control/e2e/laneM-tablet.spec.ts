import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Approved prototype: the odd final project fills both tablet columns (item 35).
for (const theme of ["light", "dark"] as const) {
  test(`project cards fill the final tablet row in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.addInitScript((value) => localStorage.setItem("orbita-theme", value), theme);
    for (const route of ["/", "/portfolio"]) {
      await page.goto(route, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await expect(page.locator('.projnav[data-ready="true"]')).toBeVisible();
      const cards = page.locator(".proj-card");
      await expect(cards.first()).toBeVisible();
      const count = await cards.count();
      expect(count).toBeGreaterThan(1);
      // Even populations already fill the final row without a spanning card.
      if (count % 2 === 0) continue;
      const grid = await cards.first().locator("..").boundingBox();
      const last = await cards.last().boundingBox();
      expect(grid).not.toBeNull();
      expect(last).not.toBeNull();
      expect(last?.width).toBeCloseTo(grid?.width ?? 0, 0);
      expect(last?.x).toBeCloseTo(grid?.x ?? 0, 0);
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`architecture stack rows read vertically on tablet in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.addInitScript((value) => localStorage.setItem("orbita-theme", value), theme);
    await page.goto("/board/funko-tracker/architecture", {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    const table = page.getByTestId("arch-stack").getByRole("table");
    await expect(table).toBeVisible();
    const cells = table.locator("tbody tr").first().getByRole("cell");
    const layer = await cells.nth(0).boundingBox();
    const choice = await cells.nth(1).boundingBox();
    const reason = await cells.nth(2).boundingBox();
    expect(choice?.y).toBeGreaterThan((layer?.y ?? 0) + (layer?.height ?? 0));
    expect(reason?.y).toBeGreaterThan((choice?.y ?? 0) + (choice?.height ?? 0));
    expect(choice?.x).toBeCloseTo(layer?.x ?? 0, 0);
  });
}

test("portfolio comparison keeps compact three-column facts on tablet", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/portfolio?view=lista", { waitUntil: "domcontentloaded", timeout: 90_000 });
  const row = page.getByRole("table").locator("tbody tr").first();
  const cells = row.getByRole("cell");
  const project = await cells.nth(0).boundingBox();
  const phase = await cells.nth(1).boundingBox();
  const frds = await cells.nth(3).boundingBox();
  const docs = await cells.nth(4).boundingBox();
  const adrs = await cells.nth(5).boundingBox();
  expect((phase?.y ?? 0) + (phase?.height ?? 0) / 2).toBeCloseTo(
    (project?.y ?? 0) + (project?.height ?? 0) / 2,
    0,
  );
  expect(docs?.y).toBeCloseTo(frds?.y ?? 0, 0);
  expect(adrs?.y).toBeCloseTo(frds?.y ?? 0, 0);
  expect(docs?.x).toBeGreaterThan(frds?.x ?? 0);
  const progress = await row.getByRole("progressbar").boundingBox();
  expect(progress?.height).toBeGreaterThan(0);
});

for (const theme of ["light", "dark"] as const) {
  test(`architecture table and environment contrast meets AA in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.addInitScript((value) => localStorage.setItem("orbita-theme", value), theme);
    await page.goto("/board/funko-tracker/architecture", {
      waitUntil: "load",
      timeout: 90_000,
    });
    const result = await new AxeBuilder({ page })
      .include('[data-testid="arch-stack"]')
      .include('[data-testid="arch-env-block"]')
      .withRules(["color-contrast"])
      .analyze();
    expect(result.violations).toEqual([]);
  });
}

test("guild summary balances counts and recent trophies at tablet width", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/achievements", { waitUntil: "load", timeout: 90_000 });
  const counts = page.getByTestId("guild-hero").locator(":scope > div:last-child");
  const group = await counts.boundingBox();
  const first = await counts.locator(":scope > div").first().boundingBox();
  expect(first?.x).toBeCloseTo(group?.x ?? 0, 0);
  const recent = page
    .locator(".card")
    .filter({ has: page.getByRole("heading", { name: "Trofeos recientes" }) })
    .locator('[data-variant="recent"]');
  await expect(recent).toHaveCount(4);
  const firstTrophy = await recent.nth(0).boundingBox();
  const thirdTrophy = await recent.nth(2).boundingBox();
  expect(thirdTrophy?.y).toBeCloseTo(firstTrophy?.y ?? 0, 0);
});
