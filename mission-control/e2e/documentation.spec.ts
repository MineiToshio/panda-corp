import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

test("AC-08-020.1 AC-08-020.2 AC-08-020.3 home, full-text search, reader, tutorial and folded index", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoHydrated(page, "/manual", { selector: '[data-testid="manual-shell"]' });
  await expect(page.getByRole("heading", { name: "Empieza aquí" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar en toda la Documentación" }).fill("pipeline");
  await page
    .getByTestId("docs-results")
    .getByRole("link", { name: /^El pipeline/ })
    .click();
  await expect(page.getByTestId("doc-reader-authored")).toBeVisible();
  await expect(page.getByRole("link", { name: /Anterior en Conceptos/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Índice de la Documentación" })).toBeVisible();
  await gotoHydrated(page, "/manual/tutorial/como-empezar", {
    selector: '[data-testid="doc-reader-authored"]',
  });
  await expect(page.getByRole("progressbar", { name: "Paso 2 de 2 del tutorial" })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  const toggle = page.getByRole("button", { name: /Índice ·/ });
  await expect(toggle).toBeVisible();
  await toggle.click();
  const index = page.getByRole("navigation", { name: "Índice de la Documentación" });
  await expect(index).toBeVisible();
  await index.getByRole("searchbox").focus();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(index).toBeHidden();
  await gotoHydrated(page, "/manual/concepts/no-existe", {
    selector: '[data-testid="manual-shell"]',
  });
  await expect(page.getByText("Esta página no existe")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir al inicio de la Documentación" })).toBeVisible();
});
