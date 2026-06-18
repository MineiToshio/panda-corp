/**
 * WO-02-008 — IdeaCard building indicator tests (RED phase extension).
 *
 * Written BEFORE implementation per TDD protocol.
 *
 * The base IdeaCard tests in IdeaCard.test.tsx already cover the happy-path
 * and a basic `isRunning` check (REQ-02-008). This file anchors the WO-02-008
 * EARS criterion specifically and adds the edge cases and a11y requirements
 * that the WO definition of done demands:
 *   "icon + label — architecture §7 a11y" (not color alone).
 *
 * Traceability:
 *   CMP-02-card → components/IdeaCard.tsx
 *   AC-02-008.2 — WHILE an idea's project has running: true (phase implementation
 *     → "building" column), the system SHALL show an indicator on its card that
 *     it is being built.
 *   WO-02-008 design note: "icon + label — not color-only" (a11y §7).
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { IdeaCardProps } from "./IdeaCard";
import { IdeaCard } from "./IdeaCard";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_IN_PIPELINE: IdeaCardProps = {
  slug: "idea-building",
  title: "Idea being built",
  status: "in-pipeline",
  projectType: "ai",
  returnType: "monetary",
  score: 90,
  body: "An idea whose project is actively running.",
};

const RUNNING_CARD: IdeaCardProps = { ...BASE_IN_PIPELINE, isRunning: true };
const IDLE_CARD: IdeaCardProps = { ...BASE_IN_PIPELINE, isRunning: false };
const NO_RUNNING_FLAG: IdeaCardProps = { ...BASE_IN_PIPELINE };

// Non-pipeline cards that should never show the building indicator
const DISCOVERED_CARD: IdeaCardProps = {
  slug: "idea-disc",
  title: "Discovered",
  status: "discovered",
  body: "desc",
  isRunning: true, // malicious/accidental flag — must still NOT show indicator
};

const SHIPPED_RUNNING_CARD: IdeaCardProps = {
  slug: "idea-shipped",
  title: "Shipped",
  status: "shipped",
  body: "desc",
  isRunning: true, // edge: should be ignored for shipped cards
};

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.2 — building indicator presence
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.2 — building indicator shown WHILE running: true", () => {
  it("frd-02: AC-02-008.2 — WHILE isRunning=true THEN building indicator is in the DOM", () => {
    render(<IdeaCard {...RUNNING_CARD} />);
    expect(screen.getByTestId("idea-card-building-indicator")).toBeInTheDocument();
  });

  it("frd-02: AC-02-008.2 — WHILE isRunning=false THEN building indicator is absent", () => {
    render(<IdeaCard {...IDLE_CARD} />);
    expect(screen.queryByTestId("idea-card-building-indicator")).not.toBeInTheDocument();
  });

  it("frd-02: AC-02-008.2 — WHEN isRunning is undefined THEN building indicator is absent", () => {
    render(<IdeaCard {...NO_RUNNING_FLAG} />);
    expect(screen.queryByTestId("idea-card-building-indicator")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.2 — a11y: NOT color-only — must have text label (§7 arch)
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.2 — building indicator a11y: icon + label, not color-only", () => {
  it("frd-02: AC-02-008.2 — WHILE isRunning=true THEN indicator has non-empty visible text", () => {
    render(<IdeaCard {...RUNNING_CARD} />);
    const indicator = screen.getByTestId("idea-card-building-indicator");
    // Must carry text visible to sighted users — not rely on color alone (§7 a11y)
    expect((indicator.textContent ?? "").trim().length).toBeGreaterThan(0);
  });

  it("frd-02: AC-02-008.2 — WHILE isRunning=true THEN indicator has an aria-label for screen readers", () => {
    render(<IdeaCard {...RUNNING_CARD} />);
    const indicator = screen.getByTestId("idea-card-building-indicator");
    const ariaLabel = indicator.getAttribute("aria-label") ?? indicator.getAttribute("title") ?? "";
    expect(ariaLabel.trim().length).toBeGreaterThan(0);
  });

  it("frd-02: AC-02-008.2 — WHILE isRunning=true THEN indicator has role=status or role=img (announced by AT)", () => {
    render(<IdeaCard {...RUNNING_CARD} />);
    const indicator = screen.getByTestId("idea-card-building-indicator");
    const role = indicator.getAttribute("role") ?? "";
    expect(["status", "img", "note"].includes(role)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.2 — edge cases: status guards
// The building indicator must NOT appear on cards with non-pipeline statuses
// even if isRunning is accidentally set to true.
// Real defect class: if the guard is `isRunning` only (without checking status),
// a shipped idea with a stale `isRunning: true` would show the badge wrongly.
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.2 — building indicator edge cases and status guard", () => {
  it("frd-02: AC-02-008.2 — WHEN status=discovered and isRunning=true THEN no building indicator", () => {
    render(<IdeaCard {...DISCOVERED_CARD} />);
    expect(screen.queryByTestId("idea-card-building-indicator")).not.toBeInTheDocument();
  });

  it("frd-02: AC-02-008.2 — WHEN status=shipped and isRunning=true THEN no building indicator", () => {
    render(<IdeaCard {...SHIPPED_RUNNING_CARD} />);
    expect(screen.queryByTestId("idea-card-building-indicator")).not.toBeInTheDocument();
  });

  it("frd-02: AC-02-008.2 — WHEN status=recommended and isRunning=true THEN no building indicator", () => {
    const card: IdeaCardProps = {
      slug: "idea-rec",
      title: "Recommended",
      status: "recommended",
      body: "desc",
      isRunning: true,
    };
    render(<IdeaCard {...card} />);
    expect(screen.queryByTestId("idea-card-building-indicator")).not.toBeInTheDocument();
  });

  it("frd-02: AC-02-008.2 — WHEN status=discarded and isRunning=true THEN no building indicator", () => {
    const card: IdeaCardProps = {
      slug: "idea-disc2",
      title: "Discarded",
      status: "discarded",
      body: "desc",
      isRunning: true,
    };
    render(<IdeaCard {...card} />);
    expect(screen.queryByTestId("idea-card-building-indicator")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.2 — coexistence: building indicator + recommended badge
// A recommended in-pipeline card with isRunning=true is unusual but must not
// cause the two badges to conflict.
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.2 — building indicator coexists with other badges", () => {
  it("frd-02: AC-02-008.2 — WHEN in-pipeline and isRunning=true THEN recommended badge is NOT shown", () => {
    // in-pipeline cards are never recommended (status is exclusive)
    render(<IdeaCard {...RUNNING_CARD} />);
    expect(screen.queryByTestId("idea-card-recommended-badge")).not.toBeInTheDocument();
  });

  it("frd-02: AC-02-008.2 — WHEN in-pipeline and isRunning=true THEN category chip is still shown", () => {
    render(<IdeaCard {...RUNNING_CARD} />);
    expect(screen.getByTestId("idea-card-category")).toBeInTheDocument();
    expect(screen.getByTestId("idea-card-category")).toHaveTextContent("ai");
  });

  it("frd-02: AC-02-008.2 — WHEN in-pipeline and isRunning=true THEN score is still shown", () => {
    render(<IdeaCard {...RUNNING_CARD} />);
    expect(screen.getByTestId("idea-card-score")).toHaveTextContent("90");
  });

  it("frd-02: AC-02-008.2 — WHEN in-pipeline and isRunning=true THEN card renders exactly one building indicator", () => {
    render(<IdeaCard {...RUNNING_CARD} />);
    const indicators = screen.getAllByTestId("idea-card-building-indicator");
    expect(indicators).toHaveLength(1);
  });
});
