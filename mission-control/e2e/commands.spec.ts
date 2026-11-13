import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const changes = path.resolve("e2e/fixtures/factory-root/mission-control/.pandacorp/inbox/changes");
const fixture = path.join(changes, "s5c-commands-target.md");
const fixtureBody = "---\ntype: change\nstatus: ready\n---\n# Commands target fixture\n";

// Repair a previous interrupted run before setup, and always restore in teardown.
function restoreFixture(): void {
  if (fs.existsSync(fixture)) fs.unlinkSync(fixture);
}
test.beforeEach(() => {
  restoreFixture();
  fs.mkdirSync(changes, { recursive: true });
  fs.writeFileSync(fixture, fixtureBody);
});
test.afterEach(() => {
  restoreFixture();
});

// AC-11-005.2 is superseded by AC-11-007 to -009: transient action + FRD/card scope.
test("AC-11-005.2 → AC-11-007/008/009: command cards reset and scope FRD/card targets", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("mc:build-mode:mission-control", "powerful");
  });
  await gotoHydrated(page, "/portfolio/mission-control/commands", {
    selector: '[data-testid="build-mode-picker"]',
  });
  for (const name of ["Siguiente paso", "Construir o reanudar", "Cambios y decisiones"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  const picker = page.getByTestId("build-mode-picker");
  await expect(picker.getByRole("button", { name: "Construir", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    picker.getByRole("button", { name: "Copiar /pandacorp:implement", exact: true }),
  ).toBeVisible();
  await picker.getByRole("button", { name: "Reanudar", exact: true }).click();
  await expect(
    picker.getByRole("button", { name: "Copiar /pandacorp:implement --resume", exact: true }),
  ).toBeVisible();
  await picker.getByRole("button", { name: "Objetivo: FRD o tarjeta", exact: true }).click();
  const target = picker.getByRole("combobox", { name: "Objetivo del build" });
  await expect(target.locator('option[value^="WO-"]')).toHaveCount(0);
  await expect(picker.getByRole("button", { name: /^Copiar / })).toHaveCount(0);
  for (const value of ["FRD-01", "change:s5c-commands-target"]) {
    await target.selectOption(value);
    await expect(
      picker.getByRole("button", { name: `Copiar /pandacorp:implement ${value}`, exact: true }),
    ).toBeVisible();
  }
  await target.selectOption("");
  await expect(picker.getByRole("button", { name: /^Copiar / })).toHaveCount(0);
  await target.selectOption("change:s5c-commands-target");
  await page.reload();
  await expect(picker.getByRole("button", { name: "Construir", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(picker.getByRole("combobox")).toHaveCount(0);
  await expect(
    picker.getByText("Copia el comando y pégalo en tu sesión. Mission Control nunca lo ejecuta."),
  ).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
});
