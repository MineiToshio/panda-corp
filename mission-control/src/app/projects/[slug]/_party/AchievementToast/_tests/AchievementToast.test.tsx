/**
 * WO-06-008 — AchievementToast (CMP-06-achievement) — RED phase
 *
 * Tests for the achievement toast shown on work-order-close events.
 *
 * Acceptance criteria (EARS, verbatim from WO-06-008):
 *   AC-06-007.1: WHEN a work order closes, an achievement SHALL fire
 *                ("¡Logro desbloqueado!") with the work-order id.
 *
 * TDD checklist (from WO-06-008):
 *   1. A work-order-close event renders the toast with the WO id.
 *   2. A non-close event does NOT render the toast.
 *   3. With prefers-reduced-motion, the animation class is absent but the
 *      toast renders.
 *   4. The toast auto-dismisses (fake timers).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - data-testid on every interactive/structural element.
 *   - aria-live announcement (never steals focus).
 *   - Motion only uses transform/opacity, <300ms (FRD-13).
 *   - prefers-reduced-motion: show the toast without the animation.
 *
 * Traceability:
 *   CMP-06-achievement → REQ-06-007 → AC-06-007.1
 *   IF-06-event-vm (event-vm.ts, WO-06-001)
 *   IF-13-tokens (tokens.ts, WO-13-001) — motion tokens
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventVM } from "../../event-vm/event-vm";
import { AchievementToast } from "../AchievementToast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAchievementVM(workOrder?: string): EventVM {
  return {
    icon: "trophy",
    isFailure: false,
    label: "¡Logro desbloqueado!",
    at: "2026-06-17T12:00:00Z",
    workOrder,
  };
}

function makeNonAchievementVM(): EventVM {
  return {
    icon: "file-pen",
    isFailure: false,
    label: "Escritura",
    at: "2026-06-17T12:00:00Z",
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Suite 1: AC-06-007.1 — work-order-close event shows the toast with WO id
// ---------------------------------------------------------------------------

describe("frd-06: AchievementToast — shows toast on achievement event (AC-06-007.1)", () => {
  it("frd-06: WHEN an achievement event is provided THEN the toast is rendered", () => {
    render(<AchievementToast latestEvent={makeAchievementVM()} />);
    expect(screen.getByTestId("achievement-toast")).toBeDefined();
  });

  it("frd-06: WHEN an achievement event has a workOrder THEN the toast shows the WO id", () => {
    render(<AchievementToast latestEvent={makeAchievementVM("WO-06-008")} />);
    const toast = screen.getByTestId("achievement-toast");
    expect(toast.textContent).toContain("WO-06-008");
  });

  it("frd-06: WHEN an achievement event has no workOrder THEN the toast still renders the label", () => {
    render(<AchievementToast latestEvent={makeAchievementVM()} />);
    const toast = screen.getByTestId("achievement-toast");
    expect(toast.textContent).toContain("¡Logro desbloqueado!");
  });

  it("frd-06: WHEN an achievement event is provided THEN the WO id is in a dedicated testid element", () => {
    render(<AchievementToast latestEvent={makeAchievementVM("WO-06-008")} />);
    const woEl = screen.getByTestId("achievement-toast-wo-id");
    expect(woEl.textContent).toBe("WO-06-008");
  });

  it("frd-06: WHEN an achievement event has no workOrder THEN the WO id element is absent", () => {
    render(<AchievementToast latestEvent={makeAchievementVM()} />);
    expect(screen.queryByTestId("achievement-toast-wo-id")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Suite 2: non-close event does NOT render the toast
// ---------------------------------------------------------------------------

describe("frd-06: AchievementToast — non-achievement event does not show toast", () => {
  it("frd-06: WHEN a non-achievement event is provided THEN the toast is not rendered", () => {
    render(<AchievementToast latestEvent={makeNonAchievementVM()} />);
    expect(screen.queryByTestId("achievement-toast")).toBeNull();
  });

  it("frd-06: WHEN latestEvent is undefined THEN the toast is not rendered", () => {
    render(<AchievementToast latestEvent={undefined} />);
    expect(screen.queryByTestId("achievement-toast")).toBeNull();
  });

  it("frd-06: WHEN latestEvent is null THEN the toast is not rendered", () => {
    render(<AchievementToast latestEvent={null} />);
    expect(screen.queryByTestId("achievement-toast")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: reduced-motion variant (FRD-13)
// ---------------------------------------------------------------------------

describe("frd-06: AchievementToast — reduced-motion variant (FRD-13)", () => {
  it("frd-06: WHEN prefers-reduced-motion is set THEN the toast renders without the animation class", () => {
    // Simulate reduced-motion preference
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(<AchievementToast latestEvent={makeAchievementVM("WO-06-008")} />);
    const toast = screen.getByTestId("achievement-toast");
    // The toast must render even with reduced-motion
    expect(toast).toBeDefined();
    // The animation class must be absent (data-animated="false" or no animate class)
    expect(toast.getAttribute("data-animated")).toBe("false");
  });

  it("frd-06: WHEN prefers-reduced-motion is NOT set THEN the toast has the animation marker", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false, // no reduced-motion
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(<AchievementToast latestEvent={makeAchievementVM("WO-06-008")} />);
    const toast = screen.getByTestId("achievement-toast");
    expect(toast.getAttribute("data-animated")).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// Suite 4: auto-dismiss (fake timers)
// ---------------------------------------------------------------------------

describe("frd-06: AchievementToast — auto-dismiss (AC-06-007.1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("frd-06: WHEN an achievement event is shown THEN the toast is initially visible", () => {
    render(<AchievementToast latestEvent={makeAchievementVM("WO-06-008")} />);
    expect(screen.getByTestId("achievement-toast")).toBeDefined();
  });

  it("frd-06: WHEN the dismiss timeout elapses THEN the toast is removed", async () => {
    render(<AchievementToast latestEvent={makeAchievementVM("WO-06-008")} />);
    // Toast is visible
    expect(screen.getByTestId("achievement-toast")).toBeDefined();
    // Advance time past the dismiss threshold (≥3000ms is a reasonable default)
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    // Toast should be gone
    expect(screen.queryByTestId("achievement-toast")).toBeNull();
  });

  it("frd-06: WHEN a new achievement event arrives after dismiss THEN a new toast appears", async () => {
    const { rerender } = render(<AchievementToast latestEvent={makeAchievementVM("WO-06-001")} />);
    // Dismiss
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId("achievement-toast")).toBeNull();

    // New event — use a different workOrder to signal a genuinely new event
    rerender(<AchievementToast latestEvent={makeAchievementVM("WO-06-002")} />);
    expect(screen.getByTestId("achievement-toast")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 5: aria-live announcement (FRD-13 / AGENTS.md a11y)
// ---------------------------------------------------------------------------

describe("frd-06: AchievementToast — aria-live announcement", () => {
  it("frd-06: WHEN the toast is rendered THEN it has aria-live='polite'", () => {
    render(<AchievementToast latestEvent={makeAchievementVM("WO-06-008")} />);
    const toast = screen.getByTestId("achievement-toast");
    expect(toast.getAttribute("aria-live")).toBe("polite");
  });

  it("frd-06: WHEN the toast is rendered THEN it has role='status'", () => {
    render(<AchievementToast latestEvent={makeAchievementVM("WO-06-008")} />);
    const toast = screen.getByTestId("achievement-toast");
    expect(toast.getAttribute("role")).toBe("status");
  });
});

// ---------------------------------------------------------------------------
// Suite 6: design tokens — zero hardcoded colors (FRD-13)
// ---------------------------------------------------------------------------

describe("frd-06: AchievementToast — zero hardcoded colors (FRD-13)", () => {
  it("frd-06: WHEN rendered THEN no inline style contains a raw hex color", () => {
    render(<AchievementToast latestEvent={makeAchievementVM("WO-06-008")} />);
    const toast = screen.getByTestId("achievement-toast");
    const allEls = [toast, ...Array.from(toast.querySelectorAll("*"))];
    for (const el of allEls) {
      const style = (el as HTMLElement).getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it("frd-06: WHEN rendered THEN no inline style contains a raw rgb() color", () => {
    render(<AchievementToast latestEvent={makeAchievementVM("WO-06-008")} />);
    const toast = screen.getByTestId("achievement-toast");
    const allEls = [toast, ...Array.from(toast.querySelectorAll("*"))];
    for (const el of allEls) {
      const style = (el as HTMLElement).getAttribute("style") ?? "";
      expect(style).not.toMatch(/\brgb\s*\(/);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 7: motion constraints (FRD-13 — transform/opacity only, <300ms)
// ---------------------------------------------------------------------------

describe("frd-06: AchievementToast — motion constraints (FRD-13)", () => {
  it("frd-06: WHEN rendered THEN the animation transition duration is <300ms", () => {
    render(<AchievementToast latestEvent={makeAchievementVM("WO-06-008")} />);
    const toast = screen.getByTestId("achievement-toast");
    const style = (toast as HTMLElement).getAttribute("style") ?? "";
    // If a transition is declared inline, it must be <300ms.
    // Extract ms values from transition shorthand (e.g. "opacity 250ms ease").
    const msMatches = style.match(/(\d+(?:\.\d+)?)ms/g) ?? [];
    for (const match of msMatches) {
      const ms = Number.parseFloat(match);
      expect(ms).toBeLessThan(300);
    }
  });
});
