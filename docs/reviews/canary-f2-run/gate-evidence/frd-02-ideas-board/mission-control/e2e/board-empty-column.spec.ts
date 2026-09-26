import { expect, type Locator, test } from "@playwright/test";

/**
 * FRD-02 gate — reviewer-authored browser checks for the ideas board (DR-080, builder-blind).
 *
 * REQ-02-014: every empty column exposes exactly one `role=status` "Sin ideas en esta columna" that
 * is VISUALLY hidden in the real rendered CSS (proves the `sr-only` utility is actually generated),
 * while the dash stays the visible, aria-hidden decoration.
 * REQ-02-002: equal-width wide columns, horizontal-scroll wrapper, nothing draggable, cards never
 * overflow their column.
 *
 * Viewport-agnostic on purpose (BL-0001): every assertion holds on both the desktop and the mobile
 * Playwright projects — columns are fixed-width and measured in page coordinates, not on-screen.
 */

const EMPTY_STATUS_TEXT = "Sin ideas en esta columna";
const COLUMN_IDS = [
  "discovered",
  "documented",
  "design",
  "architecture",
  "building",
  "shipped",
] as const;
const MIN_WIDE_COLUMN_PX = 160;
const SUBPIXEL_TOLERANCE_PX = 1;

async function columnCount(col: Locator): Promise<number> {
  const text = await col.locator("header span").first().textContent();
  return Number(text?.trim());
}

test.describe("FRD-02 board · empty-column marker + column layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/board", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("board-scroll-container")).toBeVisible();
  });

  test("REQ-02-014 · each empty column has one visually-hidden status; populated columns none", async ({
    page,
  }) => {
    let emptyColumns = 0;
    for (const id of COLUMN_IDS) {
      const col = page.getByTestId(`board-column-${id}`);
      const statuses = col.getByRole("status", { name: EMPTY_STATUS_TEXT, exact: true });
      if ((await columnCount(col)) > 0) {
        await expect(statuses).toHaveCount(0);
        continue;
      }
      emptyColumns += 1;
      await expect(statuses).toHaveCount(1);
      await expect(statuses).toHaveText(EMPTY_STATUS_TEXT);

      const statusBox = await statuses.boundingBox();
      expect(statusBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
      expect(statusBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);

      const dash = col.getByText("—", { exact: true });
      await expect(dash).toHaveAttribute("aria-hidden", "true");
      const dashBox = await dash.boundingBox();
      expect(dashBox?.width ?? 0).toBeGreaterThan(1);
    }
    expect(emptyColumns, "the pinned fixture must leave at least one column empty").toBeGreaterThan(
      0,
    );
    await expect(page.getByRole("status", { name: EMPTY_STATUS_TEXT, exact: true })).toHaveCount(
      emptyColumns,
    );
  });

  test("REQ-02-002 · equal wide columns, horizontal scroll, nothing draggable, cards stay inside", async ({
    page,
  }) => {
    const board = page.getByTestId("idea-board");
    const widths: number[] = [];
    for (const id of COLUMN_IDS) {
      const col = page.getByTestId(`board-column-${id}`);
      const colBox = await col.boundingBox();
      expect(colBox, `column ${id} rendered`).not.toBeNull();
      if (!colBox) continue;
      widths.push(colBox.width);

      const cards = col.locator("[data-volatile] > *");
      for (const card of await cards.all()) {
        const cardBox = await card.boundingBox();
        if (!cardBox) continue;
        expect(cardBox.x).toBeGreaterThanOrEqual(colBox.x - SUBPIXEL_TOLERANCE_PX);
        expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(
          colBox.x + colBox.width + SUBPIXEL_TOLERANCE_PX,
        );
      }
    }
    const minWidth = Math.min(...widths);
    const maxWidth = Math.max(...widths);
    expect(maxWidth - minWidth).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE_PX);
    expect(minWidth).toBeGreaterThanOrEqual(MIN_WIDE_COLUMN_PX);

    const overflowX = await page
      .getByTestId("board-scroll-container")
      .evaluate((el) => getComputedStyle(el).overflowX);
    expect(["auto", "scroll"]).toContain(overflowX);
    await expect(board.locator('[draggable="true"]')).toHaveCount(0);
  });
});
