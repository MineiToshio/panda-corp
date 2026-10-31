import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

/** Collect runtime failures while a journey runs: a surface that throws is not verified by structure. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect.soft(overflow).toBeLessThanOrEqual(0);
}

test("FRD-07 catalogs: dialogs return focus, filters and paging hold in a browser", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await gotoHydrated(page, "/configuration/skills", {
    selector: '[data-testid="config-tab-skills"]',
  });
  await expectNoSidewaysScroll(page);
  const row = page.getByRole("button", { name: /pandacorp:implement / });
  await row.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((node) => node.tagName)).toBe("DIALOG");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/configuration\/skills$/);
  await expect(row).toBeFocused();

  await page.getByTestId("config-tab-rules").click();
  await expect(page.getByTestId("config-tab-rules")).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: /^DR-/ }).first().click();
  await expect(page.getByTestId("rule-detail")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectNoSidewaysScroll(page);

  await page.getByTestId("config-tab-standards").click();
  await page.getByRole("button", { name: /Obligatorios/ }).click();
  await page.getByRole("combobox", { name: "Filtrar por dominio" }).selectOption("Quality");
  await expect(page).toHaveURL(/severity=MUST/);
  await expect(page).toHaveURL(/domain=Quality/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Filtrar por dominio" })).toHaveValue("Quality");
  await expectNoSidewaysScroll(page);

  await page.getByTestId("config-tab-agents").click();
  await expect(page.getByTestId("config-tab-agents")).toHaveAttribute("aria-selected", "true");
  await expectNoSidewaysScroll(page);

  await gotoHydrated(page, "/configuration", { selector: '[data-testid="config-tab-summary"]' });
  await page.getByRole("searchbox", { name: "Buscar en toda la configuración" }).fill("quality");
  await expect(page).toHaveURL(/q=quality/);
  await expect(page.getByRole("heading", { name: /Resultados/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /Resultados/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("FRD-07 an unknown item is a 404 surface, never the first item", async ({ page }) => {
  await page.goto("/configuration/skills/no-such-skill");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("config-tab-skills")).toHaveCount(0);
});

test("FRD-10 every tab renders clean, distant eras open in place and survive reload", async ({
  page,
}) => {
  const errors = watchErrors(page);
  for (const tab of ["summary", "missions", "trophies", "statistics", "ranks"]) {
    await gotoHydrated(page, `/achievements/${tab}`, {
      selector: '[data-testid="logros-tab-resumen"]',
    });
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expectNoSidewaysScroll(page);
  }
  const era = page.locator(".rank-era").getByRole("button", { expanded: false }).first();
  await era.click();
  await expect(page).toHaveURL(/eras=/);
  await page.reload();
  await expect(
    page.locator(".rank-era").getByRole("button", { expanded: true }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
