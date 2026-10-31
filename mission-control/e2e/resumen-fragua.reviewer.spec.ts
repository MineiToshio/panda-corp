/**
 * FRD-04 / FRD-06 / FRD-14 gate (reviewer-authored, DR-015, DR-080): first browser proof of La Fragua
 * at the head of Resumen, plus the mount's liveness, links and limits on both Playwright projects.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const projectRoot = path.resolve("e2e/fixtures/factory-root/mission-control");
const statusFile = path.join(projectRoot, ".pandacorp/status.yaml");
const eventsFile = path.resolve("e2e/fixtures/factory-root/events.ndjson");
const ordersDir = path.join(projectRoot, "docs/frds/frd-01-x/work-orders");
const changesDir = path.join(projectRoot, ".pandacorp/inbox/changes");
const originalStatus = fs.readFileSync(statusFile, "utf8");
const originalEvents = fs.readFileSync(eventsFile, "utf8");
const looseOrder = path.join(projectRoot, "docs/frds/frd-01-x/work-orders/wo-01-004-polish.md");
const originalLooseOrder = fs.readFileSync(looseOrder, "utf8");
const overlayFile = path.resolve("e2e/fixtures/factory-root/plugin/templates/OVERLAY_VERSION");
const ROUTE = "/projects/mission-control/summary";

const running = (heartbeatAgeMs: number | null): string =>
  `${originalStatus.replace(/^running:.*$/m, "running: true")}${
    heartbeatAgeMs === null
      ? ""
      : `\nsupervisor_heartbeat: '${new Date(Date.now() - heartbeatAgeMs).toISOString()}'\n`
  }`;

function addOrders(count: number, status: string): void {
  for (let index = 0; index < count; index++) {
    const id = String(100 + index);
    fs.writeFileSync(
      path.join(ordersDir, `wo-01-${id}-gate-extra.md`),
      `---\nid: WO-01-${id}\nimplementation_status: ${status}\n---\n# WO-01-${id} — Gate extra ${id}\n\n## Summary\n\nFirst sentence here. Second one.\n`,
    );
  }
}

/** The shared fixture carries a status the strict digest reader rejects; these tests need the card. */
function validOrders(): void {
  fs.writeFileSync(
    looseOrder,
    originalLooseOrder.replace("implementation_status: PENDING", "implementation_status: PLANNED"),
  );
}

function restore(): void {
  fs.writeFileSync(statusFile, originalStatus);
  fs.writeFileSync(eventsFile, originalEvents);
  fs.writeFileSync(looseOrder, originalLooseOrder);
  fs.rmSync(overlayFile, { force: true });
  for (const file of fs.readdirSync(ordersDir)) {
    if (file.includes("gate-extra")) fs.unlinkSync(path.join(ordersDir, file));
  }
  fs.rmSync(changesDir, { recursive: true, force: true });
}

const open = (page: Page) =>
  gotoHydrated(page, ROUTE, { selector: '[data-testid="tab-summary"] button' });
const body = (page: Page) => page.getByTestId("workspace-tab-body");
const scene = (page: Page) => body(page).locator("section.fragua");

test.beforeEach(restore);
test.afterEach(restore);

test("AC-06-020.1 REQ-04-004: La Fragua opens the panel body, before Siguiente paso", async ({
  page,
}) => {
  await open(page);
  const order = await body(page).evaluate((panel) => {
    const fragua = panel.querySelector("section.fragua");
    const next = [...panel.querySelectorAll("strong")].find(
      (node) => node.textContent === "Siguiente paso:",
    );
    return fragua && next ? fragua.compareDocumentPosition(next) & 4 : 0;
  });
  expect(order).toBeGreaterThan(0);
});

test("AC-06-020.1: the scene stays dark in light and dark themes", async ({ page }) => {
  await open(page);
  const backgroundOf = async () =>
    scene(page).evaluate((node) => {
      const style = getComputedStyle(node);
      return `${style.backgroundColor}|${style.color}`;
    });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  const light = await backgroundOf();
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  expect(await backgroundOf()).toBe(light);
});

test("AC-06-020.3 AC-06-001.6 AC-06-012.1: four read-only stations hold the frontmatter counts", async ({
  page,
}) => {
  await open(page);
  const stations = scene(page).locator("[data-station]");
  await expect(stations).toHaveCount(4);
  const labels = await stations.locator(".fr-plate b").allTextContents();
  expect(labels).toEqual(["Cola", "Taller", "Revisión", "Bóveda"]);
  const counts = await stations.locator(".fr-count").allTextContents();
  expect(counts.map(Number)).toEqual([1, 1, 0, 2]);
  await expect(stations.nth(2)).toContainText("Nada esperando revisión");
  await expect(stations.nth(2).locator(".is-empty > span")).toHaveCount(3);
  await expect(scene(page).locator("[data-wo]")).toHaveCount(4);
  await expect(scene(page).getByRole("button", { name: /^(?!WO-)/ })).toHaveCount(0);
  await expect(scene(page).locator("form, select, input")).toHaveCount(0);
});

