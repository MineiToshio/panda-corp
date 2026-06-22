/**
 * WO-02-008 — BoardLegend component tests.
 *
 * Traceability:
 *   CMP-02-legend → components/modules/BoardLegend/BoardLegend.tsx
 *   AC-02-008.3 — Category, return and score are shown with a legend explaining them.
 *   REQ-02-008  — legend explaining category / return / score.
 *   FRD-02 edge case: "Category (web/mobile/desktop/AI/…), return
 *     (monetary/opportunity/personal/mixed) and score are shown with a legend
 *     explaining them."
 *
 * Contract (repainted faithful to the prototype `boardView()` footer):
 *   - The legend is ONE compact line: a single `<p>` of inline text, NOT a
 *     multi-section panel. There are NO discrete per-category / per-return
 *     entry elements — the information is conveyed as inline prose.
 *   - data-testid="board-legend" on the root element, which is an accessible
 *     landmark (`<section>`) carrying an aria-label.
 *   - Static, accessible, no props required (self-contained i18n copy).
 *
 * Known categories (FRD-02 examples): web, mobile, desktop, IA, claude-code,
 *   prompts, automatización, CLI, rework.
 * Known return types: monetario, oportunidad, personal, mixto.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BoardLegend } from "@/components/modules/BoardLegend/BoardLegend";

// ---------------------------------------------------------------------------
// Key terms the single-line legend must mention (Spanish copy).
// ---------------------------------------------------------------------------

const CATEGORY_TERMS = ["web", "mobile", "desktop", "rework"];
const RETURN_TERMS = ["monetario", "oportunidad", "personal", "mixto"];

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.3 — renders the legend container
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — BoardLegend renders correctly", () => {
  it("frd-02: AC-02-008.3 — WHEN rendered THEN shows the legend container", () => {
    render(<BoardLegend />);
    expect(screen.getByTestId("board-legend")).toBeInTheDocument();
  });

  it("frd-02: AC-02-008.3 — WHEN rendered THEN does not throw", () => {
    expect(() => render(<BoardLegend />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.3 — category info (inline text mentions the known types)
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — BoardLegend category info", () => {
  it("frd-02: AC-02-008.3 — WHEN rendered THEN the legend labels the category axis", () => {
    render(<BoardLegend />);
    const text = (screen.getByTestId("board-legend").textContent ?? "").toLowerCase();
    expect(text).toContain("categoría");
  });

  for (const cat of CATEGORY_TERMS) {
    it(`frd-02: AC-02-008.3 — WHEN rendered THEN the legend text mentions '${cat}'`, () => {
      render(<BoardLegend />);
      const text = (screen.getByTestId("board-legend").textContent ?? "").toLowerCase();
      expect(text).toContain(cat);
    });
  }
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.3 — return-type info (monetario, oportunidad, personal, mixto)
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — BoardLegend return-type info", () => {
  it("frd-02: AC-02-008.3 — WHEN rendered THEN the legend labels the return axis", () => {
    render(<BoardLegend />);
    const text = (screen.getByTestId("board-legend").textContent ?? "").toLowerCase();
    expect(text).toContain("retorno");
  });

  for (const rt of RETURN_TERMS) {
    it(`frd-02: AC-02-008.3 — WHEN rendered THEN the legend text mentions '${rt}'`, () => {
      render(<BoardLegend />);
      const text = (screen.getByTestId("board-legend").textContent ?? "").toLowerCase();
      expect(text).toContain(rt);
    });
  }
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.3 — score info explains what the score means
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — BoardLegend score info", () => {
  it("frd-02: AC-02-008.3 — WHEN rendered THEN the legend has visible explanatory text", () => {
    render(<BoardLegend />);
    expect((screen.getByTestId("board-legend").textContent ?? "").trim().length).toBeGreaterThan(5);
  });

  it("frd-02: AC-02-008.3 — WHEN rendered THEN the legend mentions 'score' or 'puntuación'", () => {
    render(<BoardLegend />);
    const text = (screen.getByTestId("board-legend").textContent ?? "").toLowerCase();
    const mentionsScore = text.includes("score") || text.includes("puntuaci");
    expect(mentionsScore).toBe(true);
  });

  it("frd-02: AC-02-008.3 — WHEN rendered THEN the legend states the 0-100 range", () => {
    render(<BoardLegend />);
    const text = (screen.getByTestId("board-legend").textContent ?? "").toLowerCase();
    expect(text.includes("0") && text.includes("100")).toBe(true);
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
