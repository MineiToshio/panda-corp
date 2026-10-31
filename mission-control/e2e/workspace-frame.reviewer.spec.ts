import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const WORKSPACE = "/projects/mission-control";
const TABBAR = { selector: '[data-testid="tabbar"]' };
const SINGLE_MAIN_TABS = [
  "spec",
  "observability",
  "architecture",
  "accounts",
  "changes",
  "documents",
];

test("WO-04-010: the /projects/<slug> alias settles server-side and keeps keyboard focus", async ({
  page,
}) => {
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest()) documents.push(request.url());
  });
  await gotoHydrated(page, WORKSPACE, TABBAR);
  await expect(page).toHaveURL(/\/projects\/mission-control\/summary$/);
  const tab = page.getByRole("tab", { name: "Resumen" });
  await tab.focus();
  await page.waitForLoadState("networkidle");
  await expect(tab).toBeFocused();
  await expect(page.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/\/summary$/);
  expect(documents.filter((url) => url.endsWith("/summary"))).toHaveLength(1);
});

test("WO-04-010: the project switcher dialog survives the alias landing", async ({ page }) => {
  await gotoHydrated(page, WORKSPACE, TABBAR);
  await page.getByRole("button", { name: "Cambiar proyecto" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("input").first()).toBeFocused();
});

test("AC-25-004.1: alias redirects leave no extra history entry", async ({ page }) => {
  await gotoHydrated(page, "/portfolio/mission-control/commands", TABBAR);
  await page.goto(`${WORKSPACE}?tab=party`);
  await expect(page).toHaveURL(/\/projects\/mission-control\/summary$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/portfolio\/mission-control\/commands/);
});

test("AC-25-008.1: an unknown section with an encoded character shows the unknown card", async ({
  page,
}) => {
  await gotoHydrated(page, `${WORKSPACE}/foo%20bar`, TABBAR);
  await expect(page.getByTestId("project-hero-compact")).toBeVisible();
  await expect(page.getByTestId("workspace-tab-body").getByRole("link")).toBeVisible();
});

for (const tab of SINGLE_MAIN_TABS) {
  test(`AC-19-001.5: ${tab} has one main landmark and no page overflow`, async ({ page }) => {
    await gotoHydrated(page, `${WORKSPACE}/${tab}`, TABBAR);
    await expect(page.getByRole("main")).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("AC-12-006.4: tab clicks walk history and the selected tab stays in view", async ({
  page,
}) => {
  await gotoHydrated(page, `${WORKSPACE}/summary`, TABBAR);
  await page.getByRole("tab", { name: "Comandos" }).click();
  await expect(page).toHaveURL(/\/commands$/);
  await expect(page.getByRole("tab", { name: "Comandos" })).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL(/\/summary$/);
  await expect(page.getByTestId("project-hero")).toBeVisible();
});

test("AC-25-008.1: the portfolio family keeps an encoded unknown section stable", async ({
  page,
}) => {
  await gotoHydrated(page, "/portfolio/mission-control/foo%20bar", TABBAR);
  await expect(page.getByTestId("workspace-tab-body").getByRole("link")).toBeVisible();
  const settled = page.url();
  await page.waitForLoadState("networkidle");
  expect(page.url()).toBe(settled);
  expect(settled).not.toContain("%25");
});

test("REQ-04-002: an unknown section keeps the tab strip keyboard reachable", async ({ page }) => {
  await gotoHydrated(page, `${WORKSPACE}/bogus`, TABBAR);
  await expect(page.locator('[data-testid="tabbar"] [role="tab"][tabindex="0"]')).toHaveCount(1);
});
