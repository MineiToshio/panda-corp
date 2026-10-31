import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

test("AC-02-016.1 AC-02-016.2 AC-02-016.3 AC-02-016.4 board filters, phase jumps and browser preference", async ({
  page,
}) => {
  await gotoHydrated(page, "/board", { selector: '[role="switch"]' });
  await expect(page.getByTestId("idea-board").getByRole("heading", { level: 2 })).toHaveCount(6);
  const search = page.getByRole("searchbox");
  await search.fill("not-a-real-idea");
  await expect(page.getByText("0 ideas coinciden")).toBeVisible();
  await expect(page.getByTestId("idea-card")).toHaveCount(0);
  await search.fill("code review");
  await expect(page.getByRole("link", { name: "AI-powered code review tool" })).toBeVisible();
  await page.getByRole("button", { name: "Limpiar" }).click();
  const categories = page.getByRole("group", { name: "Filtrar por categoría" }).getByRole("button");
  await categories.nth(1).click();
  await expect(categories.nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Limpiar" }).click();
  await page.getByRole("navigation", { name: "Ir a una fase" }).getByRole("button").last().click();
  await expect(page.getByTestId("board-column-shipped")).toBeInViewport();
  const allColumns = await page.locator(".kcol").count();
  const emptyColumns = await page.locator(".kcol.is-empty").count();
  await page.getByRole("switch").click();
  await page.reload();
  await expect(page.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".kcol")).toHaveCount(allColumns - emptyColumns);
});

for (const [trigger, title] of [
  ["Capturar ideas", "Capturar ideas"],
  ["Descartadas", "Ideas descartadas"],
]) {
  test(`dialog ${title} traps focus and returns it on Escape`, async ({ page }) => {
    await gotoHydrated(page, "/board", { selector: '[role="switch"]' });
    const opener = page.getByRole("button", { name: new RegExp(`^${trigger}( · [0-9]+)?$`) });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: new RegExp(`^${title}( · [0-9]+)?$`) });
    await expect(dialog).toBeVisible();
    const controls = dialog.locator("button, a[href]");
    await controls.last().focus();
    await page.keyboard.press("Tab");
    await expect(controls.first()).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(controls.last()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
  });
}

test("AC-02-012.3 AC-02-012.4 star flips without moving a card", async ({ page }) => {
  await gotoHydrated(page, "/board", { selector: '[role="switch"]' });
  const star = page.getByTestId("favorite-button").first();
  const initial = await star.getAttribute("aria-pressed");
  const column = star.locator('xpath=ancestor::section[contains(@class, "kcol")]');
  const columnId = await column.getAttribute("id");
  // The write re-serialises the frontmatter: restore the tracked fixture byte for byte.
  const fixture = path.resolve("e2e/fixtures/factory-root/factory/ideas/idea-discovered.md");
  const original = fs.readFileSync(fixture);
  try {
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", initial === "true" ? "false" : "true");
    await expect(column).toHaveAttribute("id", columnId ?? "");
  } finally {
    await expect(star).toBeEnabled();
    if ((await star.getAttribute("aria-pressed")) !== initial) await star.click();
    await expect(star).toHaveAttribute("aria-pressed", initial ?? "false");
    await expect(star).toBeEnabled();
    fs.writeFileSync(fixture, original);
  }
});
