import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

test("AC-03-008.1 AC-03-008.2: overview, Lista, reload and Back preserve the selected view", async ({
  page,
}) => {
  await gotoHydrated(page, "/portfolio", { selector: '[data-testid="portfolio-overview"]' });
  await expect(page.getByRole("heading", { level: 1, name: "Portafolio" })).toBeVisible();
  await expect(page.locator(".proj-card").first()).toBeVisible();
  await expect(page.getByTestId("portfolio-page-workspace")).toHaveCount(0);
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page).toHaveURL(/view=lista/);
  await expect(page.getByRole("table", { name: "Comparativa de proyectos" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Lista", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Cuentas", exact: true }).click();
  await expect(
    page.getByRole("searchbox", { name: "Buscar servicio, correo o proyecto" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/view=lista/);
  await expect(page.getByRole("table", { name: "Comparativa de proyectos" })).toBeVisible();
});

test("REQ-03-005: project card opens a full-width workspace without overview chrome", async ({
  page,
}) => {
  await gotoHydrated(page, "/portfolio", { selector: '[data-testid="portfolio-overview"]' });
  await page.locator("a.proj-card").first().click();
  await expect(page.getByTestId("portfolio-page-workspace")).toBeVisible();
  await expect(page.getByTestId("portfolio-overview")).toHaveCount(0);
});

test("REQ-03-006: unknown project returns the designed 404", async ({ page }) => {
  const response = await page.goto("/portfolio/no-such-project/summary");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Este proyecto no existe" })).toBeVisible();
  await expect(page.getByText("No hay ningún proyecto «no-such-project».")).toBeVisible();
  await page.getByRole("link", { name: "Ver todos los proyectos" }).click();
  await expect(page).toHaveURL(/\/portfolio$/);
});

test("AC-03-008.2: Lista keeps one comparison row per project at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await gotoHydrated(page, "/portfolio?view=lista", {
    selector: '[data-testid="portfolio-overview"]',
  });
  const table = page.getByRole("table", { name: "Comparativa de proyectos" });
  const row = table.locator("tbody tr").first();
  await expect(row).toHaveCSS("display", "grid");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(row.getByRole("link").first()).toBeVisible();
  await expect(row.locator('[data-label="Decisiones"]')).toBeVisible();
  const bounds = await table.boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(375);
});
