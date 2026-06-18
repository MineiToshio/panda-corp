/**
 * WO-06-011 (La Fragua retry) — PartyEmptyState updated copy tests — RED phase.
 *
 * AC-06-010.1: IF there is no FRD currently in build (no active team / no events),
 * THEN THE system SHALL show a graceful empty state, never a blank or crash.
 *
 * The La Fragua redesign changes the empty-state copy from "no active team" to
 * "no FRD in build" — more accurate given the per-FRD scene model.
 *
 * Tests:
 *   - The heading reads "No hay un FRD en construcción" (updated copy, WO-06-011 retry)
 *   - The aria-label reflects the new "FRD" framing
 *   - Does not crash on mount
 *   - Guidance still points to /pandacorp:implement
 *
 * Traceability:
 *   AC-06-010.1 → REQ-06-010 (empty state)
 *   CMP-06-empty (PartyEmptyState) — WO-06-011 La Fragua retry
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PartyEmptyState } from "../PartyEmptyState";

// ---------------------------------------------------------------------------
// AC-06-010.1 — updated copy: "No hay un FRD en construcción"
// ---------------------------------------------------------------------------

describe("frd-06: PartyEmptyState — La Fragua retry copy (AC-06-010.1)", () => {
  it("frd-06: WHEN rendered THEN heading reads 'No hay un FRD en construcción'", () => {
    render(<PartyEmptyState />);
    // The heading must use the per-FRD framing (La Fragua redesign)
    expect(screen.getByText(/No hay un FRD en construcción/i)).toBeInTheDocument();
  });

  it("frd-06: WHEN rendered THEN guidance references /pandacorp:implement", () => {
    render(<PartyEmptyState />);
    const el = screen.getByTestId("party-empty-state");
    expect(el.textContent).toContain("/pandacorp:implement");
  });

  it("frd-06: WHEN rendered THEN does not crash", () => {
    expect(() => render(<PartyEmptyState />)).not.toThrow();
  });

  it("frd-06: WHEN rendered THEN the aria-label mentions FRD or construcción", () => {
    render(<PartyEmptyState />);
    const el = screen.getByTestId("party-empty-state");
    const label = el.getAttribute("aria-label") ?? "";
    // Label must reflect the FRD / build framing (not just "equipo")
    expect(label.toLowerCase()).toMatch(/frd|construcci/);
  });
});
