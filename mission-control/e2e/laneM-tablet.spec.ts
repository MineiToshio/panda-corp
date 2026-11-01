import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Seed tablet cases independently of owner data; restore exact fixture bytes after this spec.
const project = path.resolve("e2e/fixtures/factory-root/mission-control");
const portfolio = path.resolve("e2e/fixtures/factory-root/factory/portfolio.md");
const sources = new Map([
  [
    portfolio,
    `${fs.readFileSync(portfolio, "utf8").trimEnd()}\n| Tablet fixture A | lane-m-missing-a | — | — | design | — | personal | active | 2026-10-31 |\n| Tablet fixture B | lane-m-missing-b | — | — | design | — | personal | active | 2026-10-31 |\n`,
  ],
  [
    path.join(project, ".pandacorp/comms/arquitectura-resumen.md"),
    `---
proyecto: Mission Control
fase: arquitectura
---
## Stack
| Capa | Elección | Por qué |
| --- | --- | --- |
| Web | Next.js | Lectura local de documentos |
| Lenguaje | TypeScript | Contratos tipados |
`,
  ],
  [path.join(project, ".env.example"), "# Factory root\nPANDACORP_FACTORY_ROOT=\n"],
]);
const original = new Map<string, Buffer | null>();
test.beforeAll(() => {
  for (const [file, content] of sources) {
    original.set(file, fs.existsSync(file) ? fs.readFileSync(file) : null);
    fs.writeFileSync(file, content);
  }
});
test.afterAll(() => {
  for (const [file, content] of original) {
    if (content === null) fs.unlinkSync(file);
    else fs.writeFileSync(file, content);
  }
});

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
      expect(count).toBe(3);
      const first = await cards.nth(0).boundingBox();
      const second = await cards.nth(1).boundingBox();
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(second?.y).toBeCloseTo(first?.y ?? 0, 0);
      expect(second?.x).toBeGreaterThan((first?.x ?? 0) + (first?.width ?? 0));
      const grid = await cards.first().locator("..").boundingBox();
      const last = await cards.last().boundingBox();
      expect(grid).not.toBeNull();
      expect(last).not.toBeNull();
      expect(first?.width).toBeLessThan((grid?.width ?? 0) / 2);
      expect(last?.y).toBeGreaterThan(first?.y ?? 0);
      expect(last?.width).toBeCloseTo(grid?.width ?? 0, 0);
      expect(last?.x).toBeCloseTo(grid?.x ?? 0, 0);
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`architecture stack rows read vertically on tablet in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.addInitScript((value) => localStorage.setItem("orbita-theme", value), theme);
    await page.goto("/board/idea-in-pipeline/architecture", {
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
    await page.goto("/board/idea-in-pipeline/architecture", {
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

const MUTED_STATE = {
  "/achievements/missions": '[data-untouched="true"]',
  "/achievements/ranks": '[data-state="locked"]',
} as const;

for (const route of ["/achievements/missions", "/achievements/ranks"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`${route} meets AA contrast in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 900 });
      await page.addInitScript((value) => localStorage.setItem("orbita-theme", value), theme);
      await page.goto(route, { waitUntil: "load", timeout: 90_000 });
      await expect(page.locator(MUTED_STATE[route]).first()).toBeVisible();
      const result = await new AxeBuilder({ page })
        .include("main")
        .withRules(["color-contrast"])
        .analyze();
      expect(result.violations).toEqual([]);
    });
  }
}
