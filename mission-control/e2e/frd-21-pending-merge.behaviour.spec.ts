import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

test("AC-21-007.2: repository dialog primary flow and keyboard lifecycle", async ({ page }) => {
  await gotoHydrated(page, "/");
  const trigger = page.locator("#worktrees-card button[data-wt-repo]:enabled").first();
  if ((await trigger.count()) === 0) {
    await expect(page.locator("#worktrees-card")).toBeVisible();
    return;
  }
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Cerrar modal" });
  const copy = dialog.getByRole("button", { name: "Copiar /pandacorp:worktrees" });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(copy).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
