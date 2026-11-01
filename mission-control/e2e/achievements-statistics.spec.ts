import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { currentFactorySeal } from "../src/lib/achievements/read-model/factorySeal";
import type { StatsFactory } from "../src/lib/achievements/read-model/statsSchema";
import { gotoHydrated } from "./_hydration";

const eventsFile = path.resolve("e2e/fixtures/factory-root/events.ndjson");
const canonicalEvents = execFileSync(
  "git",
  ["show", "HEAD:mission-control/e2e/fixtures/factory-root/events.ndjson"],
  { encoding: "utf8" },
);
const fixtureRoot = path.resolve("e2e/fixtures/factory-root");
const storePath = path.join(fixtureRoot, ".pandacorp/stats-factory.json");
function restoreFixtures(): void {
  fs.writeFileSync(eventsFile, canonicalEvents);
  if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
}
function seedFactoryStore(emptyTransitions = false): void {
  const previousRoot = process.env.PANDACORP_FACTORY_ROOT;
  let seal: string | null;
  try {
    process.env.PANDACORP_FACTORY_ROOT = fixtureRoot;
    seal = currentFactorySeal(fixtureRoot);
  } finally {
    if (previousRoot === undefined) delete process.env.PANDACORP_FACTORY_ROOT;
    else process.env.PANDACORP_FACTORY_ROOT = previousRoot;
  }
  if (!seal) throw new Error("Cannot seal the statistics fixture");
  const store: StatsFactory = {
    seal,
    generatedAt: "2026-10-21T00:20:00Z",
    phaseTransitions: emptyTransitions
      ? []
      : Array.from({ length: 20 }, (_, index) => ({
          project: `Fixture project ${index + 1}`,
          date: "2026-10-20",
          from: "release",
          to: "implementation",
          isReopen: true,
        })),
    scalars: { projects: 5, decisions: 48 },
    lessons: { distilled: 36, captured: 65 },
  };
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store));
}

test.describe("statistics operator report", () => {
  test.beforeEach(() => {
    restoreFixtures();
    // The shared fixture intentionally includes one malformed event for other suites.
    const valid = canonicalEvents.split("\n").filter((line) => {
      if (!line.trim()) return false;
      try {
        JSON.parse(line);
        return true;
      } catch {
        return false;
      }
    });
    fs.writeFileSync(eventsFile, `${valid.join("\n")}\n`);
    seedFactoryStore();
  });
  test.afterEach(restoreFixtures);
  test("AC-10-020.3 AC-10-025.1 AC-10-028.5 report headings, honesty states and copy-only action", async ({
    page,
  }) => {
    await gotoHydrated(page, "/achievements/statistics", {
      selector: '[data-testid="informe-report"] button',
    });
    for (const name of [
      "El pulso de la fábrica",
      "En el tiempo, de verdad",
      "Cómo usas la fábrica",
      "Embudo y flujo",
      "Estado y salud del proceso",
      "Qué mover ahora",
    ])
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    const leadTime = page.getByText("Lead time", { exact: true }).locator("..");
    await expect(leadTime).toContainText("—");
    await expect(leadTime).toContainText("no cableado");
    await expect(page.getByRole("article", { name: "Subagentes", exact: true })).toContainText("0");
    await expect(page.getByRole("article", { name: "Subagentes", exact: true })).not.toContainText(
      "sin datos aún",
    );
    const command = page.getByRole("button", { name: /^Copiar \/pandacorp:/ });
    await expect(command).toHaveCount(1);
    await command.click();
    await expect(page).toHaveURL(/\/achievements\/statistics$/);
  });
  test("AC-10-023.2 AC-10-028.5 transitions reveal ten more per press", async ({ page }) => {
    await gotoHydrated(page, "/achievements/statistics", {
      selector: '[data-testid="informe-report"] button',
    });
    const list = page.getByRole("list", { name: "Transiciones de fase por proyecto" });
    await expect(list.getByRole("listitem")).toHaveCount(10);
    const more = page.getByRole("button", { name: /^Mostrar 10 más · quedan/ });
    await more.click();
    await expect(list.getByRole("listitem")).toHaveCount(20);
  });
  test("AC-10-022.3 malformed events show a coral notice while other report bands survive", async ({
    page,
  }) => {
    const valid = fs.readFileSync(eventsFile, "utf8").trimEnd();
    const lines = valid.split("\n");
    fs.writeFileSync(eventsFile, `${valid}\n${"\n".repeat(213 - lines.length)}not json {\n`);
    await gotoHydrated(page, "/achievements/statistics", {
      selector: '[data-testid="informe-report"] button',
    });
    const notice = page
      .getByRole("alert")
      .filter({ hasText: "No se pudo leer el registro de uso" });
    await expect(notice).toHaveAttribute("data-tone", "coral");
    await expect(notice).toContainText("invalid-json: 214");
    await expect(
      page.getByText("Sin datos: el registro no se pudo leer.", { exact: true }),
    ).toHaveCount(2);
    await expect(
      page.getByRole("heading", { name: "El pulso de la fábrica", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Estado y salud del proceso", exact: true }),
    ).toBeVisible();
  });
  test("stats-transitions-empty recipe keeps the rest of the report visible", async ({ page }) => {
    seedFactoryStore(true);
    await gotoHydrated(page, "/achievements/statistics", {
      selector: '[data-testid="informe-report"] button',
    });
    await expect(page.getByText("Sin transiciones registradas.", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "El pulso de la fábrica", exact: true }),
    ).toBeVisible();
  });
});
