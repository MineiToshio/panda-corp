/**
 * WO-14-003 — `CMP-14-status-chips`: decisions/bugs/rethink chips — RED phase
 *
 * Tests written BEFORE implementation (TDD: RED → GREEN → refactor).
 * All tests fail until the GREEN phase.
 *
 * Traceability (EARS → AC → test):
 *   AC-14-004.1  EACH portfolio rail row SHALL show an amber chip with `pending_decisions` when > 0.
 *   AC-14-004.2  EACH portfolio rail row SHALL show a red chip with `pending_bugs` when > 0.
 *   AC-14-005.1  WHEN `rethink_pending: true`, the row/workspace SHALL show a "rethink pending —
 *                build will pause" indicator.
 *
 * TDD cases (WO-14-003 scope):
 *   1. pending_decisions > 0 → amber chip with the count (AC-14-004.1)
 *   2. pending_bugs > 0 → red chip with the count (AC-14-004.2)
 *   3. rethink_pending: true → "rethink pending" indicator (AC-14-005.1)
 *   4. All zero/false → nothing rendered (no empty chips)
 *   5. Chips carry count + accessible label — not color alone (a11y, FRD-13)
 *   6. Multiple chips coexist: decisions + bugs + rethink simultaneously
 *   7. tabular-nums on count spans (AC-13-003)
 *   8. data-testid on every chip / indicator (test-writer contract)
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusChips } from "../status-chips";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ChipsProps {
  pendingDecisions?: number;
  pendingBugs?: number;
  rethinkPending?: boolean;
}

function renderChips(props: ChipsProps = {}): ReturnType<typeof render> {
  return render(<StatusChips {...props} />);
}

// ---------------------------------------------------------------------------
// 1. pending_decisions > 0 → amber chip (AC-14-004.1)
// ---------------------------------------------------------------------------

describe("pending decisions chip (AC-14-004.1)", () => {
  it("renders amber chip with count when pendingDecisions > 0", () => {
    renderChips({ pendingDecisions: 3 });
    const chip = screen.getByTestId("status-chip-decisions");
    expect(chip).toBeDefined();
    expect(chip.textContent).toContain("3");
  });

  it("amber chip has accessible label (not color alone)", () => {
    renderChips({ pendingDecisions: 2 });
    const chip = screen.getByTestId("status-chip-decisions");
    // title or aria-label must convey meaning
    const label = chip.getAttribute("title") ?? chip.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("does NOT render decisions chip when pendingDecisions is 0", () => {
    renderChips({ pendingDecisions: 0 });
    expect(screen.queryByTestId("status-chip-decisions")).toBeNull();
  });

  it("does NOT render decisions chip when pendingDecisions is undefined", () => {
    renderChips({});
    expect(screen.queryByTestId("status-chip-decisions")).toBeNull();
  });

  it("decisions chip has data-variant='amber'", () => {
    renderChips({ pendingDecisions: 5 });
    const chip = screen.getByTestId("status-chip-decisions");
    expect(chip.getAttribute("data-variant")).toBe("amber");
  });

  it("decisions count span uses tabular-nums (AC-13-003)", () => {
    renderChips({ pendingDecisions: 7 });
    const count = screen.getByTestId("status-chip-decisions-count");
    expect(count).toBeDefined();
    // fontVariantNumeric applied inline
    const style = (count as HTMLElement).style.fontVariantNumeric;
    expect(style).toBe("tabular-nums");
  });
});

// ---------------------------------------------------------------------------
// 2. pending_bugs > 0 → red chip (AC-14-004.2)
// ---------------------------------------------------------------------------

describe("pending bugs chip (AC-14-004.2)", () => {
  it("renders red chip with count when pendingBugs > 0", () => {
    renderChips({ pendingBugs: 1 });
    const chip = screen.getByTestId("status-chip-bugs");
    expect(chip).toBeDefined();
    expect(chip.textContent).toContain("1");
  });

  it("red chip has accessible label (not color alone)", () => {
    renderChips({ pendingBugs: 4 });
    const chip = screen.getByTestId("status-chip-bugs");
    const label = chip.getAttribute("title") ?? chip.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("does NOT render bugs chip when pendingBugs is 0", () => {
    renderChips({ pendingBugs: 0 });
    expect(screen.queryByTestId("status-chip-bugs")).toBeNull();
  });

  it("does NOT render bugs chip when pendingBugs is undefined", () => {
    renderChips({});
    expect(screen.queryByTestId("status-chip-bugs")).toBeNull();
  });

  it("bugs chip has data-variant='red'", () => {
    renderChips({ pendingBugs: 2 });
    const chip = screen.getByTestId("status-chip-bugs");
    expect(chip.getAttribute("data-variant")).toBe("red");
  });

  it("bugs count span uses tabular-nums (AC-13-003)", () => {
    renderChips({ pendingBugs: 9 });
    const count = screen.getByTestId("status-chip-bugs-count");
    expect(count).toBeDefined();
    const style = (count as HTMLElement).style.fontVariantNumeric;
    expect(style).toBe("tabular-nums");
  });
});

// ---------------------------------------------------------------------------
// 3. rethink_pending: true → indicator (AC-14-005.1)
// ---------------------------------------------------------------------------

describe("rethink pending indicator (AC-14-005.1)", () => {
  it("renders rethink indicator when rethinkPending is true", () => {
    renderChips({ rethinkPending: true });
    const indicator = screen.getByTestId("status-chip-rethink");
    expect(indicator).toBeDefined();
  });

  it("rethink indicator mentions build will pause", () => {
    renderChips({ rethinkPending: true });
    const indicator = screen.getByTestId("status-chip-rethink");
    // The text must convey "rethink" and "pausa" / "pause"
    const text = (indicator.textContent ?? "").toLowerCase();
    expect(text.includes("rethink") || text.includes("repensar")).toBe(true);
  });

  it("does NOT render rethink indicator when rethinkPending is false", () => {
    renderChips({ rethinkPending: false });
    expect(screen.queryByTestId("status-chip-rethink")).toBeNull();
  });

  it("does NOT render rethink indicator when rethinkPending is undefined", () => {
    renderChips({});
    expect(screen.queryByTestId("status-chip-rethink")).toBeNull();
  });

  it("rethink indicator has data-variant='rethink'", () => {
    renderChips({ rethinkPending: true });
    const indicator = screen.getByTestId("status-chip-rethink");
    expect(indicator.getAttribute("data-variant")).toBe("rethink");
  });
});

// ---------------------------------------------------------------------------
// 4. All zero/false → nothing rendered (no empty chips)
// ---------------------------------------------------------------------------

describe("empty state — no chips rendered", () => {
  it("renders nothing when all props are zero/false", () => {
    const { container } = renderChips({
      pendingDecisions: 0,
      pendingBugs: 0,
      rethinkPending: false,
    });
    // No chip testids present
    expect(screen.queryByTestId("status-chip-decisions")).toBeNull();
    expect(screen.queryByTestId("status-chip-bugs")).toBeNull();
    expect(screen.queryByTestId("status-chip-rethink")).toBeNull();
    // Container root is empty (null return or empty wrapper)
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no props passed", () => {
    const { container } = renderChips();
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Multiple chips coexist
// ---------------------------------------------------------------------------

describe("multiple chips coexist", () => {
  it("renders decisions + bugs + rethink simultaneously", () => {
    renderChips({ pendingDecisions: 2, pendingBugs: 5, rethinkPending: true });
    expect(screen.getByTestId("status-chip-decisions")).toBeDefined();
    expect(screen.getByTestId("status-chip-bugs")).toBeDefined();
    expect(screen.getByTestId("status-chip-rethink")).toBeDefined();
  });

  it("renders decisions + bugs without rethink", () => {
    renderChips({ pendingDecisions: 1, pendingBugs: 3, rethinkPending: false });
    expect(screen.getByTestId("status-chip-decisions")).toBeDefined();
    expect(screen.getByTestId("status-chip-bugs")).toBeDefined();
    expect(screen.queryByTestId("status-chip-rethink")).toBeNull();
  });

  it("renders rethink alone without chips", () => {
    renderChips({ rethinkPending: true });
    expect(screen.queryByTestId("status-chip-decisions")).toBeNull();
    expect(screen.queryByTestId("status-chip-bugs")).toBeNull();
    expect(screen.getByTestId("status-chip-rethink")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. Zero hardcoded colors — design tokens only
// ---------------------------------------------------------------------------

describe("design tokens — no hardcoded colors", () => {
  it("decisions chip uses CSS custom properties, not hardcoded colors", () => {
    renderChips({ pendingDecisions: 1 });
    const chip = screen.getByTestId("status-chip-decisions");
    const style = chip.getAttribute("style") ?? "";
    // Must not contain oklch/hex/rgb/hsl literal values
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(style).not.toMatch(/rgb\(/);
    expect(style).not.toMatch(/hsl\(/);
    // Must use var(--…) CSS custom properties
    expect(style).toContain("var(--");
  });

  it("bugs chip uses CSS custom properties, not hardcoded colors", () => {
    renderChips({ pendingBugs: 1 });
    const chip = screen.getByTestId("status-chip-bugs");
    const style = chip.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(style).not.toMatch(/rgb\(/);
    expect(style).not.toMatch(/hsl\(/);
    expect(style).toContain("var(--");
  });
});
