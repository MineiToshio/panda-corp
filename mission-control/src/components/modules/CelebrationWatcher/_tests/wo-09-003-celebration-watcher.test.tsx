/**
 * WO-09-003 — CelebrationWatcher — auto-fire wiring tests (RED → GREEN)
 *
 * Verifies that:
 *   AC-09-006.1 — celebration SCALES (toast/phase/release/levelup), never flat
 *   AC-09-006.2 — non-result events produce NO celebration (negative AC)
 *   AC-09-006.4 — NO false-urgency timer/countdown in the celebration
 *   AC-09-006.5 — announcements via aria-live="polite" without stealing focus
 *
 * The CelebrationWatcher is the client component that:
 *   1. Subscribes to `useLiveSnapshot` (the shared SSE transport, WO-01-009)
 *   2. Extracts the latest result event from the snapshot
 *   3. Passes it to `CelebrationSurface` (auto-fire — never a button trigger)
 *   4. Dismisses on user action (DR-061: auto-fired but always dismissible)
 *
 * Architecture note: CelebrationWatcher is a "use client" module; tests run
 * in jsdom. `useLiveSnapshot` is mocked at the module boundary.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────

// Mock the SSE hook so tests control what events arrive (no real EventSource)
vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: vi.fn(),
}));

// Mock matchMedia (jsdom doesn't implement it; CelebrationSurface needs it)
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getModule() {
  const { useLiveSnapshot } = await import("@/hooks/useLiveSnapshot");
  const { CelebrationWatcher } = await import("../CelebrationWatcher");
  return { useLiveSnapshot: vi.mocked(useLiveSnapshot), CelebrationWatcher };
}

function makeSnapshot(events: import("@/lib/events/events").Event[]) {
  return {
    events,
    lastEventAt: events.at(-1)?.at ?? null,
    byProject: {},
  };
}

// classifyCelebration("achievement", task="release") → "release"
const RELEASE_EVENT: import("@/lib/events/events").Event = {
  event: "achievement",
  at: "2026-06-21T10:00:00Z",
  task: "release",
  status: "ok",
  project: "my-proj",
};

// classifyCelebration("achievement", workOrder=...) → "toast"
const WO_EVENT: import("@/lib/events/events").Event = {
  event: "achievement",
  at: "2026-06-21T10:01:00Z",
  workOrder: "WO-09-003",
  status: "ok",
  project: "my-proj",
};

// classifyCelebration("read") → "none"
const NAV_EVENT: import("@/lib/events/events").Event = {
  event: "read",
  at: "2026-06-21T10:02:00Z",
  project: "my-proj",
};

// ─────────────────────────────────────────────────────────────────────────────
// AC-09-006.2 — Non-result events produce NO celebration (negative AC)
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-09-006.2 — non-result events produce no celebration", () => {
  it("renders nothing when the snapshot is null (no events yet)", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    useLiveSnapshot.mockReturnValue({ snapshot: null, connected: false, lastEventAt: null });

    render(<CelebrationWatcher />);

    // No celebration surface should be present
    expect(screen.queryByTestId("celebration-surface")).toBeNull();
    expect(screen.queryByTestId("celebration-overlay")).toBeNull();
  });

  it("renders nothing when the snapshot has only non-result events (read/navigation)", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    useLiveSnapshot.mockReturnValue({
      snapshot: makeSnapshot([NAV_EVENT]),
      connected: true,
      lastEventAt: NAV_EVENT.at,
    });

    render(<CelebrationWatcher />);

    expect(screen.queryByTestId("celebration-surface")).toBeNull();
    expect(screen.queryByTestId("celebration-overlay")).toBeNull();
  });

  it("renders nothing when there are no events in the snapshot", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    useLiveSnapshot.mockReturnValue({
      snapshot: makeSnapshot([]),
      connected: true,
      lastEventAt: null,
    });

    render(<CelebrationWatcher />);

    expect(screen.queryByTestId("celebration-surface")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-09-006.1 — Celebration SCALES (toast/phase/release/levelup), never flat
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-09-006.1 — celebration scales with event tier", () => {
  it("shows a celebration-surface for a work_order result event (toast tier)", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    useLiveSnapshot.mockReturnValue({
      snapshot: makeSnapshot([WO_EVENT]),
      connected: true,
      lastEventAt: WO_EVENT.at,
    });

    render(<CelebrationWatcher />);

    // toast tier → celebration-surface must be present with correct tier
    const surface = screen.getByTestId("celebration-surface");
    expect(surface).toBeDefined();
    expect(surface.getAttribute("data-tier")).toBe("toast");
  });

  it("shows a full-screen overlay for a release event", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    useLiveSnapshot.mockReturnValue({
      snapshot: makeSnapshot([RELEASE_EVENT]),
      connected: true,
      lastEventAt: RELEASE_EVENT.at,
    });

    render(<CelebrationWatcher />);

    // release tier → full-screen overlay
    const overlay = screen.getByTestId("celebration-overlay");
    expect(overlay).toBeDefined();
    // Surface wraps the overlay
    const surface = screen.getByTestId("celebration-surface");
    expect(surface.getAttribute("data-tier")).toBe("release");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-09-006.4 — NO false-urgency timer / countdown / nagging (negative AC)
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-09-006.4 — no false-urgency in the wired celebration", () => {
  it("release overlay has no countdown, timer text or nagging language", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    useLiveSnapshot.mockReturnValue({
      snapshot: makeSnapshot([RELEASE_EVENT]),
      connected: true,
      lastEventAt: RELEASE_EVENT.at,
    });

    render(<CelebrationWatcher />);

    const overlay = screen.getByTestId("celebration-overlay");
    const text = overlay.textContent ?? "";

    // Forbidden patterns: countdown, timer, urgency language
    expect(text).not.toMatch(/\d+\s*s(eg)?(undo)?s?\s*(restante|left|remaining)/i);
    expect(text).not.toMatch(/cuenta\s*regresiva/i);
    expect(text).not.toMatch(/se\s*cierra\s*en/i);
    expect(text).not.toMatch(/\bTimer\b/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-09-006.5 — announcements via aria-live="polite" without stealing focus
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-09-006.5 — aria-live polite, no focus theft", () => {
  it("release overlay contains an aria-live region that announces without stealing focus", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    useLiveSnapshot.mockReturnValue({
      snapshot: makeSnapshot([RELEASE_EVENT]),
      connected: true,
      lastEventAt: RELEASE_EVENT.at,
    });

    render(<CelebrationWatcher />);

    // LiveRegion wraps an aria-live="polite" region
    const liveRegions = document.querySelectorAll('[aria-live="polite"]');
    expect(liveRegions.length).toBeGreaterThan(0);

    // None of the live regions should have autofocus or focus trapping on auto-fire
    for (const region of liveRegions) {
      expect(region.getAttribute("autofocus")).toBeNull();
      expect(region.getAttribute("tabindex")).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dismiss behavior (DR-061: auto-fired but always dismissible)
// ─────────────────────────────────────────────────────────────────────────────

describe("Dismiss — auto-fired but always dismissible (DR-061)", () => {
  it("release overlay can be dismissed via the dismiss button", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    useLiveSnapshot.mockReturnValue({
      snapshot: makeSnapshot([RELEASE_EVENT]),
      connected: true,
      lastEventAt: RELEASE_EVENT.at,
    });

    render(<CelebrationWatcher />);

    // Overlay must be present before dismiss
    expect(screen.getByTestId("celebration-overlay")).toBeDefined();

    // Click the dismiss button
    const dismissBtn = screen.getByTestId("celebration-dismiss");
    await act(async () => {
      fireEvent.click(dismissBtn);
    });

    // Overlay must be gone after dismiss
    expect(screen.queryByTestId("celebration-overlay")).toBeNull();
  });

  it("NO trigger button exists in the watcher — celebration fires automatically (AC-09-006.1)", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();
    // No events yet — watcher must not show any preview/trigger button
    useLiveSnapshot.mockReturnValue({ snapshot: null, connected: false, lastEventAt: null });

    render(<CelebrationWatcher />);

    // There should be no button at all when no celebration is active
    // (the ONLY allowed button is the dismiss button inside the active overlay)
    const buttons = screen.queryAllByRole("button");
    expect(buttons.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Event tracking — watcher uses the LATEST result event
// ─────────────────────────────────────────────────────────────────────────────

describe("Event tracking — latest result event drives the celebration", () => {
  it("uses only the most recent event in the snapshot (last of events array)", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();

    // Snapshot has a nav event (no-op) followed by a WO event (result)
    useLiveSnapshot.mockReturnValue({
      snapshot: makeSnapshot([NAV_EVENT, WO_EVENT]),
      connected: true,
      lastEventAt: WO_EVENT.at,
    });

    render(<CelebrationWatcher />);

    // WO_EVENT is the last → toast celebration should fire
    const surface = screen.getByTestId("celebration-surface");
    expect(surface.getAttribute("data-tier")).toBe("toast");
  });

  it("suppresses celebration when the latest event is a non-result (even if earlier ones were results)", async () => {
    const { useLiveSnapshot, CelebrationWatcher } = await getModule();

    // The most-recent event is a nav (read) — no celebration should fire
    useLiveSnapshot.mockReturnValue({
      snapshot: makeSnapshot([WO_EVENT, NAV_EVENT]),
      connected: true,
      lastEventAt: NAV_EVENT.at,
    });

    render(<CelebrationWatcher />);

    expect(screen.queryByTestId("celebration-surface")).toBeNull();
  });
});
