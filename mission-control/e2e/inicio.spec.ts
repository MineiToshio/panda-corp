import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

test("AC-18-022.1 AC-18-022.2: Inicio landmarks, narrow reading order and owner dialog focus lifecycle", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await gotoHydrated(page, "/", { selector: '[data-testid="dashboard-page"]' });
  await expect(page.getByRole("heading", { level: 1, name: "Inicio" })).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
  const turn = page.getByRole("heading", { name: /^Tu turno/ });
  const pulse = page.getByRole("heading", { name: "Pulso", exact: true });
  await expect(turn).toBeVisible();
  const turnBox = await turn.boundingBox();
  const pulseBox = await pulse.boundingBox();
  expect(turnBox).not.toBeNull();
  expect(pulseBox).not.toBeNull();
  expect(turnBox?.y).toBeLessThan(pulseBox?.y ?? 0);
  const detail = page.getByRole("button", { name: /^Detalles:/ }).first();
  if (await detail.count()) {
    await expect(
      page
        .locator(".ask-row")
        .first()
        .getByRole("button", { name: /^Copiar / }),
    ).toBeVisible();
    await detail.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: /^Copiar / })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(detail).toBeFocused();
  } else {
    await expect(page.getByText("Nada espera tu acción ahora mismo.")).toBeVisible();
    await expect(page.getByText("Al día", { exact: true }).first()).toBeVisible();
  }
});

test("AC-18-022.3: engine work expands separately from Tu turno", async ({ page }) => {
  await gotoHydrated(page, "/", { selector: '[data-testid="dashboard-page"]' });
  const group = page.locator(".flight-group").first();
  if (await group.count()) {
    await expect(group).not.toHaveAttribute("open");
    await group.locator("summary").click();
    await expect(group).toHaveAttribute("open");
    await expect(group.getByRole("link").first()).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "En marcha", exact: true })).toHaveCount(0);
  }
});
