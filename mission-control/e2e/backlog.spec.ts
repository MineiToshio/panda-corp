import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const fixtures = path.resolve("e2e/fixtures/factory-root/factory/backlog");
const items = [
  { id: "BL-9001", severity: "p0", area: "hooks", title: "S3C urgent hook" },
  { id: "BL-9002", severity: "p1", area: "plugin-skill", title: "S3C important skill" },
  { id: "BL-9003", severity: "p2", area: "plugin-hooks", title: "S3C later hook" },
];
function clearFixtures(): void {
  for (const file of fs.readdirSync(fixtures)) {
    if (file.startsWith("BL-90") && file.endsWith(".md")) fs.unlinkSync(path.join(fixtures, file));
  }
}
test.beforeEach(() => {
  clearFixtures();
  for (const item of items) {
    const file = path.join(fixtures, `${item.id}.md`);
    fs.writeFileSync(
      file,
      `---\nid: ${item.id}\ntype: bug\nstatus: open\narea: ${item.area}\nseverity: ${item.severity}\ntitle: ${item.title}\n---\n## Problem\nA fixture issue.\n`,
    );
  }
});
test.afterEach(clearFixtures);

test("AC-22-010.1 AC-22-010.2 AC-22-005.1 AC-22-007.1 filters, opens and cancels without a write", async ({
  page,
}) => {
  await gotoHydrated(page, "/proposals/backlog", { selector: '[data-testid="backlog-panel"]' });
  await page.getByRole("button", { name: /P0 · urgente/ }).click();
  await expect(page.getByRole("button", { name: "BL-9001 · S3C urgent hook" })).toBeVisible();
  await expect(page.getByRole("button", { name: "BL-9002 · S3C important skill" })).toHaveCount(0);
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await page.getByRole("button", { name: /Controles automáticos/ }).click();
  await expect(page.getByRole("button", { name: "BL-9002 · S3C important skill" })).toHaveCount(0);
  await page.getByRole("button", { name: "BL-9001 · S3C urgent hook" }).click();
  await expect(page.getByRole("dialog")).toContainText("/pandacorp:implement-backlog BL-9001");
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("BL-9001 · S3C urgent hook");
});

test("a discard from a pasted backlog item closes the URL after the action and stays closed on reload", async ({
  page,
}) => {
  await gotoHydrated(page, "/proposals/backlog/BL-9001", {
    selector: '[data-testid="backlog-detail-modal"]',
  });
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await page.getByRole("textbox", { name: "Motivo (opcional)" }).fill("Completed fixture review");
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(page).toHaveURL(/\/proposals\/backlog$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/\/proposals\/backlog$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(fs.readFileSync(path.join(fixtures, "BL-9001.md"), "utf8")).toMatch(
    /^status: "?discarded"?$/m,
  );
});
