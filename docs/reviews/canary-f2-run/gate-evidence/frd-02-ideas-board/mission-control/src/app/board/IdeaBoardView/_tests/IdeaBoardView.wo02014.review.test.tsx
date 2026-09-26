/**
 * FRD-02 gate — reviewer-authored adversarial suite for the accessible empty-column marker
 * (REQ-02-014) exercised together with the board's column derivation (REQ-02-001 fallback routing,
 * the "no Descartado column" rule) and the no-manual-move / equal-width layout contract (REQ-02-002).
 *
 * Builder-blind (DR-080): the implementer did not see these cases.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { type BoardCardEntry, IdeaBoardView } from "../IdeaBoardView";

const EMPTY_STATUS_TEXT = "Sin ideas en esta columna";

const COLUMN_IDS = [
  "discovered",
  "documented",
  "design",
  "architecture",
  "building",
  "shipped",
] as const;

type ColumnId = (typeof COLUMN_IDS)[number];

function buildCard(
  overrides: Partial<BoardCardEntry> & Pick<BoardCardEntry, "slug">,
): BoardCardEntry {
  return {
    title: `Idea ${overrides.slug}`,
    status: "discovered",
    body: "",
    ...overrides,
  };
}

function column(id: ColumnId): HTMLElement {
  return screen.getByTestId(`board-column-${id}`);
}

function emptyStatusesIn(id: ColumnId): HTMLElement[] {
  return within(column(id)).queryAllByRole("status", { name: EMPTY_STATUS_TEXT });
}

describe("REQ-02-014 empty-column marker — reviewer adversarial", () => {
  it("exposes exactly one marker per empty column and none in populated ones", () => {
    render(
      <IdeaBoardView
        cards={[
          buildCard({ slug: "a", boardColumn: "discovered" }),
          buildCard({ slug: "b", status: "shipped", boardColumn: "shipped" }),
        ]}
      />,
    );

    const populated: readonly ColumnId[] = ["discovered", "shipped"];
    for (const id of COLUMN_IDS) {
      expect(emptyStatusesIn(id)).toHaveLength(populated.includes(id) ? 0 : 1);
    }
    expect(screen.getAllByRole("status", { name: EMPTY_STATUS_TEXT })).toHaveLength(4);
  });

  it("carries the exact Spanish text as real content, not only as an attribute", () => {
    render(<IdeaBoardView cards={[buildCard({ slug: "a", boardColumn: "discovered" })]} />);

    const [status] = emptyStatusesIn("design");
    expect(status?.textContent?.trim()).toBe(EMPTY_STATUS_TEXT);
    expect(screen.queryByTitle("Columna vacía")).not.toBeInTheDocument();
  });

  it("keeps the dash decorative and outside the accessible marker", () => {
    render(<IdeaBoardView cards={[buildCard({ slug: "a", boardColumn: "discovered" })]} />);

    const designColumn = column("design");
    const dash = within(designColumn).getByText("—");
    const [status] = emptyStatusesIn("design");
    expect(dash).toHaveAttribute("aria-hidden", "true");
    expect(status).toBeDefined();
    expect(dash.contains(status ?? null)).toBe(false);
    expect(status?.textContent).not.toContain("—");
  });

  it("boundary 1→0→1: the marker follows the column's live card count across re-renders", () => {
    const { rerender } = render(
      <IdeaBoardView cards={[buildCard({ slug: "a", boardColumn: "discovered" })]} />,
    );
    expect(emptyStatusesIn("discovered")).toHaveLength(0);
    expect(emptyStatusesIn("documented")).toHaveLength(1);

    rerender(
      <IdeaBoardView
        cards={[buildCard({ slug: "a", status: "in-pipeline", boardColumn: "documented" })]}
      />,
    );
    expect(emptyStatusesIn("discovered")).toHaveLength(1);
    expect(emptyStatusesIn("documented")).toHaveLength(0);
  });

  it("routes a legacy card without boardColumn through the fallback before deciding emptiness", () => {
    render(<IdeaBoardView cards={[buildCard({ slug: "p", status: "in-pipeline" })]} />);

    expect(emptyStatusesIn("documented")).toHaveLength(0);
    for (const id of COLUMN_IDS.filter((c) => c !== "documented")) {
      expect(emptyStatusesIn(id)).toHaveLength(1);
    }
  });

  it("marks all six columns empty when only a discarded card reaches the view, and renders no Descartada column", () => {
    render(
      <IdeaBoardView
        cards={[buildCard({ slug: "d", status: "discarded", boardColumn: "discarded" })]}
      />,
    );

    expect(screen.queryByTestId("board-column-discarded")).not.toBeInTheDocument();
    expect(screen.getAllByRole("status", { name: EMPTY_STATUS_TEXT })).toHaveLength(
      COLUMN_IDS.length,
    );
  });

  it("a favourite card keeps its column: the favourite flag never empties or fills a column", () => {
    const { rerender } = render(
      <IdeaBoardView cards={[buildCard({ slug: "f", boardColumn: "design", favorite: false })]} />,
    );
    expect(emptyStatusesIn("design")).toHaveLength(0);

    rerender(
      <IdeaBoardView cards={[buildCard({ slug: "f", boardColumn: "design", favorite: true })]} />,
    );
    expect(emptyStatusesIn("design")).toHaveLength(0);
    expect(emptyStatusesIn("discovered")).toHaveLength(1);
  });
});

describe("REQ-02-002 board layout — reviewer adversarial", () => {
  it("renders the six columns with one shared width and a horizontally scrollable wrapper", () => {
    render(<IdeaBoardView cards={[buildCard({ slug: "a", boardColumn: "discovered" })]} />);

    const widths = COLUMN_IDS.map((id) => column(id).style.width);
    expect(widths[0]).not.toBe("");
    expect(new Set(widths).size).toBe(1);
    expect(["auto", "scroll"]).toContain(
      screen.getByTestId("board-scroll-container").style.overflowX,
    );
  });

  it("offers no move/arrow controls inside any column", () => {
    render(<IdeaBoardView cards={[buildCard({ slug: "a", boardColumn: "discovered" })]} />);

    for (const id of COLUMN_IDS) {
      expect(
        within(column(id)).queryAllByRole("button", {
          name: /mover|move|arrastrar|drag|siguiente columna|columna anterior|[←→↑↓]/i,
        }),
      ).toHaveLength(0);
    }
  });
});
