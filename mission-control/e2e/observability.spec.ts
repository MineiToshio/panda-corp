import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

// The shell's boot-time Server Action refresh can drop a router.push issued in the same instant.
async function clickUntilUrl(page: Page, click: () => Promise<unknown>, url: RegExp) {
  await expect(async () => {
    await click();
    await expect(page).toHaveURL(url, { timeout: 2000 });
  }).toPass({ timeout: 30_000 });
}

test("AC-05-008.1 AC-05-008.2 AC-12-002.3 URL views, filters, expand-all, reload and Back", async ({
  page,
}) => {
  await gotoHydrated(page, "/portfolio/mission-control/observability", { selector: ".seg button" });
  await expect(page.getByRole("button", { name: "Por FRD", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".frd-row[open]")).toHaveCount(0);
  await page.getByRole("button", { name: "Expandir todo" }).click();
  await expect(page.locator(".frd-row[open]").first()).toBeVisible();
  await clickUntilUrl(
    page,
    () => page.getByRole("button", { name: "Tablero", exact: true }).click(),
    /view=tablero/,
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Tablero", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Dependencias", exact: true }).click();
  await expect(page).toHaveURL(/view=deps/);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Tablero", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Por FRD", exact: true }).click();
  await expect(page).not.toHaveURL(/view=/);
  await page.getByRole("button", { name: /^En curso/ }).click();
  await expect(page).toHaveURL(/state=in_progress/);
  await expect(page.locator(".frd-row[open]").first()).toBeVisible();
  await page.getByRole("combobox", { name: "Filtrar por FRD" }).selectOption("FRD-01");
  await expect(page).toHaveURL(/frd=FRD-01/);
  await page.locator(".worow").first().click();
  await expect(page).toHaveURL(/wo=WO-/);
  await expect(page.getByRole("tab", { name: "Documento completo" })).toBeVisible();
});
test("AC-12-006.1 dependency folder-slug deep link survives validation and reload", async ({
  page,
}) => {
  await gotoHydrated(
    page,
    "/portfolio/mission-control/observability?view=deps&dag=wo&frd=frd-01-x&focus=WO-01-003",
    { selector: ".seg button" },
  );
  await expect(page.getByRole("heading", { name: "Grafo de dependencias" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Grafo de dependencias" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir work order", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Documento completo" })).toBeVisible();
});