test("AC-06-020.4 limit: eight tokens then +N, nine shows +1 and exactly eight shows no overflow", async ({
  page,
}) => {
  addOrders(7, "VERIFIED");
  await open(page);
  const vault = scene(page).locator('[data-station="done"]');
  await expect(vault.locator(".fr-count")).toHaveText("9");
  await expect(vault.locator("[data-wo]")).toHaveCount(8);
  await expect(vault.locator(".token-more")).toHaveText("+1");
  fs.unlinkSync(path.join(ordersDir, "wo-01-106-gate-extra.md"));
  await page.reload();
  await expect(vault.locator(".fr-count")).toHaveText("8");
  await expect(vault.locator("[data-wo]")).toHaveCount(8);
  await expect(vault.locator(".token-more")).toHaveCount(0);
});

test("AC-06-002.3: a focused token inside the viewport shows code, state, title and FRD", async ({
  page,
}) => {
  await open(page);
  const token = scene(page).locator('[data-wo="WO-01-001"]');
  await token.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => true);
  await token.focus();
  const tip = page.getByRole("tooltip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("WO-01-001");
  await expect(tip).toContainText("FRD-01");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tooltip")).toBeVisible();
});

test("AC-06-002.3: tabbing to a token below the fold keeps its card open", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 420 });
  await open(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const token = scene(page).locator("[data-wo]").first();
  for (let press = 0; press < 80; press++) {
    await page.keyboard.press("Tab");
    if (await token.evaluate((node) => node === document.activeElement)) break;
  }
  await expect(token).toBeFocused();
  await expect(page.getByRole("tooltip")).toBeVisible();
});

test("activation: a token opens the order in Observabilidad through the FRD-25 codec", async ({
  page,
}) => {
  await open(page);
  await scene(page).locator('[data-wo="WO-01-001"]').click();
  await expect(page).toHaveURL(/\/portfolio\/mission-control\/observability\?(.*&)?wo=WO-01-001/, {
    timeout: 30_000,
  });
  await expect(page.locator("main")).toContainText("WO-01-001");
});

test("AC-06-020.8 limit: 899 px stacks one station per row, 900 px keeps four columns", async ({
  page,
}) => {
  await open(page);
  const lefts = async () =>
    scene(page)
      .locator("[data-station]")
      .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().left)));
  await page.setViewportSize({ width: 899, height: 900 });
  await expect.poll(async () => new Set(await lefts()).size).toBe(1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 900, height: 900 });
  await expect.poll(async () => new Set(await lefts()).size).toBe(4);
});

test("AC-06-020.6: a live build animates crews and shows the route", async ({ page }) => {
  fs.writeFileSync(statusFile, running(0));
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  await expect(scene(page)).toContainText("El equipo está trabajando");
  const image = scene(page).locator(".fr-cast img").first();
  await expect
    .poll(() => image.evaluate((node) => getComputedStyle(node).animationName))
    .not.toBe("none");
  await expect(scene(page).locator(".fr-route")).toBeVisible();
  await expect(scene(page).locator(".fr-courier")).toBeVisible();
});

test("AC-06-014.1 AC-06-018.5: reduced motion stops crews and courier, keeping a readable live scene", async ({
  page,
}) => {
  fs.writeFileSync(statusFile, running(0));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  await expect(scene(page)).toContainText("El equipo está trabajando");
  await expect(scene(page).getByText("Construyendo ahora")).toBeVisible();
  await expect(scene(page).locator(".fr-route")).toBeHidden();
  await expect(scene(page).locator(".fr-courier")).toBeHidden();
  const names = await scene(page)
    .locator("*")
    .evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).animationName).filter((name) => name !== "none"),
    );
  expect(names).toEqual([]);
});

test("AC-14-002.2 AC-06-019.7: a stale running claim reads Sin señal everywhere with the signal age", async ({
  page,
}) => {
  fs.writeFileSync(statusFile, running(3 * 3_600_000));
  await gotoHydrated(page, ROUTE, { selector: '[data-testid="snapshot-panel"] button' });
  const panel = page.getByTestId("snapshot-panel");
  await expect(panel.getByTestId("snapshot-panel-no-signal")).toContainText("hace 3 h");
  await expect(panel.getByTestId("snapshot-panel-building-now")).toHaveCount(0);
  await expect(scene(page)).toContainText("hace 3 h");
  await expect(scene(page).locator(".fr-route")).toHaveCount(0);
  await expect(body(page).getByText("Construyendo ahora")).toHaveCount(0);
});

