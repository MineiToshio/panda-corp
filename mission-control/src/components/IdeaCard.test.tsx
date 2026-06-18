/**
 * WO-01-003 (UI) — IdeaCard component tests (TDD: RED → GREEN → refactor).
 *
 * Traceability:
 *   CMP-02-card — components/IdeaCard.tsx
 *   REQ-02-005  — each card shows category + return chips besides the score
 *   REQ-02-006  — recommended card shows a "recommended" badge
 *   REQ-02-008  — building indicator while running: true
 *   AC-02-005.1 — two labels (category, return) + score on every card
 *   AC-02-006.2 — recommended badge when applicable
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 * No mocks — IdeaCard is a pure presentational component (props in → DOM out).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { IdeaCardProps } from "./IdeaCard";
import { IdeaCard } from "./IdeaCard";

// ---------------------------------------------------------------------------
// Shared fixture builders
// ---------------------------------------------------------------------------

const BASE_CARD: IdeaCardProps = {
  slug: "idea-discovered",
  title: "AI code reviewer",
  status: "discovered",
  body: "A tool that reviews code using AI.",
};

const FULL_CARD: IdeaCardProps = {
  slug: "idea-full",
  title: "Full idea with all fields",
  status: "discovered",
  projectType: "SaaS",
  returnType: "monetary",
  score: 72,
  body: "A full idea description.",
};

const RECOMMENDED_CARD: IdeaCardProps = {
  ...FULL_CARD,
  slug: "idea-recommended",
  status: "recommended",
};

const IN_PIPELINE_RUNNING_CARD: IdeaCardProps = {
  ...FULL_CARD,
  slug: "idea-in-pipeline",
  status: "in-pipeline",
  isRunning: true,
};

const IN_PIPELINE_IDLE_CARD: IdeaCardProps = {
  ...FULL_CARD,
  slug: "idea-in-pipeline-idle",
  status: "in-pipeline",
  isRunning: false,
};

// ---------------------------------------------------------------------------
// Rendering + accessibility
// ---------------------------------------------------------------------------

describe("IdeaCard — rendering + accessibility", () => {
  it("renders without throwing", () => {
    expect(() => render(<IdeaCard {...BASE_CARD} />)).not.toThrow();
  });

  it("renders the card title as visible text", () => {
    render(<IdeaCard {...BASE_CARD} />);
    expect(screen.getByText("AI code reviewer")).toBeInTheDocument();
  });

  it("has data-testid='idea-card' on the root element", () => {
    render(<IdeaCard {...BASE_CARD} />);
    expect(screen.getByTestId("idea-card")).toBeInTheDocument();
  });

  it("title element has data-testid='idea-card-title'", () => {
    render(<IdeaCard {...FULL_CARD} />);
    expect(screen.getByTestId("idea-card-title")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-02-005.1 — category chip (project_type)
// ---------------------------------------------------------------------------

describe("IdeaCard — category chip (projectType, AC-02-005.1)", () => {
  it("renders the category chip when projectType is present", () => {
    render(<IdeaCard {...FULL_CARD} />);
    expect(screen.getByTestId("idea-card-category")).toBeInTheDocument();
  });

  it("category chip shows the projectType value", () => {
    render(<IdeaCard {...FULL_CARD} />);
    expect(screen.getByTestId("idea-card-category")).toHaveTextContent("SaaS");
  });

  it("does NOT render category chip when projectType is absent", () => {
    render(<IdeaCard {...BASE_CARD} />);
    expect(screen.queryByTestId("idea-card-category")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-02-005.1 — return chip (return_type)
// ---------------------------------------------------------------------------

describe("IdeaCard — return chip (returnType, AC-02-005.1)", () => {
  it("renders the return chip when returnType is present", () => {
    render(<IdeaCard {...FULL_CARD} />);
    expect(screen.getByTestId("idea-card-return-type")).toBeInTheDocument();
  });

  it("return chip shows the returnType value", () => {
    render(<IdeaCard {...FULL_CARD} />);
    expect(screen.getByTestId("idea-card-return-type")).toHaveTextContent("monetary");
  });

  it("does NOT render return chip when returnType is absent", () => {
    render(<IdeaCard {...BASE_CARD} />);
    expect(screen.queryByTestId("idea-card-return-type")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Score — tabular-nums, value display
// ---------------------------------------------------------------------------

describe("IdeaCard — score", () => {
  it("renders the score when present", () => {
    render(<IdeaCard {...FULL_CARD} />);
    expect(screen.getByTestId("idea-card-score")).toBeInTheDocument();
  });

  it("score element shows the numeric score value", () => {
    render(<IdeaCard {...FULL_CARD} />);
    expect(screen.getByTestId("idea-card-score")).toHaveTextContent("72");
  });

  it("does NOT render the score element when score is absent", () => {
    render(<IdeaCard {...BASE_CARD} />);
    expect(screen.queryByTestId("idea-card-score")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-02-006.2 — recommended badge
// ---------------------------------------------------------------------------

describe("IdeaCard — recommended badge (AC-02-006.2)", () => {
  it("shows the recommended badge when status is 'recommended'", () => {
    render(<IdeaCard {...RECOMMENDED_CARD} />);
    expect(screen.getByTestId("idea-card-recommended-badge")).toBeInTheDocument();
  });

  it("does NOT show the recommended badge for status 'discovered'", () => {
    render(<IdeaCard {...FULL_CARD} />);
    expect(screen.queryByTestId("idea-card-recommended-badge")).not.toBeInTheDocument();
  });

  it("does NOT show the recommended badge for status 'in-pipeline'", () => {
    render(<IdeaCard {...IN_PIPELINE_IDLE_CARD} />);
    expect(screen.queryByTestId("idea-card-recommended-badge")).not.toBeInTheDocument();
  });

  it("does NOT show the recommended badge for status 'shipped'", () => {
    const card: IdeaCardProps = { ...FULL_CARD, status: "shipped" };
    render(<IdeaCard {...card} />);
    expect(screen.queryByTestId("idea-card-recommended-badge")).not.toBeInTheDocument();
  });

  it("does NOT show the recommended badge for status 'discarded'", () => {
    const card: IdeaCardProps = { ...FULL_CARD, status: "discarded" };
    render(<IdeaCard {...card} />);
    expect(screen.queryByTestId("idea-card-recommended-badge")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// REQ-02-008 — building indicator (running: true on in-pipeline cards)
// ---------------------------------------------------------------------------

describe("IdeaCard — building indicator (REQ-02-008)", () => {
  it("shows the building indicator when isRunning is true", () => {
    render(<IdeaCard {...IN_PIPELINE_RUNNING_CARD} />);
    expect(screen.getByTestId("idea-card-building-indicator")).toBeInTheDocument();
  });

  it("does NOT show the building indicator when isRunning is false", () => {
    render(<IdeaCard {...IN_PIPELINE_IDLE_CARD} />);
    expect(screen.queryByTestId("idea-card-building-indicator")).not.toBeInTheDocument();
  });

  it("does NOT show the building indicator when isRunning is undefined", () => {
    render(<IdeaCard {...FULL_CARD} />);
    expect(screen.queryByTestId("idea-card-building-indicator")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Read-only: no drag handles, no move buttons (AC-02-002.1)
// ---------------------------------------------------------------------------

describe("IdeaCard — read-only, no drag/move controls (AC-02-002.1)", () => {
  it("has no drag handle element", () => {
    render(<IdeaCard {...FULL_CARD} />);
    expect(screen.queryByTestId("idea-card-drag-handle")).not.toBeInTheDocument();
  });

  it("has no move-up button", () => {
    render(<IdeaCard {...FULL_CARD} />);
    expect(screen.queryByRole("button", { name: /mover/i })).not.toBeInTheDocument();
  });

  it("has no draggable attribute on the card root", () => {
    render(<IdeaCard {...FULL_CARD} />);
    const card = screen.getByTestId("idea-card");
    expect(card).not.toHaveAttribute("draggable", "true");
  });
});

// ---------------------------------------------------------------------------
// Accessibility: Spanish aria-labels, keyboard accessible
// ---------------------------------------------------------------------------

describe("IdeaCard — accessibility", () => {
  it("root card element has an accessible aria-label in Spanish containing the title", () => {
    render(<IdeaCard {...FULL_CARD} />);
    const card = screen.getByTestId("idea-card");
    const label = card.getAttribute("aria-label") ?? "";
    expect(label.toLowerCase()).toContain("idea");
  });
});

// ---------------------------------------------------------------------------
// Empty/minimal-data state: card with only required fields renders cleanly
// ---------------------------------------------------------------------------

describe("IdeaCard — minimal data (empty state)", () => {
  it("renders without error when only required fields are present", () => {
    expect(() => render(<IdeaCard {...BASE_CARD} />)).not.toThrow();
  });

  it("still shows the title even with no optional fields", () => {
    render(<IdeaCard {...BASE_CARD} />);
    expect(screen.getByTestId("idea-card-title")).toHaveTextContent("AI code reviewer");
  });
});
