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

async function liveRefresh(page: Page): Promise<void> {
  const { atime, mtime } = fs.statSync(ORDER);
  try {
    fs.utimesSync(ORDER, new Date(), new Date());
    await page.waitForResponse((r) => r.url().includes("_rsc="), { timeout: 12_000 });
  } finally {
    fs.utimesSync(ORDER, atime, mtime);
  }
}

test("AC-12-006.2: an order opened from the map walks Back and Forward through the URL", async ({
  page,
}) => {
  await settled(page, `${BASE}?view=deps&dag=wo&frd=frd-01-x&focus=WO-01-003`);
  await page.getByRole("button", { name: "Abrir work order", exact: true }).click();
  await expect(page.getByTestId("wo-detail")).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/[?&]wo=WO-01-003/);
  await page.goBack();
  await expect(page).not.toHaveURL(/[?&]wo=/);
  await expect(page).toHaveURL(/focus=WO-01-003/);
  await expect(page.getByTestId("wo-detail")).toHaveCount(0, { timeout: 15_000 });
  await page.goForward();
  await expect(page).toHaveURL(/[?&]wo=WO-01-003/);
  await expect(page.getByTestId("wo-detail")).toBeVisible({ timeout: 15_000 });
});

test("REQ-25: a hard load of a non-canonical URL keeps Back and Forward across client selections", async ({
  page,
}) => {
  await gotoHydrated(page, "/", { selector: "main a" });
  await page.goto("/portfolio?project=mission-control&tab=observability&view=dag&dag=wo");
  await expect(page).toHaveURL(/\/portfolio\/mission-control\/observability\?.*view=deps/);
  await page.locator('[data-wo="WO-01-003"]:visible').first().click();
  await expect(page).toHaveURL(/focus=WO-01-003/);
  await page.goBack();
  await expect(page).not.toHaveURL(/focus=/);
  await expect(page).toHaveURL(/view=deps/);
  await expect(page.locator('[data-wo="WO-01-003"]:visible').first()).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/focus=WO-01-003/);
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test("AC-12-005.1: the legacy dag view survives a live refresh on its canonical URL", async ({
  page,
}) => {
  await page.goto(`${BASE}?view=dag&dag=wo`);
  await expect(page).toHaveURL(/view=deps/);
  await expect(page.locator('[data-wo="WO-01-003"]:visible').first()).toBeVisible();
  await liveRefresh(page);
  await expect(page).toHaveURL(/view=deps/);
  await expect(page).toHaveURL(/dag=wo/);
  await expect(page.locator('[data-wo="WO-01-003"]:visible').first()).toBeVisible();
});

test("REQ-25: a portfolio filter survives a reload and walks Back", async ({ page }) => {
  await gotoHydrated(page, "/portfolio", { selector: ".seg button" });
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page).toHaveURL(/view=lista/);
  await page.reload();
  await expect(page).toHaveURL(/view=lista/);
  await expect(page.getByRole("button", { name: "Lista", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.goBack();
  await expect(page).not.toHaveURL(/view=lista/);
});

test("AC-25-003.1: client model params set before a canonical replace lands stay in the URL", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = 0;
  await page.route(/_rsc=/, async (route) => {
    held += 1;
    await gate;
    await route.continue().catch(() => {});
  });
  await page.goto("/portfolio/mission-control/architecture?tab=architecture", {
    waitUntil: "domcontentloaded",
  });
  const viewer = page.getByTestId("data-model-viewer");
  await viewer.waitFor();
  await expect.poll(() => held, { timeout: 20_000 }).toBeGreaterThan(0);
  const search = viewer.getByRole("searchbox");
  await expect(async () => {
    await search.fill("id");
    await expect(page).toHaveURL(/modelQuery=id/, { timeout: 500 });
  }).toPass();
  await page.getByTestId("model-fullscreen").click();
  await expect(page).toHaveURL(/expanded=1/);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  const refreshed = page.waitForResponse((r) => r.url().includes("_rsc="));
  release();
  await refreshed;
  await expect(page).toHaveURL(/\/architecture\?.*modelQuery=id/);
  await expect(page).toHaveURL(/expanded=1/);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
});