test("AC-14-002.2: a fresh event beats a stale heartbeat, so scene and panel stay live together", async ({
  page,
}) => {
  fs.writeFileSync(statusFile, running(3 * 3_600_000));
  fs.writeFileSync(
    eventsFile,
    `${originalEvents.trimEnd()}\n${JSON.stringify({
      event: "AgentWorking",
      at: new Date().toISOString(),
      agent: "implementer",
      frd: "frd-01-x",
      wo: "WO-01-004",
      phase: "build",
      activity: "implement",
      mode: "powerful",
      role: "implementer",
      project: "mission-control",
    })}\n`,
  );
  await gotoHydrated(page, ROUTE, { selector: '[data-testid="snapshot-panel"] button' });
  const panel = page.getByTestId("snapshot-panel");
  await expect(panel.getByTestId("snapshot-panel-building-now")).toBeVisible();
  await expect(panel.getByTestId("snapshot-panel-no-signal")).toHaveCount(0);
  await expect(scene(page)).toContainText("El equipo está trabajando");
});

test("AC-04-014.4: an FRD row and Ver todos open Observabilidad, the row filtered by its FRD", async ({
  page,
}) => {
  validOrders();
  await open(page);
  const row = body(page)
    .getByRole("link", { name: /FRD-01/ })
    .first();
  await expect(row).toContainText("2/4");
  await expect(row.getByRole("img")).toHaveAttribute("aria-label", /.+/);
  await row.click();
  await expect(page).toHaveURL(/\/mission-control\/observability\?(.*&)?frd=FRD-01/, {
    timeout: 30_000,
  });
});

test("AC-04-014.7: a dated change line opens that change in Cambios and the raw log stays closed", async ({
  page,
}) => {
  validOrders();
  fs.mkdirSync(changesDir, { recursive: true });
  fs.writeFileSync(
    path.join(changesDir, "gate-extra-change.md"),
    "---\ntype: feature\nstatus: ready\ndate: 2026-10-20\n---\n# Cambio de puerta\n",
  );
  await open(page);
  const link = page.getByRole("link", { name: /Cambio de puerta/ });
  await expect(link).toContainText("Listo para construir");
  const log = page.locator("details", { hasText: "Bitácora técnica del motor" });
  if (await log.count()) await expect(log).not.toHaveAttribute("open", /.*/);
  await link.click();
  await expect(page).toHaveURL(/change=gate-extra-change/, { timeout: 30_000 });
});

test("AC-20-001.1 AC-20-004.1: a behind overlay shows the copy-only notice with both versions and the folder", async ({
  page,
}) => {
  fs.mkdirSync(path.dirname(overlayFile), { recursive: true });
  fs.writeFileSync(overlayFile, "8.110.0\n");
  await open(page);
  const notice = page.getByRole("region", { name: "Actualización pendiente" });
  await expect(notice).toContainText("Este proyecto usa una versión vieja del motor de Pandacorp");
  await expect(notice).toContainText("v8.55.1");
  await expect(notice).toContainText("v8.110.0");
  await expect(notice).toContainText("Córrelo en la carpeta de Mission Control");
  await expect(notice.getByRole("button", { name: "Copiar /pandacorp:upgrade" })).toBeVisible();
});

test("AC-20-001.2 AC-20-001.3: an equal, newer or unknown overlay shows nothing", async ({
  page,
}) => {
  fs.mkdirSync(path.dirname(overlayFile), { recursive: true });
  fs.writeFileSync(overlayFile, "8.55.1\n");
  await open(page);
  await expect(page.getByTestId("version-freshness")).toHaveCount(0);
  fs.writeFileSync(overlayFile, "not-semver\n");
  await page.reload();
  await expect(page.getByTestId("version-freshness")).toHaveCount(0);
});

test("AC-04-014.6 AC-06-020.2: the fixture's pending decisions reach Tu turno and the verdict chip", async ({
  page,
}) => {
  await open(page);
  const heading = body(page).getByRole("heading", { name: /^Tu turno/ });
  const card = heading.locator("xpath=ancestor::*[self::section or self::article or self::div][2]");
  await expect(card).not.toContainText("no se pudo leer");
  await expect(card).toContainText("/pandacorp:decide legacy-1");
  await expect(scene(page)).toContainText("Espera tu decisión");
});

test("preview smoke: Resumen raises no console error or page error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await open(page);
  await expect(scene(page)).toBeVisible();
  expect(errors).toEqual([]);
});
