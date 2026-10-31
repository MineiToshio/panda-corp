import fs from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";
import { reloadCommitted } from "./persistent-navigation/_history";

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
  // A Back before hydration commits is rewritten by Next's first history sync, on every entry.
  await reloadCommitted(page);
  await expect(page).toHaveURL(/view=lista/);
  await expect(page.getByRole("button", { name: "Lista", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.goBack();
  await expect(page).not.toHaveURL(/view=lista/);
});

test("AC-25-003.1: a server canonical URL keeps client model params through a real refresh", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoHydrated(page, "/portfolio/mission-control/architecture?tab=architecture", {
    selector: '[data-testid="data-model-viewer"]',
  });
  // The redirect lands before mount, so no later canonical write can race these selections.
  await expect(page).toHaveURL(/\/portfolio\/mission-control\/architecture$/);
  const viewer = page.getByTestId("data-model-viewer");
  await viewer.getByRole("searchbox").fill("id");
  await expect(page).toHaveURL(/modelQuery=id/);
  await page.getByTestId("model-fullscreen").click();
  await expect(page).toHaveURL(/expanded=1/);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  const refreshed = page.waitForResponse((r) => r.request().headers().rsc === "1");
  await page.evaluate(() => Reflect.get(Reflect.get(window, "next"), "router").refresh());
  expect((await refreshed).ok()).toBe(true);
  await expect(page).toHaveURL(/\/architecture\?.*modelQuery=id/);
  await expect(page).toHaveURL(/expanded=1/);
  await expect(viewer.getByRole("searchbox").first()).toHaveValue("id");
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
});
