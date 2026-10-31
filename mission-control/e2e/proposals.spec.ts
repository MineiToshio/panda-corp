import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

const directory = path.resolve("e2e/fixtures/factory-root/factory/memory");
function clearFixtures(): void {
  const backlog = path.resolve("e2e/fixtures/factory-root/factory/backlog");
  for (const file of fs.readdirSync(backlog)) {
    if (file.startsWith("BL-90") && file.endsWith(".md")) fs.unlinkSync(path.join(backlog, file));
  }
  for (const file of fs.readdirSync(directory)) {
    if (file.startsWith("LESSON-90") && file.endsWith(".md"))
      fs.unlinkSync(path.join(directory, file));
  }
}
test.beforeEach(() => {
  clearFixtures();
  for (let index = 0; index < 25; index++) {
    const id = `LESSON-${9000 + index}`;
    const file = path.join(directory, `${id}.md`);
    fs.writeFileSync(
      file,
      `---\nid: ${id}\ntype: pattern\ndomain: testing\nstatus: candidate\npromotion: ${index === 0 ? "proposed" : "none"}\ncontext: S3C lesson ${index}\nsource: fixture-a (review)\ntrigger: Use real evidence\napplied_in: [fixture-b]\n---\n## Proof\nPreserved evidence\n`,
    );
  }
});
test.afterEach(clearFixtures);

test("AC-17-011.1 AC-17-011.4 AC-17-010.2 lesson navigation and paging preserve mounted backlog filters", async ({
  page,
}) => {
  await gotoHydrated(page, "/proposals", { selector: '[data-testid="proposals-tab-resumen"]' });
  await expect(page.getByRole("tab", { name: "Resumen", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Qué te toca, en orden" })).toBeVisible();
  await page.getByRole("tab", { name: /Memoria/ }).click();
  const lesson = page.getByRole("button", { name: "LESSON-9000 · S3C lesson 0" }).first();
  await lesson.click();
  await expect(page.getByRole("dialog")).toContainText("Aplicada en: fixture-b");
  await page.keyboard.press("Escape");
  await expect(lesson).toBeFocused();
  await page.getByText("Candidatas", { exact: true }).last().click();
  const more = page.getByRole("button", { name: /Mostrar .* más · quedan/ }).last();
  await expect(more).toBeVisible();
  await more.click();
  await expect(page.getByRole("button", { name: "LESSON-9024 · S3C lesson 24" })).toBeVisible();
  await page.getByRole("tab", { name: /Backlog/ }).click();
  const tile = page.getByRole("button", { name: /P0 · urgente/ });
  await tile.click();
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await page.getByRole("link", { name: "Ver el backlog por tema" }).click();
  await expect(tile).toHaveAttribute("aria-pressed", "true");
});
test("AC-25-001.1 a pasted lesson path opens the requested record", async ({ page }) => {
  await gotoHydrated(page, "/proposals/memory/promotions/LESSON-9000", {
    selector: '[data-testid="lesson-detail-modal"]',
  });
  await expect(page.getByRole("dialog")).toHaveAccessibleName("LESSON-9000");
  await expect(
    page.getByRole("button", { name: "Copiar /pandacorp:learn LESSON-9000" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/proposals\/memory$/);
});
