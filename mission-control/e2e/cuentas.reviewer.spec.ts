import fs from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const root = path.resolve("e2e/fixtures/factory-root");
const catalog = path.join(root, "factory/services/catalog.yaml");
const accounts = path.resolve(root, "../pandacorp-vault/services/accounts.yaml");
const recipe = {
  type: "Database",
  purpose: "PostgreSQL per project",
  dashboard_url: "https://console.neon.tech",
  reuse_policy: "One account",
  environment_policy: "Branches",
  automation: { methods: ["api"], status: "documented", steps: ["Create"] },
  quota_notes: "Check",
  sources: [{ url: "https://neon.tech/docs", checked_at: "2026-10-19" }],
};
const hasRegistry = (page: Page) =>
  page.getByRole("button", { name: "Detalles: Main account" }).waitFor();

test.describe("Cuentas directory with a real registry", () => {
  test.beforeEach(() => {
    fs.mkdirSync(path.dirname(catalog), { recursive: true });
    fs.mkdirSync(path.dirname(accounts), { recursive: true });
    fs.writeFileSync(
      catalog,
      JSON.stringify({
        schema_version: 1,
        providers: [
          { id: "neon", name: "Neon", adoption: "base", ...recipe },
          { id: "modal", name: "Modal", adoption: "optional", ...recipe },
        ],
      }),
    );
    fs.writeFileSync(
      accounts,
      JSON.stringify({
        schema_version: 1,
        accounts: [
          {
            id: "neon-main",
            provider_id: "neon",
            login_email: "owner@example.com",
            display_name: "Main account",
            access_status: "historical_identity_verified",
            observed_at: "2026-10-19",
            plan: "Free",
            accepting_new_projects: true,
            automation_status: "documented",
            next_step: null,
            notes: null,
          },
        ],
      }),
    );
  });
  test.afterEach(() => {
    fs.rmSync(path.dirname(catalog), { recursive: true, force: true });
    fs.rmSync(path.resolve(root, "../pandacorp-vault"), { recursive: true, force: true });
  });

  test("AC-26-002.1: the legacy alias normalizes and unrelated state survives", async ({
    page,
  }) => {
    await gotoHydrated(page, "/portfolio?portfolioView=accounts&keep=me", { optional: true });
    await expect(page).toHaveURL(/view=cuentas/);
    await expect(page).not.toHaveURL(/portfolioView/);
    await expect(page).toHaveURL(/keep=me/);
    await hasRegistry(page);
  });

  test("AC-26-004.1 AC-26-010.1: dialog by keyboard, Escape, focus return, deep link, no cloud call", async ({
    page,
  }) => {
    const foreign: string[] = [];
    page.on("request", (request) => {
      const api = ["fetch", "xhr", "document"].includes(request.resourceType());
      if (api && !request.url().startsWith("http://127.0.0.1")) foreign.push(request.url());
    });
    await gotoHydrated(page, "/portfolio?view=cuentas", { optional: true });
    await hasRegistry(page);
    const opener = page.getByRole("button", { name: "Detalles: Main account" });
    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(/account=neon%3Aneon-main/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(opener).toBeFocused();
    await page.goto("/portfolio?view=cuentas&account=neon%3Aneon-main");
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(foreign).toEqual([]);
  });

  test("AC-26-005.1: search reaches rows and filter counts stay whole", async ({ page }) => {
    await gotoHydrated(page, "/portfolio?view=cuentas", { optional: true });
    await hasRegistry(page);
    await expect(page.getByRole("button", { name: "Todas 2" })).toBeVisible();
    await page.getByRole("searchbox").fill("OWNER@example");
    await expect(page.getByText("1 cuenta", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Todas 2" })).toBeVisible();
  });

  test("AC-26-010.1 AC-26-011.1: one card per row below 1024 px, the page never scrolls sideways", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await gotoHydrated(page, "/portfolio?view=cuentas", { optional: true });
    await hasRegistry(page);
    const cell = page.locator('td[data-label="Servicio"]').first();
    await expect(cell).toHaveCSS("display", "block");
    await expect(page.locator("thead th").first()).not.toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(cell).toHaveCSS("display", "table-cell");
  });
});
