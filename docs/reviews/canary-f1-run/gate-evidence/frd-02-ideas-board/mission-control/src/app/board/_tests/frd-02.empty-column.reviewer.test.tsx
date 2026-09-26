/**
 * FRD-02 — Ideas board — REVIEWER adversarial suite for REQ-02-014 (WO-02-014 gate).
 *
 * Builder-blind (DR-080): written by the FRD reviewer, not the implementer. The implementer's
 * own test renders IdeaBoardView in isolation with ONE populated column. These exercise the
 * accessible empty-column marker through the REAL interactive seam — `BoardShell` — where a
 * column becomes empty at RUNTIME (the category filter, the search box, discarded ideas split
 * out to the "Ver descartadas" modal), plus the boundaries the implementer did not see:
 *
 *   1. Boundary: every column populated → ZERO empty-state markers; exactly N empty columns →
 *      exactly N markers, ONE per empty column (never duplicated, never leaked into a
 *      populated column), each scoped to its own column section.
 *   2. Runtime transitions: a filter/search that empties a column makes the marker APPEAR in
 *      that column; clearing the filter makes it DISAPPEAR again (no stale marker).
 *   3. Discarded ideas never count as column content: a column holding only a discarded idea
 *      is empty on the board and exposes the marker (the discarded column is not rendered).
 *   4. Exclusions: the board-wide states (no cards at all / loading / error) render NO
 *      per-column markers — the empty-state marker belongs to a rendered column only.
 *   5. Not conveyed by shape alone (accessibility.md): the marker carries the Spanish text as
 *      CONTENT (not only an aria-label), the legacy `title="Columna vacía"` is gone, the dash is
 *      aria-hidden, and the marker reuses the project's shared `sr-only` utility (DR-057 — no
 *      bespoke visually-hidden style).
 *
 * EARS anchors: REQ-02-014 (AC-02-014.1/.2/.3), REQ-02-002 (no manual move; empty columns stay
 * full panels), REQ-02-005 (category filter), FRD-02 "Does NOT include" discarded column.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import { IdeaBoardView } from "@/app/board/IdeaBoardView/IdeaBoardView";
import type { BoardColumn } from "@/lib/board/board";
import type { DiscardResult } from "@/lib/discard/discard";
import { BoardShell } from "../_components/BoardShell/BoardShell";

const EMPTY_TEXT = "Sin ideas en esta columna";

/** The six rendered board columns, in board order (the discarded column is never rendered). */
const RENDERED_COLUMNS: readonly BoardColumn[] = [
  "discovered",
  "documented",
  "design",
  "architecture",
  "building",
  "shipped",
];

function card(overrides: Partial<BoardCardEntry> = {}): BoardCardEntry {
  return {
    slug: "idea-a",
    title: "Idea A",
    status: "discovered",
    body: "Resumen de la idea A.",
    projectType: "web",
    returnType: "monetary",
    score: 70,
    boardColumn: "discovered",
    ...overrides,
  };
}

/** One card per rendered column — the "no column is empty" boundary. */
function oneCardPerColumn(): BoardCardEntry[] {
  return RENDERED_COLUMNS.map((col, i) =>
    card({
      slug: `idea-${col}`,
      title: `Idea ${col}`,
      status: col === "discovered" ? "discovered" : col === "shipped" ? "shipped" : "in-pipeline",
      boardColumn: col,
      score: 50 + i,
    }),
  );
}

const okDiscard = async (): Promise<DiscardResult> => ({ ok: true });

function column(col: BoardColumn): HTMLElement {
  return screen.getByTestId(`board-column-${col}`);
}

function emptyMarkersIn(col: BoardColumn): HTMLElement[] {
  return within(column(col)).queryAllByRole("status", { name: EMPTY_TEXT });
}

// ---------------------------------------------------------------------------
// 1. Boundaries — zero / N empty columns, one marker per empty column.
// ---------------------------------------------------------------------------

