/**
 * WO-02-008 — BoardLegend component tests (RED phase).
 *
 * Written BEFORE implementation per TDD protocol.
 *
 * Traceability:
 *   CMP-02-legend → components/BoardLegend.tsx
 *   AC-02-008.3 — Category, return and score are shown with a legend explaining them.
 *   REQ-02-008  — legend explaining category / return / score.
 *   FRD-02 edge case: "Category (web/mobile/desktop/AI/…), return
 *     (monetary/opportunity/personal/mixed) and score are shown with a legend
 *     explaining them."
 *
 * Contract (from WO-02-008 design):
 *   - data-testid="board-legend" on the root element.
 *   - data-testid="board-legend-category-section" — section for project_type entries.
 *   - data-testid="board-legend-return-section" — section for return_type entries.
 *   - data-testid="board-legend-score-section" — section explaining the score field.
 *   - data-testid="board-legend-category-entry" (one per known category) inside the category section.
 *   - data-testid="board-legend-return-entry" (one per return type) inside the return section.
 *   - Static, accessible, no props required (self-contained i18n data).
 *
 * Known categories (FRD-02 examples): web, mobile, desktop, ai, claude-code,
 *   prompt-system, automation, cli, rework.
 * Known return types: monetary, opportunity, personal, mixed.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 * No implementation exists yet — all tests MUST fail RED.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BoardLegend } from "@/components/modules/BoardLegend/BoardLegend";

// ---------------------------------------------------------------------------
// Known values from FRD-02
// ---------------------------------------------------------------------------

const KNOWN_CATEGORIES = [
  "web",
  "mobile",
  "desktop",
  "ai",
  "claude-code",
  "prompt-system",
  "automation",
  "cli",
  "rework",
];

const KNOWN_RETURN_TYPES = ["monetary", "opportunity", "personal", "mixed"];

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.3 — renders the legend container
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — BoardLegend renders correctly", () => {
  it("frd-02: AC-02-008.3 — WHEN rendered THEN shows the legend container", () => {
    render(<BoardLegend />);
    expect(screen.getByTestId("board-legend")).toBeInTheDocument();
  });

  it("frd-02: AC-02-008.3 — WHEN rendered THEN shows the category section", () => {
    render(<BoardLegend />);
    expect(screen.getByTestId("board-legend-category-section")).toBeInTheDocument();
  });

  it("frd-02: AC-02-008.3 — WHEN rendered THEN shows the return-type section", () => {
    render(<BoardLegend />);
    expect(screen.getByTestId("board-legend-return-section")).toBeInTheDocument();
  });

  it("frd-02: AC-02-008.3 — WHEN rendered THEN shows the score section", () => {
    render(<BoardLegend />);
    expect(screen.getByTestId("board-legend-score-section")).toBeInTheDocument();
  });

  it("frd-02: AC-02-008.3 — WHEN rendered THEN does not throw", () => {
    expect(() => render(<BoardLegend />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.3 — category entries (one per known project_type)
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — BoardLegend category entries", () => {
  it("frd-02: AC-02-008.3 — WHEN rendered THEN category section contains at least one entry per known type", () => {
    render(<BoardLegend />);
    const section = screen.getByTestId("board-legend-category-section");
    const entries = within(section).getAllByTestId("board-legend-category-entry");
    expect(entries.length).toBeGreaterThanOrEqual(KNOWN_CATEGORIES.length);
  });

  for (const cat of KNOWN_CATEGORIES) {
    it(`frd-02: AC-02-008.3 — WHEN rendered THEN category section includes an entry for '${cat}'`, () => {
      render(<BoardLegend />);
      const section = screen.getByTestId("board-legend-category-section");
      const entries = within(section).getAllByTestId("board-legend-category-entry");
      const texts = entries.map((e) => e.textContent ?? "");
      expect(texts.some((t) => t.toLowerCase().includes(cat))).toBe(true);
    });
  }

  it("frd-02: AC-02-008.3 — WHEN rendered THEN each category entry has a non-empty explanation", () => {
    render(<BoardLegend />);
    const section = screen.getByTestId("board-legend-category-section");
    const entries = within(section).getAllByTestId("board-legend-category-entry");
    for (const entry of entries) {
      // Each entry must contain both the category label AND some explanatory text
      expect((entry.textContent ?? "").trim().length).toBeGreaterThan(3);
    }
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.3 — return-type entries (monetary, opportunity, personal, mixed)
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — BoardLegend return-type entries", () => {
  it("frd-02: AC-02-008.3 — WHEN rendered THEN return section has exactly 4 entries", () => {
    render(<BoardLegend />);
    const section = screen.getByTestId("board-legend-return-section");
    const entries = within(section).getAllByTestId("board-legend-return-entry");
    expect(entries).toHaveLength(KNOWN_RETURN_TYPES.length);
  });

  for (const rt of KNOWN_RETURN_TYPES) {
    it(`frd-02: AC-02-008.3 — WHEN rendered THEN return section includes an entry for '${rt}'`, () => {
      render(<BoardLegend />);
      const section = screen.getByTestId("board-legend-return-section");
      const entries = within(section).getAllByTestId("board-legend-return-entry");
      const texts = entries.map((e) => e.textContent ?? "");
      expect(texts.some((t) => t.toLowerCase().includes(rt))).toBe(true);
    });
  }

  it("frd-02: AC-02-008.3 — WHEN rendered THEN each return entry has a non-empty explanation", () => {
    render(<BoardLegend />);
    const section = screen.getByTestId("board-legend-return-section");
    const entries = within(section).getAllByTestId("board-legend-return-entry");
    for (const entry of entries) {
      expect((entry.textContent ?? "").trim().length).toBeGreaterThan(3);
    }
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.3 — score section explains what the score means
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — BoardLegend score section", () => {
  it("frd-02: AC-02-008.3 — WHEN rendered THEN score section has visible explanatory text", () => {
    render(<BoardLegend />);
    const section = screen.getByTestId("board-legend-score-section");
    expect((section.textContent ?? "").trim().length).toBeGreaterThan(5);
  });

  it("frd-02: AC-02-008.3 — WHEN rendered THEN score section mentions 'score' or 'puntuación'", () => {
    render(<BoardLegend />);
    const section = screen.getByTestId("board-legend-score-section");
    const text = (section.textContent ?? "").toLowerCase();
    const mentionsScore = text.includes("score") || text.includes("puntuaci");
    expect(mentionsScore).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.3 — accessibility
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — BoardLegend accessibility", () => {
  it("frd-02: AC-02-008.3 — WHEN rendered THEN root element has an accessible role or landmark", () => {
    render(<BoardLegend />);
    const legend = screen.getByTestId("board-legend");
    // Must be a semantic landmark: <section>, <aside>, or explicit role
    const tag = legend.tagName.toLowerCase();
    const role = legend.getAttribute("role") ?? "";
    const isLandmark =
      tag === "section" ||
      tag === "aside" ||
      tag === "nav" ||
      role === "region" ||
      role === "complementary";
    expect(isLandmark).toBe(true);
  });

  it("frd-02: AC-02-008.3 — WHEN rendered THEN root element has an aria-label", () => {
    render(<BoardLegend />);
    const legend = screen.getByTestId("board-legend");
    const label = legend.getAttribute("aria-label") ?? legend.getAttribute("aria-labelledby") ?? "";
    expect(label.trim().length).toBeGreaterThan(0);
  });
});
