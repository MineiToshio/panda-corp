import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

test("AC-07-013.1 AC-07-013.2 AC-07-013.3 AC-07-013.4 AC-07-013.5 configuration catalog journey", async ({
  page,
}) => {
  await gotoHydrated(page, "/configuration", { selector: '[data-testid="config-tab-summary"]' });
  await expect(page.getByRole("heading", { name: "Tus comandos" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar en toda la configuración" }).fill("reviewer");
  await expect(page.getByRole("heading", { name: /Resultados/ })).toBeVisible();
  await page.getByRole("tab", { name: /Habilidades/ }).click();
  await page.getByRole("button", { name: /Comandos tuyos/ }).click();
  await page.getByRole("button", { name: /pandacorp:implement / }).click();
  await expect(page.getByRole("dialog").getByText("Comando tuyo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar modal" }).click();
  await page.getByRole("tab", { name: /Agentes/ }).click();
  await page.getByRole("button", { name: /^reviewer / }).click();
  await expect(page.getByRole("dialog")).toContainText("Herramientas:");
  await page.getByRole("button", { name: "Cerrar modal" }).click();
  await page.getByRole("tab", { name: /Reglas de decisión/ }).click();
  await page.getByRole("button", { name: /Requieren tu OK/ }).click();
  await page.getByRole("button", { name: /^DR-/ }).first().click();
  await expect(page.getByTestId("rule-detail")).toBeVisible();
  await page.getByRole("tab", { name: /Estándares/ }).click();
  await page.getByRole("button", { name: /Obligatorios/ }).click();
  await page.getByRole("combobox", { name: "Filtrar por dominio" }).selectOption("Quality");
  await page.reload();
  await expect(page.getByRole("combobox")).toHaveValue("Quality");
});
