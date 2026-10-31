import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

test("AC-10-028.1 AC-10-028.4 summary links onward and distant eras expand persistently", async ({
  page,
}) => {
  await gotoHydrated(page, "/achievements", { selector: '[data-testid="logros-tab-resumen"]' });
  await expect(page.getByRole("heading", { name: "Tu siguiente rango" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver todas las estadísticas" })).toHaveAttribute(
    "href",
    "/achievements/statistics",
  );
  await page.getByRole("link", { name: "Ver el escalafón" }).click();
  await expect(page).toHaveURL(/\/achievements\/ranks$/);
  await gotoHydrated(page, "/achievements/ranks", {
    selector: '#app[data-hydrated="true"]',
  });
  const era = page.getByRole("tabpanel").getByRole("button", { expanded: false }).first();
  const name = (await era.innerText()).replace(/\s+/g, " ").trim();
  await era.click();
  await expect(page).toHaveURL(/eras=/);
  await page.reload();
  await expect(page.getByRole("button", { name, expanded: true })).toBeVisible();
});

test("AC-10-028.2 AC-10-028.3 missions, category filters, trophy dialog and paged locked trophies", async ({
  page,
}) => {
  await gotoHydrated(page, "/achievements/missions", {
    selector: '[data-testid="logros-tab-misiones"]',
  });
  await expect(page.getByRole("tab", { name: "Misiones", selected: true })).toBeVisible();
  await expect(page.getByRole("progressbar").first()).toBeVisible();
  await page.getByRole("tab", { name: /Trofeos/ }).click();
  const category = page.getByRole("group", { name: "Categoría" });
  await category.getByRole("button", { name: /Descubrimiento/ }).click();
  await expect(page).toHaveURL(/category=Discovery/);
  await category.getByRole("button", { name: /^Todos/ }).click();
  const tile = page.locator("[data-trophy]").first();
  await tile.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(tile).toBeFocused();
  const more = page.getByRole("button", { name: /^Mostrar \d+ más · quedan/ });
  await expect(more).toBeVisible();
  const count = await page.locator("[data-trophy]").count();
  await more.click();
  await expect(page.locator("[data-trophy]")).toHaveCount(count + 24);
});
