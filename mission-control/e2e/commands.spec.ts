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

test("AC-11-005.2: command cards remember project mode and scope all three target kinds", async ({
  page,
}) => {
  await gotoHydrated(page, "/portfolio/mission-control/commands", {
    selector: '[data-testid="tab-commands-body"]',
  });
  for (const name of [
    "Siguiente paso",
    "Modo de construcción",
    "Construir un objetivo concreto",
    "Cambios y decisiones",
  ]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /Equilibrado/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /Potente/ }).click();
  await expect(
    page.getByRole("button", { name: "Copiar /pandacorp:implement powerful", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Potente/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const target = page.getByRole("combobox", { name: "Objetivo del build" });
  for (const value of ["FRD-01", "WO-01-003", "change:s5c-commands-target"]) {
    await target.selectOption(value);
    await expect(
      page.getByRole("button", { name: `Copiar /pandacorp:implement ${value}`, exact: true }),
    ).toBeVisible();
  }
  await target.selectOption("");
  await expect(
    page.getByRole("button", { name: "Copiar /pandacorp:implement <id>", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Los comandos se copian para pegarlos en Claude Code. Mission Control nunca los ejecuta.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
});
