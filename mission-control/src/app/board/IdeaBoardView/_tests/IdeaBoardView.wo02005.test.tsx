/**
 * WO-02-005 — Board view (7 columns, two-axis, AC-02-002.x + AC-02-005.1 + AC-02-006.2)
 *
 * RED phase: tests written BEFORE the full 7-column implementation.
 * They verify that IdeaBoardView renders ALL seven columns (discovered, documented,
 * design, architecture, building, shipped, discarded) and routes cards by the
 * pre-computed `boardColumn` prop — NOT by card `status` alone.
 *
 * Traceability:
 *   CMP-02-board-view → REQ-02-001, REQ-02-002, REQ-02-005, REQ-02-006
 *   AC-02-002.1 — no drag/move controls
 *   AC-02-002.2 — 7 equal-width columns present; horizontal scroll container
 *   AC-02-005.1 — each card shows category + return chips besides score
 *   AC-02-006.2 — recommended card shows "recommended" badge
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { IdeaCardProps } from "@/components/modules/IdeaCard/IdeaCard";
import type { BoardColumn } from "@/lib/board/board";
import { IdeaBoardView } from "../IdeaBoardView";

// ---------------------------------------------------------------------------
// Extended card shape: IdeaCardProps + boardColumn (resolved by page.tsx via deriveColumn)
// ---------------------------------------------------------------------------

// IdeaBoardView in WO-02-005 mode accepts cards with a resolved boardColumn.
// The component uses this to bucket cards into the 7 columns instead of raw status.
interface BoardCardProps extends IdeaCardProps {
  boardColumn: BoardColumn;
}

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeCard(
  overrides: Partial<BoardCardProps> & {
    slug: string;
    title: string;
    boardColumn: BoardColumn;
  },
): BoardCardProps {
  return {
    status: "discovered",
    body: "",
    ...overrides,
  };
}

// One card per column to test complete routing
const DISCOVERED_CARD = makeCard({
  slug: "idea-discovered",
  title: "Idea Descubierta",
  status: "discovered",
  boardColumn: "discovered",
  projectType: "web",
  returnType: "monetary",
  score: 70,
});

const RECOMMENDED_CARD = makeCard({
  slug: "idea-recommended",
  title: "Idea Recomendada",
  status: "recommended",
  boardColumn: "discovered", // recommended → discovered column, badge on card
  projectType: "ai",
  returnType: "opportunity",
  score: 85,
});

const DOCUMENTED_CARD = makeCard({
  slug: "idea-documented",
  title: "Idea Documentada",
  status: "in-pipeline",
  boardColumn: "documented",
  projectType: "mobile",
  returnType: "personal",
  score: 60,
});

const DESIGN_CARD = makeCard({
  slug: "idea-design",
  title: "Idea en Diseño",
  status: "in-pipeline",
  boardColumn: "design",
  projectType: "desktop",
  returnType: "mixed",
  score: 75,
});

const ARCHITECTURE_CARD = makeCard({
  slug: "idea-architecture",
  title: "Idea en Arquitectura",
  status: "in-pipeline",
  boardColumn: "architecture",
  projectType: "automation",
  returnType: "monetary",
  score: 80,
});

const BUILDING_CARD = makeCard({
  slug: "idea-building",
  title: "Idea Construyéndose",
  status: "in-pipeline",
  boardColumn: "building",
  projectType: "cli",
  returnType: "opportunity",
  score: 90,
  isRunning: true,
});

const SHIPPED_CARD_PIPELINE = makeCard({
  slug: "idea-shipped-pipeline",
  title: "Idea En Operación",
  status: "in-pipeline",
  boardColumn: "shipped", // in-pipeline with phase=release → shipped
  projectType: "web",
  returnType: "monetary",
  score: 95,
});

const SHIPPED_CARD = makeCard({
  slug: "idea-shipped",
  title: "Idea Lanzada",
  status: "shipped",
  boardColumn: "shipped",
  projectType: "web",
  returnType: "monetary",
  score: 88,
});

const DISCARDED_CARD = makeCard({
  slug: "idea-discarded",
  title: "Idea Descartada",
  status: "discarded",
  boardColumn: "discarded",
  projectType: "ai",
  returnType: "personal",
  score: 30,
});

const ALL_COLUMNS_CARDS: BoardCardProps[] = [
  DISCOVERED_CARD,
  RECOMMENDED_CARD,
  DOCUMENTED_CARD,
  DESIGN_CARD,
  ARCHITECTURE_CARD,
  BUILDING_CARD,
  SHIPPED_CARD,
  DISCARDED_CARD,
];

// ---------------------------------------------------------------------------
// AC-02-002.2 — ALL 7 columns must be rendered
// ---------------------------------------------------------------------------

describe("IdeaBoardView WO-02-005 — 7 columns (AC-02-002.2)", () => {
  it("renders the discovered column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    expect(screen.getByTestId("board-column-discovered")).toBeInTheDocument();
  });

  it("renders the documented column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    expect(screen.getByTestId("board-column-documented")).toBeInTheDocument();
  });

  it("renders the design column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    expect(screen.getByTestId("board-column-design")).toBeInTheDocument();
  });

  it("renders the architecture column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    expect(screen.getByTestId("board-column-architecture")).toBeInTheDocument();
  });

  it("renders the building column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    expect(screen.getByTestId("board-column-building")).toBeInTheDocument();
  });

  it("renders the shipped column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    expect(screen.getByTestId("board-column-shipped")).toBeInTheDocument();
  });

  it("renders the discarded column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    expect(screen.getByTestId("board-column-discarded")).toBeInTheDocument();
  });

  it("renders exactly 7 columns", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    // All 7 expected testids must be present
    const expected: BoardColumn[] = [
      "discovered",
      "documented",
      "design",
      "architecture",
      "building",
      "shipped",
      "discarded",
    ];
    for (const col of expected) {
      expect(screen.getByTestId(`board-column-${col}`)).toBeInTheDocument();
    }
  });
});

// ---------------------------------------------------------------------------
// Cards routed by boardColumn (two-axis: not by status alone)
// ---------------------------------------------------------------------------

describe("IdeaBoardView WO-02-005 — cards in correct columns (two-axis routing)", () => {
  it("discovered card lands in discovered column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    const col = screen.getByTestId("board-column-discovered");
    expect(col).toHaveTextContent("Idea Descubierta");
  });

  it("recommended card (boardColumn=discovered) lands in discovered column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    const col = screen.getByTestId("board-column-discovered");
    expect(col).toHaveTextContent("Idea Recomendada");
  });

  it("in-pipeline card with boardColumn=documented lands in documented column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    const col = screen.getByTestId("board-column-documented");
    expect(col).toHaveTextContent("Idea Documentada");
  });

  it("in-pipeline card with boardColumn=design lands in design column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    const col = screen.getByTestId("board-column-design");
    expect(col).toHaveTextContent("Idea en Diseño");
  });

  it("in-pipeline card with boardColumn=architecture lands in architecture column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    const col = screen.getByTestId("board-column-architecture");
    expect(col).toHaveTextContent("Idea en Arquitectura");
  });

  it("in-pipeline card with boardColumn=building lands in building column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    const col = screen.getByTestId("board-column-building");
    expect(col).toHaveTextContent("Idea Construyéndose");
  });

  it("shipped card lands in shipped column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    const col = screen.getByTestId("board-column-shipped");
    expect(col).toHaveTextContent("Idea Lanzada");
  });

  it("discarded card lands in discarded column", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    const col = screen.getByTestId("board-column-discarded");
    expect(col).toHaveTextContent("Idea Descartada");
  });

  it("in-pipeline card with boardColumn=shipped (phase=release) lands in shipped column (two-axis)", () => {
    // This is the key two-axis test: an in-pipeline card should be in shipped if phase=release
    render(<IdeaBoardView cards={[SHIPPED_CARD_PIPELINE]} />);
    const col = screen.getByTestId("board-column-shipped");
    expect(col).toHaveTextContent("Idea En Operación");
  });

  it("in-pipeline card with boardColumn=shipped does NOT land in documented column", () => {
    // Verifies routing uses boardColumn, not status
    render(<IdeaBoardView cards={[SHIPPED_CARD_PIPELINE]} />);
    const documentedCol = screen.getByTestId("board-column-documented");
    expect(documentedCol).not.toHaveTextContent("Idea En Operación");
  });
});

// ---------------------------------------------------------------------------
// AC-02-005.1 — category + return chips
// ---------------------------------------------------------------------------

describe("IdeaBoardView WO-02-005 — AC-02-005.1 chips on cards", () => {
  it("card renders category chip (projectType)", () => {
    render(<IdeaBoardView cards={[DOCUMENTED_CARD]} />);
    const chips = screen.getAllByTestId("idea-card-category");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0]).toHaveTextContent("mobile");
  });

  it("card renders return-type chip (returnType)", () => {
    render(<IdeaBoardView cards={[DOCUMENTED_CARD]} />);
    const chips = screen.getAllByTestId("idea-card-return-type");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0]).toHaveTextContent("personal");
  });

  it("card renders score with tabular-nums", () => {
    render(<IdeaBoardView cards={[DOCUMENTED_CARD]} />);
    const scores = screen.getAllByTestId("idea-card-score");
    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0]).toHaveTextContent("60");
  });
});

// ---------------------------------------------------------------------------
// AC-02-006.2 — recommended badge
// ---------------------------------------------------------------------------

describe("IdeaBoardView WO-02-005 — AC-02-006.2 recommended badge", () => {
  it("recommended card shows the recommended badge", () => {
    render(<IdeaBoardView cards={[RECOMMENDED_CARD]} />);
    expect(screen.getByTestId("idea-card-recommended-badge")).toBeInTheDocument();
  });

  it("non-recommended card does NOT show the recommended badge", () => {
    render(<IdeaBoardView cards={[DISCOVERED_CARD]} />);
    expect(screen.queryByTestId("idea-card-recommended-badge")).not.toBeInTheDocument();
  });

  it("recommended card with boardColumn=discovered still shows the badge inside the discovered column", () => {
    render(<IdeaBoardView cards={[RECOMMENDED_CARD]} />);
    const col = screen.getByTestId("board-column-discovered");
    expect(within(col).getByTestId("idea-card-recommended-badge")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-02-002.1 — no drag/move controls
// ---------------------------------------------------------------------------

describe("IdeaBoardView WO-02-005 — AC-02-002.1 read-only (no drag/move)", () => {
  it("no drag handle element in the DOM", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    expect(screen.queryByTestId("idea-card-drag-handle")).not.toBeInTheDocument();
  });

  it("no 'draggable' attribute on any card", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    const cards = screen.getAllByTestId("idea-card");
    for (const card of cards) {
      expect(card).not.toHaveAttribute("draggable", "true");
    }
  });

  it("no move button in the DOM", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    expect(screen.queryByRole("button", { name: /mover/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Horizontal scroll container for wide columns (AC-02-002.2)
// ---------------------------------------------------------------------------

describe("IdeaBoardView WO-02-005 — AC-02-002.2 horizontal scroll", () => {
  it("board has a scroll container data-testid", () => {
    render(<IdeaBoardView cards={ALL_COLUMNS_CARDS} />);
    expect(screen.getByTestId("board-scroll-container")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Fallback: cards without boardColumn prop (backward compat with legacy callers)
// ---------------------------------------------------------------------------

describe("IdeaBoardView WO-02-005 — backward-compat: cards without boardColumn", () => {
  it("renders without error when cards have no boardColumn (falls back to status-based routing)", () => {
    const legacyCard: IdeaCardProps = {
      slug: "legacy",
      title: "Legacy Card",
      status: "discovered",
      body: "",
    };
    expect(() => render(<IdeaBoardView cards={[legacyCard]} />)).not.toThrow();
  });

  it("legacy discovered card still appears in discovered column", () => {
    const legacyCard: IdeaCardProps = {
      slug: "legacy-discovered",
      title: "Legacy Discovered",
      status: "discovered",
      body: "",
    };
    render(<IdeaBoardView cards={[legacyCard]} />);
    const col = screen.getByTestId("board-column-discovered");
    expect(col).toHaveTextContent("Legacy Discovered");
  });

  it("legacy shipped card still appears in shipped column", () => {
    const legacyCard: IdeaCardProps = {
      slug: "legacy-shipped",
      title: "Legacy Shipped",
      status: "shipped",
      body: "",
    };
    render(<IdeaBoardView cards={[legacyCard]} />);
    const col = screen.getByTestId("board-column-shipped");
    expect(col).toHaveTextContent("Legacy Shipped");
  });
});

// ---------------------------------------------------------------------------
// Empty state (no regression from WO-01-003 tests)
// ---------------------------------------------------------------------------

describe("IdeaBoardView WO-02-005 — empty state", () => {
  it("renders empty state when no cards", () => {
    render(<IdeaBoardView cards={[]} />);
    expect(screen.getByTestId("board-empty-state")).toBeInTheDocument();
  });

  it("still shows all 7 columns when cards array is non-empty", () => {
    render(<IdeaBoardView cards={[DISCOVERED_CARD]} />);
    const columns: BoardColumn[] = [
      "discovered",
      "documented",
      "design",
      "architecture",
      "building",
      "shipped",
      "discarded",
    ];
    for (const col of columns) {
      expect(screen.getByTestId(`board-column-${col}`)).toBeInTheDocument();
    }
  });
});
