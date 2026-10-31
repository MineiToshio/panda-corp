import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const ledger = path.resolve("e2e/fixtures/factory-root/factory/gamification-ledger.json");
const status = path.resolve("e2e/fixtures/factory-root/mission-control/.pandacorp/status.yaml");
const committedStatus = fs.readFileSync(status, "utf8");
// The ledger stays absent and the tracked project status returns to its committed bytes.
function restoreFixture(): void {
  fs.rmSync(ledger, { force: true });
  fs.writeFileSync(status, committedStatus);
}
test.beforeEach(() => restoreFixture());
test.afterEach(() => restoreFixture());

test("AC-19-005.3 AC-19-005.1: collapsed rail, pointer/focus float and remembered project folding", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoHydrated(page, "/", { selector: '#app[data-hydrated="true"]' });
  const sidebar = page.locator("#sidebar");
  await sidebar.getByRole("button", { name: "Colapsar la barra lateral" }).click();
  await page.mouse.move(1000, 500);
  await expect(page.locator("#app")).toHaveAttribute("data-sidebar", "collapsed");
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(64);
  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-sidebar", "collapsed");
  const content = page.locator("#content");
  const before = await content.boundingBox();
  await sidebar.hover();
  await expect(sidebar).toHaveAttribute("data-float", "true");
  const floating = await content.boundingBox();
  expect(floating?.x).toBe(before?.x);
  expect(floating?.width).toBe(before?.width);
  await page.mouse.move(1000, 500);
  await sidebar.getByRole("link", { name: "Inicio", exact: true }).focus();
  await expect(sidebar).toHaveAttribute("data-float", "true");
  await sidebar.getByRole("button", { name: "Fijar abierta la barra lateral" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-sidebar", "expanded");
  const projects = sidebar.locator('[data-action="toggle-projects"]');
  await projects.click();
  await expect(projects).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(projects).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar.locator("#projlist")).toBeHidden();
});

test("AC-19-005.5 AC-19-005.4: theme overrides system after reload and is available in the phone drawer", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoHydrated(page, "/", { selector: '#app[data-hydrated="true"]' });
  await page.locator("#sidebar").getByRole("button", { name: "Tema claro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(
    page.locator("#sidebar").getByRole("button", { name: "Tema oscuro", exact: true }),
  ).toBeVisible();
});

test("AC-09-008.2: achievement-new oracle double raises once and dismissal survives reload", async ({
  page,
}) => {
  // Durable ledger facts are undated by design; the fixture's dated unlock comes from the
  // project's status date, so moving it two days back makes that trophy fresh.
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  fs.writeFileSync(
    status,
    committedStatus.replace(/^updated_at: .*$/m, `updated_at: "${twoDaysAgo}"`),
  );
  await gotoHydrated(page, "/", { selector: '#app[data-hydrated="true"]' });
  const notice = page.locator(".ach-toast");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("¡Nuevo logro!");
  await expect(notice.getByRole("link", { name: "Ver", exact: true })).toHaveAttribute(
    "href",
    "/achievements/trophies",
  );
  await notice.getByRole("button", { name: "Cerrar aviso" }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await expect(notice).toHaveCount(0);
});
