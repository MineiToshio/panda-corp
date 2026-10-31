import fs from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const BASE = "/portfolio/mission-control/observability";
const ORDER =
  "e2e/fixtures/factory-root/mission-control/docs/frds/frd-01-x/work-orders/wo-01-003-board.md";

async function settled(page: Page, href: string) {
  await gotoHydrated(page, href, { selector: ".seg button" });
  await page.waitForResponse((r) => r.url().includes("_rsc="), { timeout: 5000 }).catch(() => null);
  await page.waitForLoadState("load");
}

test("AC-12-006.2: Abrir work order opens the detail and the URL keeps wo", async ({ page }) => {
  await settled(page, `${BASE}?view=deps&dag=wo&frd=frd-01-x&focus=WO-01-003`);
  await page.getByRole("button", { name: "Abrir work order", exact: true }).click();
  await expect(page.getByTestId("wo-detail")).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/[?&]wo=WO-01-003/);
});

test("AC-12-006.2 AC-12-005.1: a live refresh keeps the level and focus in the URL", async ({
  page,
}) => {
  await settled(page, `${BASE}?view=deps&dag=wo`);
  await page.locator('[data-wo="WO-01-003"]:visible').first().click();
  await expect(page).toHaveURL(/focus=WO-01-003/);
  const { atime, mtime } = fs.statSync(ORDER);
  try {
    fs.utimesSync(ORDER, new Date(), new Date());
    await page.waitForResponse((r) => r.url().includes("_rsc="), { timeout: 12_000 });
    await expect(page).toHaveURL(/dag=wo/);
    await expect(page).toHaveURL(/focus=WO-01-003/);
  } finally {
    fs.utimesSync(ORDER, atime, mtime);
  }
});

test("AC-12-006.1: the FRD chosen in Por FRD scopes the work-order graph", async ({ page }) => {
  await settled(page, `${BASE}?view=deps&dag=wo&frd=FRD-01`);
  await expect(page.getByRole("combobox", { name: "Filtrar el grafo por FRD" })).toHaveValue(
    "frd-01-x",
  );
});

test("REQ-05-001: five columns that do not fit scroll instead of overlapping", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await settled(page, `${BASE}?view=tablero`);
  const lefts = await page.getByTestId("wo-board").evaluate((board) => {
    (board as HTMLElement).style.setProperty("--cols", "5");
    const last = board.lastElementChild;
    if (last) board.append(last.cloneNode(true));
    return [...board.children].map((column) => {
      const { left, right } = column.getBoundingClientRect();
      return { left, right };
    });
  });
  for (const [index, column] of lefts.slice(1).entries())
    expect(column.left).toBeGreaterThanOrEqual(lefts[index]?.right ?? 0);
});
