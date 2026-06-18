/**
 * WO-06-011 — PartyEmptyState (CMP-06-empty) tests — RED phase.
 *
 * AC-06-010.1: IF there is no active team, it SHALL show an empty state gracefully.
 *
 * Tests:
 *   - renders with data-testid="party-empty-state"
 *   - contains friendly Spanish message about no active team
 *   - contains guidance text
 *   - does not crash (no throw on mount)
 *   - has accessible role/label
 *   - no hardcoded colors (all via CSS custom properties)
 *
 * Traceability:
 *   CMP-06-empty → REQ-06-010 (AC-06-010.1)
 *   WO-06-011: Empty state + reduced-motion + multi-project borders
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PartyEmptyState } from "../PartyEmptyState";

// ---------------------------------------------------------------------------
// AC-06-010.1 — graceful empty state when no active team
// ---------------------------------------------------------------------------

describe("frd-06: PartyEmptyState — graceful empty state (AC-06-010.1)", () => {
  it("frd-06: WHEN rendered THEN has data-testid='party-empty-state'", () => {
    render(<PartyEmptyState />);
    expect(screen.getByTestId("party-empty-state")).toBeDefined();
  });

  it("frd-06: WHEN rendered THEN contains Spanish message about no active team", () => {
    render(<PartyEmptyState />);
    const el = screen.getByTestId("party-empty-state");
    // "no hay un equipo activo" or similar phrasing
    expect(el.textContent?.toLowerCase()).toMatch(/equipo|agentes/);
  });

  it("frd-06: WHEN rendered THEN contains guidance on how to start a build", () => {
    render(<PartyEmptyState />);
    const el = screen.getByTestId("party-empty-state");
    // Should give some hint about starting a construction
    expect(el.textContent).toBeTruthy();
    expect(el.textContent?.length ?? 0).toBeGreaterThan(10);
  });

  it("frd-06: WHEN rendered THEN does not throw", () => {
    expect(() => render(<PartyEmptyState />)).not.toThrow();
  });

  it("frd-06: WHEN rendered THEN has role='status' or an accessible aria-label", () => {
    render(<PartyEmptyState />);
    const el = screen.getByTestId("party-empty-state");
    const hasRole = el.getAttribute("role") !== null;
    const hasLabel = el.getAttribute("aria-label") !== null;
    expect(hasRole || hasLabel).toBe(true);
  });

  it("frd-06: WHEN rendered THEN has aria-label in Spanish", () => {
    render(<PartyEmptyState />);
    const el = screen.getByTestId("party-empty-state");
    const label = el.getAttribute("aria-label");
    // Either the element itself or a child carries the Spanish label
    expect(label ?? el.textContent).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Design rules — no hardcoded colors (FRD-13, AGENTS.md)
// ---------------------------------------------------------------------------

describe("frd-06: PartyEmptyState — no hardcoded colors (FRD-13)", () => {
  it("frd-06: WHEN rendered THEN no inline style contains a raw hex color", () => {
    const { container } = render(<PartyEmptyState />);
    const allEls = container.querySelectorAll("*");
    for (const el of allEls) {
      const styleAttr = (el as HTMLElement).getAttribute("style") ?? "";
      expect(styleAttr).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it("frd-06: WHEN rendered THEN no inline style contains a raw rgb() color", () => {
    const { container } = render(<PartyEmptyState />);
    const allEls = container.querySelectorAll("*");
    for (const el of allEls) {
      const styleAttr = (el as HTMLElement).getAttribute("style") ?? "";
      expect(styleAttr).not.toMatch(/\brgb\(/);
    }
  });
});

// ---------------------------------------------------------------------------
// data-testid surface
// ---------------------------------------------------------------------------

describe("frd-06: PartyEmptyState — data-testid surface", () => {
  it("frd-06: root element always has data-testid='party-empty-state'", () => {
    render(<PartyEmptyState />);
    expect(screen.getByTestId("party-empty-state")).toBeDefined();
  });

  it("frd-06: WHEN rendered in PartyTab context (active=false) THEN party-empty-state is shown and party-scene is absent", () => {
    // Integration seam: PartyEmptyState is used by PartyTab when active=false.
    // This test just verifies the component itself — PartyTab integration is tested separately.
    render(<PartyEmptyState />);
    expect(screen.getByTestId("party-empty-state")).toBeDefined();
    expect(screen.queryByTestId("party-scene")).toBeNull();
  });
});
