/**
 * WO-02-008 — IdeaCard building-indicator ADVERSARIAL tests (reviewer, DR-015).
 *
 * Edge cases the implementer did NOT cover for AC-02-008.2:
 *   1. score=0 (falsy) MUST still render with the building indicator — the
 *      `score !== undefined` guard must not be a truthiness check.
 *   2. The building indicator and the recommended badge are mutually exclusive
 *      by status (in-pipeline never recommended), but a defensive check: when
 *      status flips to in-pipeline the recommended badge disappears.
 *   3. The accessible label of the indicator is NON-COLOR (text + aria-label +
 *      role) — verify all three a11y affordances together (§7).
 *   4. Indicator does NOT leak into the title or category text (it is its own
 *      element, not concatenated).
 *   5. in-pipeline + isRunning=false → no indicator even though status qualifies.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { IdeaCardProps } from "./IdeaCard";
import { IdeaCard } from "./IdeaCard";

const IN_PIPELINE_RUNNING: IdeaCardProps = {
  slug: "p1",
  title: "Building project",
  status: "in-pipeline",
  projectType: "web",
  returnType: "mixed",
  isRunning: true,
  body: "x",
};

// ---------------------------------------------------------------------------
// 1. score=0 falsy edge
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.2 — falsy score=0 coexists with the building indicator", () => {
  it("frd-02: AC-02-008.2 — WHEN score=0 AND isRunning=true THEN both the score AND the indicator render", () => {
    render(<IdeaCard {...IN_PIPELINE_RUNNING} score={0} />);
    // score=0 is falsy; a truthiness guard would hide it. The contract uses
    // `score !== undefined`, so 0 must be visible.
    expect(screen.getByTestId("idea-card-score")).toHaveTextContent("0");
    expect(screen.getByTestId("idea-card-building-indicator")).toBeInTheDocument();
  });

  it("frd-02: AC-02-008.2 — WHEN score is undefined THEN no score element but indicator still renders", () => {
    const { score, ...noScore } = IN_PIPELINE_RUNNING;
    void score;
    render(<IdeaCard {...noScore} />);
    expect(screen.queryByTestId("idea-card-score")).not.toBeInTheDocument();
    expect(screen.getByTestId("idea-card-building-indicator")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Mutual exclusion with recommended badge
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.2 — building indicator and recommended badge do not co-occur", () => {
  it("frd-02: AC-02-008.2 — in-pipeline+running shows building but NOT recommended", () => {
    render(<IdeaCard {...IN_PIPELINE_RUNNING} />);
    expect(screen.getByTestId("idea-card-building-indicator")).toBeInTheDocument();
    expect(screen.queryByTestId("idea-card-recommended-badge")).not.toBeInTheDocument();
  });

  it("frd-02: AC-02-008.2 — recommended (not in-pipeline) shows recommended but NOT building, even with stale isRunning", () => {
    render(<IdeaCard slug="r1" title="Rec" status="recommended" body="x" isRunning={true} />);
    expect(screen.getByTestId("idea-card-recommended-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("idea-card-building-indicator")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Full a11y affordance bundle (not color-only)
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.2 — indicator carries text + aria-label + announcing role together", () => {
  it("frd-02: AC-02-008.2 — indicator has all three: visible text, aria-label, and role=status", () => {
    render(<IdeaCard {...IN_PIPELINE_RUNNING} />);
    const ind = screen.getByTestId("idea-card-building-indicator");
    expect((ind.textContent ?? "").trim().length).toBeGreaterThan(0);
    expect((ind.getAttribute("aria-label") ?? "").trim().length).toBeGreaterThan(0);
    expect(ind.getAttribute("role")).toBe("status");
  });
});

// ---------------------------------------------------------------------------
// 4. No text leakage between elements
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.2 — indicator text does not leak into title or category", () => {
  it("frd-02: AC-02-008.2 — title shows only the title, not the building label", () => {
    render(<IdeaCard {...IN_PIPELINE_RUNNING} />);
    const title = screen.getByTestId("idea-card-title");
    expect(title).toHaveTextContent("Building project");
    expect(title.textContent ?? "").not.toContain("construcción");
  });

  it("frd-02: AC-02-008.2 — category chip shows only the project type", () => {
    render(<IdeaCard {...IN_PIPELINE_RUNNING} />);
    const cat = screen.getByTestId("idea-card-category");
    expect((cat.textContent ?? "").trim()).toBe("web");
  });
});

// ---------------------------------------------------------------------------
// 5. in-pipeline + isRunning=false
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.2 — qualifying status but not running", () => {
  it("frd-02: AC-02-008.2 — WHEN in-pipeline AND isRunning=false THEN no building indicator", () => {
    render(<IdeaCard {...IN_PIPELINE_RUNNING} isRunning={false} />);
    expect(screen.queryByTestId("idea-card-building-indicator")).not.toBeInTheDocument();
  });
});
