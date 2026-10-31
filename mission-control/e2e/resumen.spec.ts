import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const statusFile = path.resolve("e2e/fixtures/factory-root/mission-control/.pandacorp/status.yaml");
const originalStatus = fs.readFileSync(statusFile, "utf8");

test.beforeEach(() => {
  fs.writeFileSync(statusFile, originalStatus);
});
test.afterEach(() => {
  fs.writeFileSync(statusFile, originalStatus);
});

test("AC-06-020.1 AC-04-014.3: La Fragua heads Resumen with four real stations, token focus and an idle verdict", async ({
  page,
}) => {
  await gotoHydrated(page, "/projects/mission-control/summary", {
    selector: '[data-testid="tab-summary"] button',
  });
  const panel = page.getByTestId("tab-summary");
  const scene = panel.locator("section.fragua");
  await expect(scene).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(panel.getByText("Siguiente paso:")).toBeVisible();
  await expect(scene.getByText("El equipo descansa: no hay un build corriendo.")).toBeVisible();
  await expect(scene.locator("[data-station]")).toHaveCount(4);
  const token = scene.locator("[data-wo]").first();
  await token.focus();
  await expect(scene.getByRole("tooltip")).toBeVisible();
  await expect(scene.getByRole("button", { name: /Demo|Simulación|Pausar|Reiniciar/ })).toHaveCount(
    0,
  );
  await expect(page.getByTestId("snapshot-panel")).toHaveCount(0);
});

test("AC-04-014.5: decision dialog holds context, traps focus and returns it to the row on Escape", async ({
  page,
}) => {
  await gotoHydrated(page, "/projects/mission-control/summary", {
    selector: '[data-testid="tab-summary"] button',
  });
  const opener = page.getByRole("button", { name: /Should we add Playwright e2e tests/ });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Should we add Playwright e2e tests?" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Copiar /pandacorp:decide legacy-1" }),
  ).toBeVisible();
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

test("AC-04-014.6: Tu turno precedes FRD progress in the single-column layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await gotoHydrated(page, "/projects/mission-control/summary", {
    selector: '[data-testid="tab-summary"] button',
  });
  const turn = await page.getByRole("heading", { name: /^Tu turno/ }).boundingBox();
  const progress = await page.getByRole("heading", { name: /^Avance por FRD/ }).boundingBox();
  expect(turn).not.toBeNull();
  expect(progress).not.toBeNull();
  expect(turn?.y).toBeLessThan(progress?.y ?? 0);
});
