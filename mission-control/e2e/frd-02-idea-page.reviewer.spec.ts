import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

/**
 * WO-02-016 gate spec (reviewer, DR-080): the idea page in a real browser on both viewports,
 * including the bounded writes the builder's spec stops short of. Viewport-specific assertions
 * read the running project's width, so a correct build passes on desktop and mobile alike.
 */
const IDEAS = path.resolve("e2e/fixtures/factory-root/factory/ideas");
const READY = { selector: '[data-testid="idea-page"]' };

function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 900;
}

async function withCard(slug: string, run: (file: string) => Promise<void>): Promise<void> {
  const file = path.join(IDEAS, `${slug}.md`);
  const original = fs.readFileSync(file, "utf8");
  try {
    await run(file);
  } finally {
    fs.writeFileSync(file, original);
  }
}

test("the page renders clean, with one h1 and no overflow on any tab", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const tab of ["proposal", "spec", "architecture", "documents", "campaign"]) {
    await gotoHydrated(page, `/board/idea-in-pipeline/${tab}`, READY);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("tab", { selected: true })).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, tab).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});

test("axe finds no serious violation on the proposal and documents tabs", async ({ page }) => {
  for (const tab of ["proposal", "documents"]) {
    await gotoHydrated(page, `/board/idea-in-pipeline/${tab}`, READY);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
    expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  }
});

test("AC-02-016.5 header actions share one row on desktop and stay reachable on phones", async ({
  page,
}) => {
  await gotoHydrated(page, "/board/idea-in-pipeline/proposal", READY);
  const back = page.getByRole("link", { name: "Volver al tablero" });
  const open = page.getByRole("link", { name: "Abrir en Portafolio" });
  const discard = page.getByRole("button", { name: "Descartar idea", exact: true });
  await expect(back).toBeVisible();
  await expect(open).toBeVisible();
  await expect(discard).toBeVisible();
  if (!isPhone(page)) {
    const [a, b] = [await back.boundingBox(), await discard.boundingBox()];
    expect(Math.abs((a?.y ?? 0) - (b?.y ?? 99))).toBeLessThan(20);
  }
});

test("AC-02-016.5 the header's links are drawn as its small buttons, above the 24 px floor", async ({
  page,
}) => {
  await gotoHydrated(page, "/board/idea-in-pipeline/proposal", READY);
  const discard = page.getByRole("button", { name: "Descartar idea", exact: true });
  const reference = (await discard.boundingBox())?.height ?? 0;
  for (const name of ["Volver al tablero", "Abrir en Portafolio"]) {
    const link = page.getByRole("link", { name });
    // A flex parent blockifies inline-flex, so the computed value depends on the wrapper.
    await expect(link).toHaveCSS("display", /^(inline-)?flex$/);
    await expect(link).toHaveCSS("border-top-style", "solid");
    expect((await link.boundingBox())?.height ?? 0, name).toBeGreaterThanOrEqual(reference);
    if (isPhone(page)) {
      expect((await link.boundingBox())?.height ?? 0, name).toBeGreaterThanOrEqual(44);
    }
  }
  await page.goto("/board/no-such-idea");
  await expect(page.getByRole("link", { name: "Volver al tablero" })).toHaveCSS(
    "border-top-style",
    "solid",
  );
});

test("AC-02-010.5 both workspace links land on the project's Resumen", async ({ page }) => {
  await gotoHydrated(page, "/board/idea-in-pipeline/campaign", READY);
  await page.getByRole("link", { name: "Entrar a La Fragua" }).click();
  await expect(page).toHaveURL(/\/portfolio\/[^/]+\/summary/);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(/no existe|404/i);
  await gotoHydrated(page, "/board/idea-in-pipeline/proposal", READY);
  await page.getByRole("link", { name: "Abrir en Portafolio" }).click();
  await expect(page).toHaveURL(/\/portfolio\/[^/]+\/summary/);
});

