import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const HYDRATED = { selector: '#app[data-hydrated="true"]' };
async function open(page: Page, width: number, route = "/"): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await gotoHydrated(page, route, HYDRATED);
}

test("AC-09-008.1: the tablet rail reduces the guild card to the crest", async ({ page }) => {
  await open(page, 900);
  const card = page.locator("aside#sidebar .guildcard");
  await expect(card.locator(".crest")).toBeVisible();
  await expect(card.locator(".gtext")).toBeHidden();
  await expect(card.locator('[role="progressbar"]')).toBeHidden();
});

test("AC-19-003.1: the collapse control exists from 1180 px and not below", async ({ page }) => {
  await open(page, 1180);
  const control = page.getByRole("button", { name: "Colapsar la barra lateral", exact: true });
  await expect(control).toBeVisible();
  expect((await page.locator("aside#sidebar").boundingBox())?.width).toBe(252);
  await page.setViewportSize({ width: 1179, height: 900 });
  await expect(control).toHaveCount(0);
  expect((await page.locator("aside#sidebar").boundingBox())?.width).toBe(76);
  await expect(page.getByTestId("app-nav-documentacion").locator(".mini")).toHaveText("Docs");
});

test("AC-19-005.3: a saved rail is painted before hydration", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("orbita-sidebar", "collapsed"));
  await page.route("**/_next/static/**/*.js*", (route) => route.abort());
  await page.goto("/manual", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-sidebar-pref", "collapsed");
  expect((await page.locator("aside#sidebar").boundingBox())?.width).toBe(64);
});

test("AC-19-005.3: the float covers the page, keeps the content still and leaves on exit", async ({
  page,
}) => {
  await open(page, 1440);
  await page.getByRole("button", { name: "Colapsar la barra lateral", exact: true }).click();
  await page.mouse.move(1000, 500);
  const sidebar = page.locator("aside#sidebar");
  await expect(sidebar).toHaveAttribute("data-float", "false");
  const before = await page.locator("#content").boundingBox();
  await sidebar.hover({ position: { x: 20, y: 300 } });
  await expect(sidebar).toHaveAttribute("data-float", "true");
  expect((await sidebar.boundingBox())?.width).toBe(252);
  expect(await page.locator("#content").boundingBox()).toEqual(before);
  const onTop = await page.evaluate(
    () => !!document.elementFromPoint(200, 300)?.closest("#sidebar"),
  );
  expect(onTop).toBe(true);
  await page.mouse.move(1000, 500);
  await expect(sidebar).toHaveAttribute("data-float", "false");
  expect((await sidebar.boundingBox())?.width).toBe(64);
});

test("AC-19-005.2: the Inicio dot shows only on the rails", async ({ page }) => {
  await open(page, 1440);
  const dot = page.getByTestId("inicio-rail-dot");
  const count = page.getByTestId("app-nav-inicio").locator(".count");
  await expect(dot).toBeHidden();
  await expect(count).toBeVisible();
  await page.getByRole("button", { name: "Colapsar la barra lateral", exact: true }).click();
  await page.mouse.move(1000, 500);
  await expect(dot).toBeVisible();
  await expect(count).toBeHidden();
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(dot).toBeVisible();
});

test("AC-21-008.1: from another route the pill opens Inicio at its card", async ({ page }) => {
  await open(page, 1280, "/board");
  await page.locator("aside#sidebar .pending-pill").click();
  await expect.poll(() => new URL(page.url()).hash).toBe("#worktrees-card");
  const card = page.locator("#worktrees-card");
  await expect(card).toBeInViewport();
  await expect(card).toContainText("Árboles de trabajo");
});
