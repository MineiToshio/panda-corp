import fs from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

// Reviewer-authored (DR-080). Items and files are created per test and always removed, with ids of
// the 95xx range so they can never collide with the BL-90*/LESSON-90* fixtures of the behaviour specs.
const backlog = path.resolve("e2e/fixtures/factory-root/factory/backlog");
const memory = path.resolve("e2e/fixtures/factory-root/factory/memory");
const planted: string[] = [];

function plant(file: string, content: string): string {
  fs.writeFileSync(file, content);
  planted.push(file);
  return file;
}
function item(id: string, patch: Record<string, string> = {}): string {
  const fields = {
    id,
    type: "bug",
    status: "open",
    area: "hooks",
    severity: "p0",
    title: `Gate ${id}`,
    ...patch,
  };
  const front = Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  return plant(path.join(backlog, `${id}.md`), `---\n${front}\n---\n## Problem\nGate issue.\n`);
}
test.afterEach(() => {
  for (const file of planted.splice(0)) fs.rmSync(file, { force: true });
});
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}
const panel = '[data-testid="backlog-panel"]';

test("AC-22-005.1 Escape closes the item dialog and returns focus to its row", async ({ page }) => {
  item("BL-9501");
  await gotoHydrated(page, "/proposals/backlog", { selector: panel });
  const row = page.getByRole("button", { name: "BL-9501 · Gate BL-9501" });
  await row.click();
  await expect(page).toHaveURL(/\/proposals\/backlog\/BL-9501$/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/proposals\/backlog$/);
  await expect(row).toBeFocused();
});

test("AC-22-007.1 AC-22-007.2 AC-22-007.3 a real discard closes the dialog, moves the row and keeps the file bounded", async ({
  page,
}) => {
  const file = item("BL-9502");
  const errors = trackErrors(page);
  await gotoHydrated(page, "/proposals/backlog/BL-9502", { selector: "dialog" });
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await page.getByLabel("Motivo (opcional)").fill("  gate reason  ");
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const text = fs.readFileSync(file, "utf8");
  expect(text).toContain('status: "discarded"');
  expect(text).toContain('status_before_discard: "open"');
  expect(text).toContain('discard_reason: "gate reason"');
  expect(text).toContain("## Problem\nGate issue.");
  await page.getByText("Hechos y descartados").click();
  await expect(page.getByRole("button", { name: "BL-9502 · Gate BL-9502" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("AC-22-007.1 a discard from a pasted item location leaves that location, so reload stays closed", async ({
  page,
}) => {
  item("BL-9510");
  await gotoHydrated(page, "/proposals/backlog/BL-9510", { selector: "dialog" });
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/proposals\/backlog$/);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("AC-22-007.1 a discard opened from its row leaves the item location and reload stays closed", async ({
  page,
}) => {
  item("BL-9509");
  await gotoHydrated(page, "/proposals/backlog", { selector: panel });
  await page.getByRole("button", { name: "BL-9509 · Gate BL-9509" }).click();
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/proposals\/backlog$/);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("AC-22-007.1 a raced discard shows the typed failure inline and keeps the typed reason", async ({
  page,
}) => {
  const file = item("BL-9503");
  await gotoHydrated(page, "/proposals/backlog/BL-9503", { selector: "dialog" });
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await page.getByLabel("Motivo (opcional)").fill("keep me");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("status: open", "status: done"));
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("BL-9503");
  await expect(page.getByLabel("Motivo (opcional)")).toHaveValue("keep me");
  await expect(page.getByLabel("Motivo (opcional)")).toHaveAttribute("aria-invalid", "true");
});

test("AC-22-002.4 the Resumen link to the backlog keeps the backlog filters like the tab does", async ({
  page,
}) => {
  item("BL-9504");
  item("BL-9505", { severity: "p1" });
  await gotoHydrated(page, "/proposals/backlog", { selector: panel });
  const tile = page.getByRole("button", { name: /P0 · urgente/ });
  await tile.click();
  await page.getByTestId("proposals-tab-resumen").click();
  await page.getByRole("link", { name: "Ver el backlog por tema" }).click();
  await expect(page).toHaveURL(/\/proposals\/backlog$/);
  await expect(page.getByRole("button", { name: /P0 · urgente/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("CMP-17-routes unknown locations are bounded not-founds, never another record", async ({
  request,
}) => {
  for (const location of [
    "/proposals/nope",
    "/proposals/resumen/extra",
    "/proposals/backlog/BL-9999",
    "/proposals/backlog/BL-0001/extra",
    "/proposals/memory/nope",
    "/proposals/memory/promotions/LESSON-9999",
    "/proposals/memory/prune/LESSON-0001",
    "/proposals/memory/candidate-lesson/LESSON-0001/extra",
    `/proposals/memory/${"x".repeat(201)}`,
  ])
    expect((await request.get(location)).status(), location).toBe(404);
  for (const location of [
    "/proposals",
    "/proposals/resumen",
    "/proposals/memory",
    "/proposals/backlog",
  ])
    expect((await request.get(location)).status(), location).toBe(200);
});

test("AC-22-004.2 AC-22-002.3 a malformed file is named while the parsed items stay listed and counted", async ({
  page,
}) => {
  item("BL-9506");
  plant(path.join(backlog, "BL-9507.md"), "---\nid: [broken\n---\nbody\n");
  await gotoHydrated(page, "/proposals/backlog", { selector: panel });
  const alert = page.getByTestId("backlog-panel").getByRole("alert");
  await expect(alert).toContainText("BL-9507.md");
  await expect(page.getByRole("button", { name: "BL-9506 · Gate BL-9506" })).toBeVisible();
  await expect(page.getByTestId("proposals-tab-backlog")).toContainText(/\d/);
});

test("responsive: the three tabs and both dialogs fit the viewport with no console errors", async ({
  page,
}) => {
  item("BL-9508");
  plant(
    path.join(memory, "LESSON-9508.md"),
    "---\nid: LESSON-9508\ntype: gotcha\ndomain: testing\nstatus: active\npromotion: proposed\ncontext: Gate lesson\nsource: a (x), b (y)\n---\n**Situation:** S.\n",
  );
  const errors = trackErrors(page);
  await gotoHydrated(page, "/proposals", { selector: '[data-testid="proposals-tab-resumen"]' });
  const noOverflow = async (): Promise<void> => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  };
  await noOverflow();
  await page.getByTestId("proposals-tab-memoria").click();
  await noOverflow();
  await page.getByRole("button", { name: "LESSON-9508 · Gate lesson" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await noOverflow();
  await page.keyboard.press("Escape");
  await page.getByTestId("proposals-tab-backlog").click();
  await noOverflow();
  await page.getByRole("button", { name: "BL-9508 · Gate BL-9508" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await noOverflow();
  expect(errors).toEqual([]);
});
