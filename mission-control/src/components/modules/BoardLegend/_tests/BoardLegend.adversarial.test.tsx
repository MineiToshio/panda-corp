/**
 * WO-02-008 — BoardLegend ADVERSARIAL tests (reviewer, DR-015).
 *
 * The legend is ONE compact inline line (prototype `boardView()` footer), not a
 * multi-section panel — so the edge cases shift from "per-entry" structure to
 * "the single line is complete, honest and static":
 *   1. The line covers EVERY axis term the FRD names (categories + returns) —
 *      none silently dropped.
 *   2. The score is explained with its 0–100 range, not just the bare word.
 *   3. The play-icon → "construyéndose ahora" meaning is spelled out (the
 *      building indicator the board uses must be decoded in the legend).
 *   4. Idempotent render — two mounts produce identical text (fully static).
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BoardLegend } from "@/components/modules/BoardLegend/BoardLegend";

const CATEGORY_TERMS = ["web", "mobile", "desktop", "rework"];
const RETURN_TERMS = ["monetario", "oportunidad", "personal", "mixto"];

function legendText(): string {
  return (screen.getByTestId("board-legend").textContent ?? "").toLowerCase();
}

// ---------------------------------------------------------------------------
// 1. Every FRD axis term is present in the single line
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — legend covers every axis term", () => {
  it("frd-02: AC-02-008.3 — WHEN rendered THEN every known category term appears", () => {
    render(<BoardLegend />);
    const text = legendText();
    for (const cat of CATEGORY_TERMS) {
      expect(text).toContain(cat);
    }
  });

  it("frd-02: AC-02-008.3 — WHEN rendered THEN every known return term appears", () => {
    render(<BoardLegend />);
    const text = legendText();
    for (const rt of RETURN_TERMS) {
      expect(text).toContain(rt);
    }
  });

  it("frd-02: AC-02-008.3 — WHEN rendered THEN both axes are labelled", () => {
    render(<BoardLegend />);
    const text = legendText();
    expect(text).toContain("categoría");
    expect(text).toContain("retorno");
  });
});

// ---------------------------------------------------------------------------
// 2. Score is explained with its range / meaning
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — score legend explains the metric", () => {
  it("frd-02: AC-02-008.3 — score is named (score / puntuación) AND its 0–100 range stated", () => {
    render(<BoardLegend />);
    const text = legendText();
    expect(text.includes("score") || text.includes("puntuaci")).toBe(true);
    expect(text.includes("0") && text.includes("100")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. The building indicator is decoded
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — legend decodes the building indicator", () => {
  it("frd-02: AC-02-008.3 — WHEN rendered THEN it explains the play icon means 'construyéndose ahora'", () => {
    render(<BoardLegend />);
    expect(legendText()).toContain("construyéndose");
  });
});

// ---------------------------------------------------------------------------
// 4. Static / idempotent
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — legend is static and idempotent", () => {
  it("frd-02: AC-02-008.3 — two independent renders yield identical text", () => {
    const first = render(<BoardLegend />);
    const firstText = first.getByTestId("board-legend").textContent ?? "";
    first.unmount();

    const second = render(<BoardLegend />);
    const secondText = second.getByTestId("board-legend").textContent ?? "";

    expect(secondText).toBe(firstText);
  });
});
