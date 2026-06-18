/**
 * WO-01-003 (UI) — Board view tests consuming readIdeas.
 *
 * Tests the IdeaBoardView component which renders the kanban columns
 * from an array of IdeaCard data (props already resolved by the Server Component).
 *
 * Traceability:
 *   CMP-02-board-view → REQ-02-001, REQ-02-002, REQ-02-005
 *   IF-01-readIdeas (docs/api.md WO-01-003)
 *   AC-02-002.1 — no drag/move controls
 *   AC-02-002.2 — columns present for each lifecycle status
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 * Props are passed directly (no filesystem reads in this unit test).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { IdeaCardProps } from "@/components/modules/IdeaCard/IdeaCard";
import { IdeaBoardView } from "../IdeaBoardView";

// ---------------------------------------------------------------------------
// Fixture data — matches the shape returned by readIdeas (IF-01-readIdeas)
// ---------------------------------------------------------------------------

const DISCOVERED_CARD: IdeaCardProps = {
  slug: "idea-discovered",
  title: "Idea Descubierta",
  status: "discovered",
  projectType: "SaaS",
  returnType: "monetary",
  score: 72,
  body: "An idea in discovered state.",
};

const RECOMMENDED_CARD: IdeaCardProps = {
  slug: "idea-recommended",
  title: "Idea Recomendada",
  status: "recommended",
  projectType: "ai",
  returnType: "monetary",
  score: 88,
  body: "A recommended idea.",
};

const IN_PIPELINE_CARD: IdeaCardProps = {
  slug: "idea-in-pipeline",
  title: "Idea En Progreso",
  status: "in-pipeline",
  projectType: "web",
  returnType: "opportunity",
  score: 95,
  body: "An idea being built.",
  isRunning: true,
};

const SHIPPED_CARD: IdeaCardProps = {
  slug: "idea-shipped",
  title: "Idea Enviada",
  status: "shipped",
  returnType: "opportunity",
  score: 80,
  body: "A shipped idea.",
};

const DISCARDED_CARD: IdeaCardProps = {
  slug: "idea-discarded",
  title: "Idea Descartada",
  status: "discarded",
  returnType: "personal",
  score: 30,
  body: "A discarded idea.",
};

const ALL_CARDS: IdeaCardProps[] = [
  DISCOVERED_CARD,
  RECOMMENDED_CARD,
  IN_PIPELINE_CARD,
  SHIPPED_CARD,
  DISCARDED_CARD,
];

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("IdeaBoardView — rendering", () => {
  it("renders without throwing", () => {
    expect(() => render(<IdeaBoardView cards={ALL_CARDS} />)).not.toThrow();
  });

  it("has data-testid='idea-board' on the root element", () => {
    render(<IdeaBoardView cards={ALL_CARDS} />);
    expect(screen.getByTestId("idea-board")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Columns — present for every lifecycle status
// ---------------------------------------------------------------------------

describe("IdeaBoardView — board columns", () => {
  it("renders a 'discovered' column", () => {
    render(<IdeaBoardView cards={ALL_CARDS} />);
    expect(screen.getByTestId("board-column-discovered")).toBeInTheDocument();
  });

  it("renders a 'documented' column (WO-02-005: in-pipeline cards route to documented by default)", () => {
    render(<IdeaBoardView cards={ALL_CARDS} />);
    expect(screen.getByTestId("board-column-documented")).toBeInTheDocument();
  });

  it("renders a 'shipped' column", () => {
    render(<IdeaBoardView cards={ALL_CARDS} />);
    expect(screen.getByTestId("board-column-shipped")).toBeInTheDocument();
  });

  it("renders a 'discarded' column", () => {
    render(<IdeaBoardView cards={ALL_CARDS} />);
    expect(screen.getByTestId("board-column-discarded")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Cards distributed into columns
// ---------------------------------------------------------------------------

describe("IdeaBoardView — cards in correct columns", () => {
  it("discovered card appears in the discovered column", () => {
    render(<IdeaBoardView cards={ALL_CARDS} />);
    const col = screen.getByTestId("board-column-discovered");
    expect(col).toHaveTextContent("Idea Descubierta");
  });

  it("recommended card appears in the discovered column (AC-02-001)", () => {
    render(<IdeaBoardView cards={ALL_CARDS} />);
    const col = screen.getByTestId("board-column-discovered");
    expect(col).toHaveTextContent("Idea Recomendada");
  });

  it("in-pipeline card without boardColumn falls back to documented column (WO-02-005 fallback)", () => {
    render(<IdeaBoardView cards={ALL_CARDS} />);
    const col = screen.getByTestId("board-column-documented");
    expect(col).toHaveTextContent("Idea En Progreso");
  });

  it("shipped card appears in the shipped column", () => {
    render(<IdeaBoardView cards={ALL_CARDS} />);
    const col = screen.getByTestId("board-column-shipped");
    expect(col).toHaveTextContent("Idea Enviada");
  });

  it("discarded card appears in the discarded column", () => {
    render(<IdeaBoardView cards={ALL_CARDS} />);
    const col = screen.getByTestId("board-column-discarded");
    expect(col).toHaveTextContent("Idea Descartada");
  });
});

// ---------------------------------------------------------------------------
// Read-only: no drag handles (AC-02-002.1)
// ---------------------------------------------------------------------------

describe("IdeaBoardView — read-only (AC-02-002.1)", () => {
  it("does not render any drag handle elements", () => {
    render(<IdeaBoardView cards={ALL_CARDS} />);
    expect(screen.queryByTestId("idea-card-drag-handle")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty state: no cards → board renders with empty columns, no crash
// ---------------------------------------------------------------------------

describe("IdeaBoardView — empty state", () => {
  it("renders without error when cards array is empty", () => {
    expect(() => render(<IdeaBoardView cards={[]} />)).not.toThrow();
  });

  it("shows empty state message when no cards are present", () => {
    render(<IdeaBoardView cards={[]} />);
    expect(screen.getByTestId("board-empty-state")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Loading state: prop-driven
// ---------------------------------------------------------------------------

describe("IdeaBoardView — loading state", () => {
  it("renders the loading state when isLoading is true", () => {
    render(<IdeaBoardView cards={[]} isLoading />);
    expect(screen.getByTestId("board-loading-state")).toBeInTheDocument();
  });

  it("does NOT render the loading state when isLoading is false", () => {
    render(<IdeaBoardView cards={ALL_CARDS} isLoading={false} />);
    expect(screen.queryByTestId("board-loading-state")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state: prop-driven
// ---------------------------------------------------------------------------

describe("IdeaBoardView — error state", () => {
  it("renders the error state when error is provided", () => {
    render(<IdeaBoardView cards={[]} error="No se pudo leer las ideas." />);
    expect(screen.getByTestId("board-error-state")).toBeInTheDocument();
  });

  it("error state shows the error message", () => {
    render(<IdeaBoardView cards={[]} error="No se pudo leer las ideas." />);
    expect(screen.getByTestId("board-error-state")).toHaveTextContent("No se pudo leer las ideas.");
  });

  it("does NOT render the error state when no error", () => {
    render(<IdeaBoardView cards={ALL_CARDS} />);
    expect(screen.queryByTestId("board-error-state")).not.toBeInTheDocument();
  });
});