test("AC-02-009.7 the index sits right of the reader from 900 px and folds below it", async ({
  page,
}) => {
  await gotoHydrated(page, "/board/idea-in-pipeline/documents", READY);
  const reader = page.getByTestId("card-detail-doc-reader");
  const resumen = page.getByTestId("card-detail-docs-nav-resumen");
  if (isPhone(page)) {
    await expect(resumen).toBeHidden();
    await page.locator("details.docs-rail > summary").click();
    await expect(resumen).toBeVisible();
    return;
  }
  await expect(resumen).toBeVisible();
  const [left, right] = [await reader.boundingBox(), await resumen.boundingBox()];
  expect(right?.x ?? 0).toBeGreaterThan((left?.x ?? 0) + (left?.width ?? 0) - 1);
});

test("AC-02-009.3 a digest's contract action lands on Documentos with that document", async ({
  page,
}) => {
  await gotoHydrated(page, "/board/idea-in-pipeline/spec", READY);
  await page.getByTestId("spec-frd").first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Contrato/ })
    .click();
  await expect(page).toHaveURL(/\/documents\//);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("card-detail-tab-docs")).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await expect(page.getByTestId("card-detail-tab-docs")).toHaveAttribute("aria-selected", "true");
});

test("REQ-02-007 REQ-02-008 REQ-02-018 discard then restore write through and refresh the page", async ({
  page,
}) => {
  await withCard("idea-discovered", async (file) => {
    await gotoHydrated(page, "/board/idea-discovered/proposal", READY);
    await page.getByRole("button", { name: "Descartar idea", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Descartar idea", exact: true });
    await dialog.getByRole("textbox", { name: "Motivo (opcional)" }).fill("Mercado lleno");
    await dialog.getByRole("button", { name: "Descartar", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Motivo: Mercado lleno")).toBeVisible();
    await expect(page.getByRole("button", { name: "Restaurar", exact: true })).toBeVisible();
    expect(page.url()).not.toContain("Mercado");
    await expect
      .poll(() => fs.readFileSync(file, "utf8"))
      .toContain("discard_reason: Mercado lleno");
    await page.reload();
    await expect(page.getByText("Motivo: Mercado lleno")).toBeVisible();

    await page.getByRole("button", { name: "Restaurar", exact: true }).click();
    const restore = page.getByRole("dialog", { name: "Restaurar idea", exact: true });
    await expect(restore.getByRole("textbox")).toHaveCount(0);
    await restore.getByRole("button", { name: "Restaurar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Descartar idea", exact: true })).toBeVisible();
    await expect.poll(() => fs.readFileSync(file, "utf8")).not.toContain("discard_reason");
  });
});

test("the shipped idea offers no discard and the discarded one no discard either", async ({
  page,
}) => {
  await gotoHydrated(page, "/board/idea-shipped", READY);
  await expect(page.getByRole("button", { name: "Descartar idea", exact: true })).toHaveCount(0);
  await gotoHydrated(page, "/board/idea-discarded", READY);
  await expect(page.getByRole("button", { name: "Descartar idea", exact: true })).toHaveCount(0);
  await expect(page.getByText("Idea descartada")).toBeVisible();
});

test("a legacy board link resolves to the idea route with its selections", async ({ page }) => {
  await page.goto("/board?idea=idea-in-pipeline&boardTab=docs&doc=docs%2Fproduct%2Fprd.md");
  await expect(page).toHaveURL(/\/board\/idea-in-pipeline\/documents\/docs%2Fproduct%2Fprd\.md/);
  await expect(page.getByTestId("card-detail-doc-reader")).toContainText("factory dashboard");
});

test("tab targets meet the 44 px design target", async ({ page }) => {
  await gotoHydrated(page, "/board/idea-in-pipeline/proposal", READY);
  for (const tab of await page.getByRole("tab").all()) {
    expect((await tab.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});
