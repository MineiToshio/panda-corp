import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./_hydration";

// Reviewer-authored (DR-080): the FDD draws one scrollable four-column table at every width (hint
// «Desliza la tabla para ver todas las columnas»), never the core Table's stacked cards.
for (const width of [375, 768]) {
  test(`AC-21-007.1: the worktrees table keeps its columns on one row at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoHydrated(page, "/", { selector: "#worktrees-card button" });
    const row = page.locator("#worktrees-card tbody tr").first();
    await expect(row).toBeVisible();
    await expect(row).toHaveCSS("display", "table-row");
    const firstCell = row.locator("td").first();
    await expect(firstCell).toHaveCSS("display", "table-cell");
    const tops = await row
      .locator("td")
      .evaluateAll((cells) => cells.map((cell) => Math.round(cell.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    const labelIsDrawn = await firstCell.evaluate((cell) => {
      const label = getComputedStyle(cell, "::before");
      return label.content !== "none" && label.display !== "none";
    });
    expect(labelIsDrawn).toBe(false);
  });
}
