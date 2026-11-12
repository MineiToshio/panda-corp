/**
 * Independent FRD-04 / FRD-11 gate for WO-04-012 (Cambios, Documentos) and WO-11-004 (Comandos),
 * exercised through the real workspace mount on the frozen e2e fixture.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const PROJECT = path.resolve("e2e/fixtures/factory-root/mission-control");
const CHANGES = path.join(PROJECT, ".pandacorp/inbox/changes");
const DONE = path.join(CHANGES, "done");
const CHANGES_URL = "/portfolio/mission-control/changes";
const DOCS_URL = "/portfolio/mission-control/documents";
const COMMANDS_URL = "/portfolio/mission-control/commands";
const PREFIX = "s5c-gate-";

function card(status: string, extra = "", title = `Item ${status}`): string {
  return `---\ntype: change\nstatus: ${status}\ndate: 2026-10-19\nfrd: FRD-01\n${extra}---\n# ${title}\n\n## Qué pasa\n\nCuerpo ${status}.\n`;
}
const FILES: Record<string, string> = {
  [`${PREFIX}ready.md`]: card(
    "ready",
    "class: expedite\nrebuilds_verified: true\ndepends_on: otro\n",
  ),
  [`${PREFIX}draft.md`]: card("draft"),
  [`${PREFIX}building.md`]: card("building"),
  [`${PREFIX}closing.md`]: card("closing"),
  [`${PREFIX}discarded.md`]: card("discarded"),
  [`${PREFIX}raw-date.md`]: card("ready", "", "Fecha rara").replace(
    "2026-10-19",
    "ayer por la tarde",
  ),
  [`${PREFIX}broken.md`]: "---\ntype: change\nstatus: nope\n---\nsin titulo\n",
};
const DONE_FILE = path.join(DONE, `${PREFIX}done.md`);

function clean(): void {
  fs.mkdirSync(CHANGES, { recursive: true });
  for (const name of fs.readdirSync(CHANGES))
    if (name.startsWith(PREFIX)) fs.rmSync(path.join(CHANGES, name));
  fs.rmSync(DONE_FILE, { force: true });
  if (fs.existsSync(DONE) && fs.readdirSync(DONE).length === 0) fs.rmdirSync(DONE);
}
function seed(): void {
  clean();
  for (const [name, body] of Object.entries(FILES))
    fs.writeFileSync(path.join(CHANGES, name), body);
  fs.mkdirSync(DONE, { recursive: true });
  fs.writeFileSync(DONE_FILE, card("done"));
}
const gotoChanges = (page: Page): Promise<void> =>
  gotoHydrated(page, CHANGES_URL, { selector: '[data-testid="changes-panel"]' });
const row = (page: Page, id: string) =>
  page.locator(`[data-testid="change-card"][data-item="${PREFIX}${id}"]`).getByRole("button");

test.describe("Cambios", () => {
  test.beforeEach(seed);
  test.afterEach(clean);

  test("REQ-04-010/011: groups, Historial, fail-loud banner and dates", async ({ page }) => {
    await gotoChanges(page);
    const panel = page.getByTestId("changes-panel");
    await expect(panel.getByText(/1 archivo.*no se pudo interpretar/)).toBeVisible();
    await expect(panel.getByText(`${PREFIX}broken.md`)).toBeVisible();
    await expect(panel.locator("h2, h3")).toHaveText([
      /Listos para construir/,
      /En construcción/,
      /Cerrando/,
      /Borradores/,
      /Pedir un cambio/,
    ]);
    const history = panel.locator("details");
    await expect(history).toHaveCount(1);
    await expect(history).not.toHaveAttribute("open", "");
    await expect(history.locator("summary")).toHaveText(/Historial 2/);
    await expect(row(page, "ready")).toContainText("19 oct. 2026");
    await expect(row(page, "raw-date")).toContainText("ayer por la tarde");
    await expect(page.locator(`[data-item="${PREFIX}ready"]`)).toHaveAttribute(
      "title",
      "2026-10-19",
    );
    await expect(page.getByRole("main")).toHaveCount(1);
  });

  test("REQ-04-010: Descartar is offered for Listo and Borrador only", async ({ page }) => {
    await gotoChanges(page);
    await page.locator("details summary").click();
    for (const [id, offered] of [
      ["ready", true],
      ["draft", true],
      ["building", false],
      ["closing", false],
      ["discarded", false],
      ["done", false],
    ] as const) {
      await row(page, id).click();
      const dialog = page.getByRole("dialog");
      if (id === "building") await expect(dialog).toContainText("/pandacorp:implement --resume");
      else if (id === "ready" || id === "draft")
        await expect(dialog).toContainText(`/pandacorp:implement change:${PREFIX}${id}`);
      else
        await expect(
          dialog.getByRole("button", { name: /^Copiar \/pandacorp:implement/ }),
        ).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Descartar cambio" })).toHaveCount(
        offered ? 1 : 0,
      );
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(row(page, id)).toBeFocused();
    }
  });

  test("rebuild warning, urgency and dependencies are drawn", async ({ page }) => {
    await gotoChanges(page);
    await row(page, "ready").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Rehace trabajo ya verificado")).toBeVisible();
    await expect(dialog.getByText("Urgente")).toBeVisible();
    await expect(dialog.getByText(/Depende de/)).toContainText("otro");
    await expect(dialog.getByText("Cuerpo ready.")).toBeVisible();
  });

  test("discard replaces the detail; Cancel and Escape return to it; focus returns to the card", async ({
    page,
  }) => {
    await gotoChanges(page);
    await row(page, "draft").click();
    for (const leave of ["Cancelar", "Escape"]) {
      await page.getByRole("dialog").getByRole("button", { name: "Descartar cambio" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(page.getByRole("dialog")).toContainText("Motivo");
      await expect(page.getByRole("dialog").getByRole("heading")).toHaveText("Descartar cambio");
      if (leave === "Escape") await page.keyboard.press("Escape");
      else await page.getByRole("button", { name: "Cancelar" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(page.getByTestId("change-detail")).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(row(page, "draft")).toBeFocused();
  });

  test("REQ-04 U4: confirm writes the reason, closes and moves the item to Historial", async ({
    page,
  }) => {
    await gotoChanges(page);
    await row(page, "draft").click();
    await page.getByRole("dialog").getByRole("button", { name: "Descartar cambio" }).click();
    await page.getByLabel("Motivo").fill('ya no: "aplica"');
    await page.getByRole("dialog").getByRole("button", { name: "Descartar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("details summary")).toHaveText(/Historial 3/);
    await expect(page.locator(`[data-item="${PREFIX}draft"]`)).toHaveAttribute(
      "data-status",
      "discarded",
    );
    await expect(page).not.toHaveURL(/change=/);
    const written = fs.readFileSync(path.join(CHANGES, `${PREFIX}draft.md`), "utf8");
    expect(written).toBe(
      FILES[`${PREFIX}draft.md`]?.replace(
        "status: draft\ndate: 2026-10-19\nfrd: FRD-01\n",
        'status: discarded\ndate: 2026-10-19\nfrd: FRD-01\nstatus_before_discard: draft\ndiscard_reason: "ya no: \\"aplica\\""\n',
      ),
    );
  });

  test("an expected failure stays in the confirm with the domain message", async ({ page }) => {
    await gotoChanges(page);
    await row(page, "draft").click();
    await page.getByRole("dialog").getByRole("button", { name: "Descartar cambio" }).click();
    fs.writeFileSync(path.join(CHANGES, `${PREFIX}draft.md`), card("done"));
    await page.getByRole("dialog").getByRole("button", { name: "Descartar", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "ya no se puede descartar",
    );
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("REQ-04-010: a history step never leaves the discard confirm armed for a Hecho item", async ({
    page,
  }) => {
    await gotoChanges(page);
    await row(page, "draft").click();
    await page.getByRole("dialog").getByRole("button", { name: "Descartar cambio" }).click();
    await page.goBack();
    await expect(page).not.toHaveURL(/change=/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.locator("details summary").click();
    await row(page, "done").click();
    await expect(page.getByTestId("change-detail")).toBeVisible();
    await expect(page.getByLabel("Motivo")).toHaveCount(0);
  });
});

test.describe("Documentos", () => {
  const gotoDocs = (page: Page, url = DOCS_URL): Promise<void> =>
    gotoHydrated(page, url, { selector: "article.paper" });
  async function openIndex(page: Page): Promise<void> {
    if ((page.viewportSize()?.width ?? 0) < 900) await page.locator("button.index-toggle").click();
  }

  test("AC-04-014.8: index order, chips with counts, typed paper, N equals the badge", async ({
    page,
  }) => {
    await gotoDocs(page);
    await openIndex(page);
    const groups = await page.locator("nav.doc-index details summary").allTextContents();
    expect(groups.map((text) => text.replace(/\s*\d+$/, "").trim())).toEqual([
      "Producto",
      "Arquitectura y decisiones",
      expect.stringMatching(/^FRD-01/),
      "Work orders",
    ]);
    await expect(page.getByRole("button", { name: /^Todos · \d+/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("article.paper header")).toContainText("docs/product/prd.md");
    const toggle = await page.locator("button.index-toggle").innerText();
    const count = Number(/· (\d+)/.exec(toggle)?.[1]);
    const tab = page.getByRole("tab", { name: /Documentos/ });
    await expect(tab).toContainText(String(count));
  });

  test("AC-04-014.8: type filter and selection are URL state and links keep the workspace", async ({
    page,
  }) => {
    await gotoDocs(page);
    await openIndex(page);
    await page.getByRole("button", { name: /^Work order · 4/ }).click();
    await expect(page).toHaveURL(/doc-type=Work(\+|%20)order/);
    const links = page.locator("nav.doc-index a");
    await expect(links).toHaveCount(4);
    await links.first().click();
    await expect(page).toHaveURL(/\/portfolio\/mission-control\/documents\/.+wo-01-001/);
    await expect(page).toHaveURL(/doc-type=/);
    await expect(page.locator("article.paper header")).toContainText("Work order");
    await page.reload();
    await expect(page.locator("nav.doc-index a")).toHaveCount(4);
  });

  test("AC-04-014.8: search filters by name and typing replaces history", async ({ page }) => {
    await gotoDocs(page);
    await openIndex(page);
    const before = await page.evaluate(() => history.length);
    await page.getByRole("searchbox").pressSequentially("adr");
    await expect(page).toHaveURL(/doc-q=adr/);
    await expect(page.locator("nav.doc-index a")).toHaveCount(1);
    expect(await page.evaluate(() => history.length)).toBe(before);
  });

  for (const [width, folded] of [
    [899, true],
    [900, false],
  ] as const) {
    test(`AC-04-014.8: index placement at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await gotoDocs(page);
      const toggle = page.locator("button.index-toggle");
      const index = page.locator("nav.doc-index");
      if (folded) {
        await expect(toggle).toBeVisible();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(toggle).toContainText(/Elegir documento · \d+/);
        await expect(index).toBeHidden();
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(index).toBeVisible();
      } else {
        await expect(toggle).toBeHidden();
        const paper = await page.locator("article.paper").boundingBox();
        const box = await index.boundingBox();
        expect(box?.x ?? 0).toBeGreaterThan((paper?.x ?? 0) + (paper?.width ?? 0) - 1);
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("an unknown document id keeps the route not-found", async ({ page }) => {
    const response = await page.goto(`${DOCS_URL}/docs/nope`);
    expect(response?.status()).toBe(404);
  });
});

test.describe("Comandos", () => {
  const goto = (page: Page): Promise<void> =>
    gotoHydrated(page, COMMANDS_URL, { selector: '[data-testid="tab-commands-body"]' });

  test("REQ-11-007/009: build and resume are copy-only, legacy preferences are ignored on reload", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem("mc:build-mode:mission-control", "powerful"),
    );
    await goto(page);
    const picker = page.getByTestId("build-mode-picker");
    await expect(picker.getByRole("button", { name: "Construir", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await picker.getByRole("button", { name: "Reanudar", exact: true }).click();
    await expect(
      picker.getByRole("button", { name: "Copiar /pandacorp:implement --resume" }),
    ).toBeVisible();
    await page.reload();
    await expect(picker.getByRole("button", { name: "Construir", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      picker.getByRole("button", { name: "Copiar /pandacorp:implement", exact: true }),
    ).toBeVisible();
  });

  test("REQ-11-008/010: explicit targets exclude WOs and an empty selection has no copy command", async ({
    page,
  }) => {
    await goto(page);
    const picker = page.getByTestId("build-mode-picker");
    await picker.getByRole("button", { name: "Objetivo: FRD o tarjeta" }).click();
    const target = picker.getByRole("combobox", { name: "Objetivo del build" });
    await expect(picker.getByRole("button", { name: /^Copiar/ })).toHaveCount(0);
    await expect(target.locator('option[value^="WO-"]')).toHaveCount(0);
    await target.selectOption("FRD-01");
    await expect(
      picker.getByRole("button", { name: "Copiar /pandacorp:implement FRD-01" }),
    ).toBeVisible();
    await target.selectOption("");
    await expect(picker.getByRole("button", { name: /^Copiar/ })).toHaveCount(0);
    await expect(picker).toContainText("Mission Control nunca lo ejecuta");
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        )
        .toBeLessThanOrEqual(0);
    }
  });
});

test.describe("Responsive floor", () => {
  test.beforeEach(seed);
  test.afterEach(clean);
  for (const url of [CHANGES_URL, DOCS_URL, COMMANDS_URL]) {
    test(`no horizontal overflow at 320 px on ${url}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await gotoHydrated(page, url, { selector: "#content" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