describe("REQ-02-014 boundaries — markers track exactly the empty columns", () => {
  it("every column populated → no empty-state marker anywhere on the board", () => {
    render(<IdeaBoardView cards={oneCardPerColumn()} />);

    expect(screen.queryAllByRole("status", { name: EMPTY_TEXT })).toHaveLength(0);
    for (const col of RENDERED_COLUMNS) {
      expect(within(column(col)).queryByRole("status")).toBeNull();
    }
  });

  it("a single card → the other five columns each carry exactly ONE marker", () => {
    render(<IdeaBoardView cards={[card({ boardColumn: "building", status: "in-pipeline" })]} />);

    expect(screen.getAllByRole("status", { name: EMPTY_TEXT })).toHaveLength(5);
    for (const col of RENDERED_COLUMNS) {
      expect(emptyMarkersIn(col)).toHaveLength(col === "building" ? 0 : 1);
    }
  });

  it("each rendered column, when it is the ONLY empty one, exposes the marker (no column is special-cased)", () => {
    for (const emptyCol of RENDERED_COLUMNS) {
      const cards = oneCardPerColumn().filter((c) => c.boardColumn !== emptyCol);
      const { unmount } = render(<IdeaBoardView cards={cards} />);

      expect(screen.getAllByRole("status", { name: EMPTY_TEXT })).toHaveLength(1);
      expect(emptyMarkersIn(emptyCol)).toHaveLength(1);
      // The column's count still reads 0 alongside the marker (header unchanged).
      expect(within(column(emptyCol)).getByText("0")).toBeInTheDocument();
      unmount();
    }
  });

  it("board-wide states render NO per-column marker (no cards / loading / error)", () => {
    const { rerender } = render(<IdeaBoardView cards={[]} />);
    expect(screen.getByTestId("board-empty-state")).toBeInTheDocument();
    expect(screen.queryAllByRole("status", { name: EMPTY_TEXT })).toHaveLength(0);

    rerender(<IdeaBoardView cards={[card()]} isLoading />);
    expect(screen.getByTestId("board-loading-state")).toBeInTheDocument();
    expect(screen.queryAllByRole("status", { name: EMPTY_TEXT })).toHaveLength(0);

    rerender(<IdeaBoardView cards={[card()]} error="boom" />);
    expect(screen.getByTestId("board-error-state")).toBeInTheDocument();
    expect(screen.queryAllByRole("status", { name: EMPTY_TEXT })).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Not conveyed by shape alone — text content, no legacy title, aria-hidden dash, sr-only reuse.
// ---------------------------------------------------------------------------

describe("REQ-02-014 semantics — the empty state is real text, the dash is decoration", () => {
  it("the marker's CONTENT (not only its aria-label) is the Spanish text; the legacy title is gone", () => {
    render(<IdeaBoardView cards={[card()]} />);

    const marker = emptyMarkersIn("design")[0];
    expect(marker).toBeDefined();
    // Text content carries the meaning even for AT that ignores aria-label on a live region.
    expect(marker?.textContent?.trim()).toBe(EMPTY_TEXT);
    // The old shape-only affordance is gone: no element in the column relies on a tooltip.
    expect(within(column("design")).queryByTitle("Columna vacía")).toBeNull();
    expect(screen.queryByTitle("Columna vacía")).toBeNull();
  });

  it("the dash is aria-hidden and is NOT the status element; the marker is not inside an aria-hidden subtree", () => {
    render(<IdeaBoardView cards={[card()]} />);

    const designCol = column("design");
    const dash = within(designCol).getByText("—");
    expect(dash).toHaveAttribute("aria-hidden", "true");
    expect(dash).not.toHaveAttribute("role", "status");

    const marker = within(designCol).getByRole("status", { name: EMPTY_TEXT });
    expect(marker.closest("[aria-hidden='true']")).toBeNull();
    // The dash does not leak into the accessible text of the marker.
    expect(marker.textContent).not.toContain("—");
  });

  it("the marker reuses the project's shared sr-only utility (DR-057), not a bespoke hidden style", () => {
    render(<IdeaBoardView cards={[card()]} />);

    const marker = within(column("architecture")).getByRole("status", { name: EMPTY_TEXT });
    expect(marker).toHaveClass("sr-only");
  });

  it("a populated column exposes no status of ANY name (no stray live region next to cards)", () => {
    render(<IdeaBoardView cards={[card(), card({ slug: "idea-b", title: "Idea B" })]} />);

    expect(within(column("discovered")).queryAllByRole("status")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Runtime seam — BoardShell's filter / search / discarded split make columns empty.
// ---------------------------------------------------------------------------

describe("REQ-02-014 × BoardShell — columns emptied at runtime expose (and drop) the marker", () => {
  const WEB_DISCOVERED = card({ slug: "idea-web", title: "Idea web", projectType: "web" });
  const MOBILE_DOCUMENTED = card({
    slug: "idea-mobile",
    title: "Idea móvil",
    status: "in-pipeline",
    projectType: "mobile",
    boardColumn: "documented",
  });

  it("the category filter empties a column → marker appears there; clearing it removes the marker", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={[WEB_DISCOVERED, MOBILE_DOCUMENTED]} discardAction={okDiscard} />);

    // Unfiltered: both populated columns have no marker.
    expect(emptyMarkersIn("discovered")).toHaveLength(0);
    expect(emptyMarkersIn("documented")).toHaveLength(0);

    await user.selectOptions(screen.getByTestId("category-filter"), "mobile");

    // The web card is filtered out → its column is now empty and says so.
    expect(emptyMarkersIn("discovered")).toHaveLength(1);
    expect(emptyMarkersIn("documented")).toHaveLength(0);
    expect(screen.queryByText("Idea web")).toBeNull();

    await user.click(screen.getByTestId("board-clear-filters"));

    expect(emptyMarkersIn("discovered")).toHaveLength(0);
    expect(within(column("discovered")).getByText("Idea web")).toBeInTheDocument();
  });

  it("the search box empties a column → marker appears; the other column keeps its card and no marker", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={[WEB_DISCOVERED, MOBILE_DOCUMENTED]} discardAction={okDiscard} />);

    await user.type(screen.getByTestId("board-search"), "móvil");

    expect(emptyMarkersIn("discovered")).toHaveLength(1);
    expect(emptyMarkersIn("documented")).toHaveLength(0);
    expect(within(column("documented")).getByText("Idea móvil")).toBeInTheDocument();
  });

  it("a column whose only idea is discarded is EMPTY on the board and carries the marker (no discarded column)", () => {
    const discardedIdea = card({
      slug: "idea-discarded",
      title: "Idea descartada",
      status: "discarded",
      boardColumn: "discarded",
    });
    render(<BoardShell cards={[WEB_DISCOVERED, discardedIdea]} discardAction={okDiscard} />);

    expect(screen.queryByTestId("board-column-discarded")).toBeNull();
    expect(screen.queryByText("Idea descartada")).toBeNull();
    // 6 rendered columns, only "discovered" populated → 5 markers.
    expect(screen.getAllByRole("status", { name: EMPTY_TEXT })).toHaveLength(5);
    expect(emptyMarkersIn("discovered")).toHaveLength(0);
  });

  it("the empty-state marker is not an interactive control (REQ-02-002: no manual move affordance)", () => {
    render(<BoardShell cards={[WEB_DISCOVERED]} discardAction={okDiscard} />);

    const designCol = column("design");
    expect(within(designCol).queryAllByRole("button")).toHaveLength(0);
    const marker = within(designCol).getByRole("status", { name: EMPTY_TEXT });
    expect(marker).not.toHaveAttribute("tabindex");
    expect(marker).not.toHaveAttribute("draggable", "true");
  });
});
