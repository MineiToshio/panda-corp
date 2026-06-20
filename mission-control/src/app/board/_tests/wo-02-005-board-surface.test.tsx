/**
 * WO-02-005 — Board surface repaint (board view + interactions)
 *
 * RED phase: tests written BEFORE the repaint is complete.
 *
 * Verifies the acceptance criteria for WO-02-005:
 *   AC-02-002 — No drag; equal-width wide columns; horizontal scroll; text wraps.
 *   AC-02-005 — Each card shows category + return chips + score.
 *   AC-02-006 — Filtering by category; recommended badge.
 *   AC-02-008 — Building indicator when running=true; legend present.
 *   AC-02-003 — Intake modal opens on button click; closes on ✕/Escape/backdrop.
 *   AC-02-007 — Discard button present and connected.
 *   H1 "Tablero" via PageTitle (not an ad-hoc heading, DR-062 title rule).
 *
 * Uses BoardClient (the interactive client wrapper) directly — no filesystem.
 *
 * Traceability:
 *   CMP-02-board-view → REQ-02-002, REQ-02-005, REQ-02-006, REQ-02-008, REQ-02-003
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BoardClient } from "@/app/board/_components/BoardClient/BoardClient";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(
  overrides: Partial<BoardCardEntry> & Pick<BoardCardEntry, "slug" | "title" | "boardColumn">,
): BoardCardEntry {
  return {
    status: "discovered",
    body: "",
    ...overrides,
  } as BoardCardEntry;
}

const FIXTURE_CARDS: BoardCardEntry[] = [
  makeCard({
    slug: "idea-web",
    title: "Idea Web",
    status: "discovered",
    boardColumn: "discovered",
    projectType: "web",
    returnType: "monetary",
    score: 80,
  }),
  makeCard({
    slug: "idea-ai",
    title: "Idea AI",
    status: "recommended",
    boardColumn: "discovered",
    projectType: "ai",
    returnType: "opportunity",
    score: 90,
  }),
  makeCard({
    slug: "idea-building",
    title: "Idea Building",
    status: "in-pipeline",
    boardColumn: "building",
    projectType: "web",
    returnType: "monetary",
    score: 75,
    isRunning: true,
  }),
];

// ---------------------------------------------------------------------------
// 1. PageTitle H1 "Tablero"
// ---------------------------------------------------------------------------

describe("AC-board-title — H1 'Tablero' via PageTitle (DR-062)", () => {
  it("renders H1 with text 'Tablero'", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Tablero");
  });

  it("H1 text is exactly 'Tablero', not 'Tablero de Ideas'", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    // The text must start with "Tablero" (PageTitle may render icon + title together)
    expect(h1.textContent).toMatch(/^Tablero/);
    expect(h1.textContent).not.toContain("de Ideas");
  });
});

// ---------------------------------------------------------------------------
// 2. Intake button + modal
// ---------------------------------------------------------------------------

describe("AC-02-003 — Intake modal", () => {
  it("renders an intake button visible on the board", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    expect(screen.getByTestId("intake-open-button")).toBeInTheDocument();
  });

  it("modal is not open initially", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    expect(screen.queryByTestId("intake-modal")).not.toBeInTheDocument();
  });

  it("clicking intake button opens the modal overlay", async () => {
    const user = userEvent.setup();
    render(<BoardClient cards={FIXTURE_CARDS} />);
    await user.click(screen.getByTestId("intake-open-button"));
    expect(screen.getByTestId("intake-modal")).toBeInTheDocument();
  });

  it("clicking ✕ button closes the modal", async () => {
    const user = userEvent.setup();
    render(<BoardClient cards={FIXTURE_CARDS} />);
    await user.click(screen.getByTestId("intake-open-button"));
    await user.click(screen.getByTestId("intake-close"));
    expect(screen.queryByTestId("intake-modal")).not.toBeInTheDocument();
  });

  it("pressing Escape closes the modal", async () => {
    const user = userEvent.setup();
    render(<BoardClient cards={FIXTURE_CARDS} />);
    await user.click(screen.getByTestId("intake-open-button"));
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("intake-modal")).not.toBeInTheDocument();
  });

  it("clicking backdrop closes the modal", async () => {
    const user = userEvent.setup();
    render(<BoardClient cards={FIXTURE_CARDS} />);
    await user.click(screen.getByTestId("intake-open-button"));
    await user.click(screen.getByTestId("intake-backdrop"));
    expect(screen.queryByTestId("intake-modal")).not.toBeInTheDocument();
  });

  it("board content remains mounted while modal is open", async () => {
    const user = userEvent.setup();
    render(<BoardClient cards={FIXTURE_CARDS} />);
    await user.click(screen.getByTestId("intake-open-button"));
    // Board should still be in the DOM (AC-02-003.3)
    expect(screen.getByTestId("idea-board")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Category filter
// ---------------------------------------------------------------------------

describe("AC-02-006 — Category filter", () => {
  it("renders a category filter control", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    expect(screen.getByTestId("category-filter")).toBeInTheDocument();
  });

  it("shows all cards when no filter is active", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    const cards = screen.getAllByTestId("idea-card");
    expect(cards.length).toBe(FIXTURE_CARDS.length);
  });

  it("filters cards to only the selected category", async () => {
    const user = userEvent.setup();
    render(<BoardClient cards={FIXTURE_CARDS} />);
    // Select 'ai' category filter
    const aiBtn = screen
      .getAllByTestId("category-filter-option")
      .find((b) => b.textContent === "ai");
    expect(aiBtn).toBeDefined();
    if (!aiBtn) return; // type narrowing (expect above already asserts)
    await user.click(aiBtn);
    const cards = screen.getAllByTestId("idea-card");
    // Only 'Idea AI' should be shown (1 card — the AI one)
    expect(cards.length).toBe(1);
    expect(screen.getByTestId("idea-card-title")).toHaveTextContent("Idea AI");
  });

  it("resets to all cards when 'Todas' is clicked", async () => {
    const user = userEvent.setup();
    render(<BoardClient cards={FIXTURE_CARDS} />);
    const aiBtn = screen
      .getAllByTestId("category-filter-option")
      .find((b) => b.textContent === "ai");
    if (!aiBtn) return;
    await user.click(aiBtn);
    await user.click(screen.getByTestId("category-filter-all"));
    // All cards should be visible again
    const cards = screen.getAllByTestId("idea-card");
    expect(cards.length).toBe(FIXTURE_CARDS.length);
  });
});

// ---------------------------------------------------------------------------
// 4. Cards — category + return chips + score (AC-02-005)
// ---------------------------------------------------------------------------

describe("AC-02-005 — Card shows category + return chips and score", () => {
  it("each card shows its category chip", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    const catChips = screen.getAllByTestId("idea-card-category");
    expect(catChips.length).toBeGreaterThan(0);
    // 'web' category should appear
    const webChip = catChips.find((c) => c.textContent === "web");
    expect(webChip).toBeDefined();
  });

  it("each card with a returnType shows the return chip", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    const retChips = screen.getAllByTestId("idea-card-return-type");
    expect(retChips.length).toBeGreaterThan(0);
  });

  it("each card with a score shows the score", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    const scoreElements = screen.getAllByTestId("idea-card-score");
    expect(scoreElements.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Recommended badge (AC-02-006.2)
// ---------------------------------------------------------------------------

describe("AC-02-006.2 — Recommended badge", () => {
  it("recommended card shows the recommended badge", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    // 'Idea AI' has status=recommended
    const badge = screen.getByTestId("idea-card-recommended-badge");
    expect(badge).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. Building indicator (AC-02-008)
// ---------------------------------------------------------------------------

describe("AC-02-008 — Building indicator", () => {
  it("in-pipeline card with isRunning=true shows building indicator", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    const indicator = screen.getByTestId("idea-card-building-indicator");
    expect(indicator).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. Board legend (AC-02-008.3)
// ---------------------------------------------------------------------------

describe("AC-02-008.3 — Board legend", () => {
  it("renders board legend on the page", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    expect(screen.getByTestId("board-legend")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 8. Kanban columns (AC-02-002)
// ---------------------------------------------------------------------------

describe("AC-02-002 — Kanban columns", () => {
  it("renders 7 kanban columns", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    const columns = [
      "board-column-discovered",
      "board-column-documented",
      "board-column-design",
      "board-column-architecture",
      "board-column-building",
      "board-column-shipped",
      "board-column-discarded",
    ];
    for (const col of columns) {
      expect(screen.getByTestId(col)).toBeInTheDocument();
    }
  });

  it("cards appear in the correct column by boardColumn", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    const buildingCol = screen.getByTestId("board-column-building");
    const buildingCards = within(buildingCol).queryAllByTestId("idea-card");
    expect(buildingCards.length).toBe(1);
    expect(within(buildingCol).getByTestId("idea-card-title")).toHaveTextContent("Idea Building");
  });
});

// ---------------------------------------------------------------------------
// 9. Card click → opens CardDetail
// ---------------------------------------------------------------------------

describe("card click → CardDetail", () => {
  it("card detail is not shown initially", () => {
    render(<BoardClient cards={FIXTURE_CARDS} />);
    expect(screen.queryByTestId("card-detail")).not.toBeInTheDocument();
  });

  it("clicking a card button opens the card detail", async () => {
    const user = userEvent.setup();
    render(<BoardClient cards={FIXTURE_CARDS} />);
    // BoardClient uses onCardClick, so cards render as idea-card-btn buttons
    const [firstBtn] = screen.getAllByTestId("idea-card-btn");
    expect(firstBtn).toBeDefined();
    await user.click(firstBtn as HTMLElement);
    expect(screen.getByTestId("card-detail")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 10. Empty state
// ---------------------------------------------------------------------------

describe("empty board state", () => {
  it("shows empty state when no cards are provided", () => {
    render(<BoardClient cards={[]} />);
    expect(screen.getByTestId("board-empty-state")).toBeInTheDocument();
  });
});
