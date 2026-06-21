/**
 * WO-09-003 — CelebrationWatcher — ADVERSARIAL reviewer integration tests (DR-015)
 *
 * Edge cases the implementers did NOT cover, exercising the full wiring chain
 * TOGETHER (CelebrationWatcher → useLiveSnapshot snapshot → classifyCelebration →
 * CelebrationSurface), not the surface in isolation:
 *
 *   - The ethical gate (status:"fail") must win even when a result-shaped field
 *     (workOrder / task=release) is present on the SAME event (FRD-09 §White-Hat;
 *     classifyCelebration returns "none" for status:"fail").
 *   - A test_ok WITHOUT a workOrder stays silent end-to-end through the watcher
 *     (ambiguous standalone run → "none", AC-09-006.2 negative AC).
 *   - After dismiss, a NEW result event re-arms the celebration (the watcher must
 *     not stay permanently silent once dismissed — the CelebrationSurface resets
 *     `dismissed` on event change).
 *   - A snapshot whose latest event is malformed/empty never throws (fail-soft).
 *   - The release overlay carries exactly ONE button (the dismiss) — no preview /
 *     trigger button leaks into the wired experience (DR-061).
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Event } from "@/lib/events/events";

vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: vi.fn(),
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function getModule() {
  const { useLiveSnapshot } = await import("@/hooks/useLiveSnapshot");
  const { CelebrationWatcher } = await import("../CelebrationWatcher");
  return { useLiveSnapshot: vi.mocked(useLiveSnapshot), CelebrationWatcher };
}

function snap(events: Event[]) {
  return { events, lastEventAt: events.at(-1)?.at ?? null, byProject: {} };
}

const RELEASE_OK: Event = {
  event: "achievement",
  at: "2026-06-21T10:00:00Z",
  task: "release",
  status: "ok",
  project: "p",
};

// ─────────────────────────────────────────────────────────────────────────────
// The ethical gate wins: a failed result is NEVER a celebration, even with a
// release/workOrder field present (FRD-09 §White-Hat; the central honesty rule).
// ─────────────────────────────────────────────────────────────────────────────

describe("ethical gate — status:fail is never celebrated through the watcher", () => {
  it("a release event with status:fail produces NO celebration (negative AC)", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    const failedRelease: Event = { ...RELEASE_OK, status: "fail" };
    useLiveSnapshot.mockReturnValue({
      snapshot: snap([failedRelease]),
      connected: true,
      lastEventAt: failedRelease.at,
    });

    render(<CelebrationWatcher />);

    expect(screen.queryByTestId("celebration-surface")).toBeNull();
    expect(screen.queryByTestId("celebration-overlay")).toBeNull();
  });

  it("a work-order event with status:fail produces NO toast (negative AC)", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    const failedWo: Event = {
      event: "achievement",
      at: "2026-06-21T10:05:00Z",
      workOrder: "WO-09-003",
      status: "fail",
      project: "p",
    };
    useLiveSnapshot.mockReturnValue({
      snapshot: snap([failedWo]),
      connected: true,
      lastEventAt: failedWo.at,
    });

    render(<CelebrationWatcher />);
    expect(screen.queryByTestId("celebration-surface")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ambiguous standalone signals stay silent (no XP for activity / ambiguity).
// ─────────────────────────────────────────────────────────────────────────────

describe("ambiguity — standalone test_ok without a work order stays silent", () => {
  it("test_ok with no workOrder produces no celebration", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    const standaloneTest: Event = {
      event: "test_ok",
      at: "2026-06-21T10:06:00Z",
      status: "ok",
      project: "p",
    };
    useLiveSnapshot.mockReturnValue({
      snapshot: snap([standaloneTest]),
      connected: true,
      lastEventAt: standaloneTest.at,
    });

    render(<CelebrationWatcher />);
    expect(screen.queryByTestId("celebration-surface")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Re-arm after dismiss: a NEW result event must show the celebration again.
// The watcher must not be a one-shot that goes permanently silent once dismissed.
// ─────────────────────────────────────────────────────────────────────────────

describe("re-arm — a new result event after dismiss fires the celebration again", () => {
  it("dismiss hides the overlay; a fresh release event re-shows it", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    useLiveSnapshot.mockReturnValue({
      snapshot: snap([RELEASE_OK]),
      connected: true,
      lastEventAt: RELEASE_OK.at,
    });

    const { rerender } = render(<CelebrationWatcher />);
    expect(screen.getByTestId("celebration-overlay")).toBeDefined();

    // Dismiss
    await act(async () => {
      fireEvent.click(screen.getByTestId("celebration-dismiss"));
    });
    expect(screen.queryByTestId("celebration-overlay")).toBeNull();

    // A NEW, distinct release event arrives (different timestamp = new identity)
    const nextRelease: Event = { ...RELEASE_OK, at: "2026-06-21T11:00:00Z" };
    useLiveSnapshot.mockReturnValue({
      snapshot: snap([RELEASE_OK, nextRelease]),
      connected: true,
      lastEventAt: nextRelease.at,
    });
    rerender(<CelebrationWatcher />);

    // The celebration must re-arm — it is not a permanent one-shot.
    expect(screen.getByTestId("celebration-overlay")).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fail-soft — a malformed/empty latest event never throws.
// ─────────────────────────────────────────────────────────────────────────────

describe("fail-soft — malformed latest event never crashes the watcher", () => {
  it("a minimal event missing optional fields renders nothing without throwing", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    // Minimal valid Event: only the required `event` + `at`, no status/task/workOrder.
    const bare: Event = { event: "tick", at: "2026-06-21T10:07:00Z" };
    useLiveSnapshot.mockReturnValue({
      snapshot: snap([bare]),
      connected: true,
      lastEventAt: bare.at,
    });

    expect(() => render(<CelebrationWatcher />)).not.toThrow();
    expect(screen.queryByTestId("celebration-surface")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DR-061 — the wired experience has exactly ONE button (dismiss), no trigger.
// ─────────────────────────────────────────────────────────────────────────────

describe("DR-061 — release overlay has exactly one (dismiss) button, no trigger", () => {
  it("renders a single button and it is the dismiss control", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    useLiveSnapshot.mockReturnValue({
      snapshot: snap([RELEASE_OK]),
      connected: true,
      lastEventAt: RELEASE_OK.at,
    });

    render(<CelebrationWatcher />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.getAttribute("data-testid")).toBe("celebration-dismiss");
  });
});
