import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

let restorePortfolio: (() => void) | undefined;
test.afterEach(() => {
  restorePortfolio?.();
  restorePortfolio = undefined;
});

test("AC-26-001.1 AC-26-002.1 AC-26-005.1 AC-26-007.1 AC-26-010.1: directory with a missing registry retains URL filters and search", async ({
  page,
}) => {
  const portfolio = path.resolve("e2e/fixtures/factory-root/factory/portfolio.md");
  const original = fs.readFileSync(portfolio);
  restorePortfolio = () => fs.writeFileSync(portfolio, original);
  fs.writeFileSync(portfolio, "# Portfolio\n");
  await gotoHydrated(page, "/portfolio?view=cuentas&keep=accounts", { optional: true });
  await expect(
    page.getByRole("searchbox", { name: "Buscar servicio, correo o proyecto" }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "Información incompleta o inválida" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Candidatos \d+/ }).click();
  await expect(page).toHaveURL(/accountsState=candidates/);
  await page.reload();
  await expect(page.getByRole("button", { name: /^Candidatos \d+/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /^Todas \d+/ }).click();
  await page.goBack();
  await expect(page.getByRole("button", { name: /^Candidatos \d+/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("searchbox").fill("no-such-account");
  await expect(page.getByText("No hay coincidencias para esta búsqueda.")).toBeVisible();
  await expect(page).toHaveURL(/keep=accounts/);
});
