import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

test("AC-05-008.4 source summary, full document, reload and filter-preserving return", async ({
  page,
}) => {
  await gotoHydrated(page, "/portfolio/mission-control/observability?view=tablero&wo=WO-01-003", {
    selector: '[role="tablist"][aria-label="Vista de la work order"]',
  });
  await expect(page.getByRole("heading", { name: "De qué trata" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cómo se comprueba" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ficha", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Avance de la work order" })).toBeVisible();
  await page.getByRole("tab", { name: "Documento completo" }).click();
  await expect(page).toHaveURL(/woview=full/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Copiar documento", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Volver", exact: true }).click();
  await expect(page).toHaveURL(/view=tablero/);
  await expect(page).not.toHaveURL(/[?&]wo=/);
});
test("AC-05-008.4 unpublished id stays in Observabilidad", async ({ page }) => {
  await gotoHydrated(page, "/portfolio/mission-control/observability?wo=WO-99-999", {
    selector: "a",
    optional: true,
  });
  await expect(
    page.getByRole("heading", { name: "Esta work order no está publicada" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ver work orders" }).click();
  await expect(page).not.toHaveURL(/[?&]wo=/);
});
