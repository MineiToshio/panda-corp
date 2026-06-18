/**
 * WO-18-001 — `Digest` client component — RED phase
 *
 * Traceability (EARS → AC → test):
 *   AC-18-001.2  (REQ-18-006) The marker is persisted in localStorage and survives
 *                a refresh and a tab close; a refresh/visit does NOT advance it.
 *   AC-18-001.3  (REQ-18-007) The marker advances ONLY on "marcar visto"; events
 *                newer than the marker are flagged "new" and counted.
 *   AC-18-001.4  (REQ-18-008) WHEN no new events, shows al-día state + last-24h fallback.
 *   AC-18-001.5  (REQ-18-009, SHOULD) New count can increment as new events arrive.
 *   AC-18-001.6  Marker is client-local only; never written to factory/project.
 *
 * Stack: @testing-library/react + jsdom (vitest).
 * localStorage is available globally in jsdom.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Event } from "@/lib/events/events";
import { Digest } from "../Digest";

// ---------------------------------------------------------------------------
// Helpers & fixtures
// ---------------------------------------------------------------------------

const NOW_MS = new Date("2026-06-18T12:00:00Z").getTime();
const HOUR_MS = 60 * 60 * 1000;

function makeEvent(at: string, overrides: Partial<Event> = {}): Event {
  return { event: "AgentWorking", at, ...overrides };
}

const ev30minAgo = makeEvent(new Date(NOW_MS - 0.5 * HOUR_MS).toISOString(), {
  event: "WoCompleted",
  project: "alpha",
});
const ev2hAgo = makeEvent(new Date(NOW_MS - 2 * HOUR_MS).toISOString(), {
  event: "WoCompleted",
  project: "beta",
});
const ev10hAgo = makeEvent(new Date(NOW_MS - 10 * HOUR_MS).toISOString(), {
  event: "AgentWorking",
  project: "gamma",
});

const EVENTS_WITH_NEW: Event[] = [ev10hAgo, ev2hAgo, ev30minAgo];
const EMPTY_EVENTS: Event[] = [];

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(NOW_MS);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// AC-18-001.2 — marker persists in localStorage; visit does NOT advance it
// ---------------------------------------------------------------------------

describe("frd-18: Digest — AC-18-001.2 (localStorage persistence)", () => {
  it("frd-18: AC-18-001.2 — component renders without crashing", () => {
    expect(() => render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />)).not.toThrow();
  });

  it("frd-18: AC-18-001.2 — mounting does NOT advance the marker (visit does not advance)", () => {
    // Seed an old marker (5h ago)
    const oldMarkerMs = NOW_MS - 5 * HOUR_MS;
    localStorage.setItem("mc:digest:visto_hasta", String(oldMarkerMs));

    render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    // After mount, marker must still be the old value (not NOW_MS)
    const stored = localStorage.getItem("mc:digest:visto_hasta");
    expect(stored).toBe(String(oldMarkerMs));
  });

  it("frd-18: AC-18-001.2 — marker survives across render cycles (simulates refresh)", () => {
    // First render: no prior marker → new events shown
    const { unmount } = render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    // Click "marcar visto" to advance the marker
    const markBtn = screen.getByRole("button", { name: /marcar visto/i });
    fireEvent.click(markBtn);

    // Marker should be persisted in localStorage
    const stored = localStorage.getItem("mc:digest:visto_hasta");
    expect(stored).toBeTruthy();
    const storedMs = Number(stored);
    expect(storedMs).toBeGreaterThan(0);

    unmount();

    // Second render (simulates refresh): marker is read from localStorage
    render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    // After "refresh", marker is still present — not wiped
    const storedAfterRefresh = localStorage.getItem("mc:digest:visto_hasta");
    expect(storedAfterRefresh).toBe(stored);
  });
});

// ---------------------------------------------------------------------------
// AC-18-001.3 — new events highlighted; "marcar visto" advances marker
// ---------------------------------------------------------------------------

describe("frd-18: Digest — AC-18-001.3 (new events + marcar visto)", () => {
  it("frd-18: AC-18-001.3 — shows new-event count when events are newer than marker", () => {
    // Seed marker 5h ago → ev30minAgo and ev2hAgo are "new"
    const markerMs = NOW_MS - 5 * HOUR_MS;
    localStorage.setItem("mc:digest:visto_hasta", String(markerMs));

    render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    // Should show a count badge / text indicating new events
    // Look for either "2 nuevo" or the badge element with role="status"
    const newCount = screen.getByRole("status");
    expect(newCount).toBeDefined();
    expect(newCount.textContent).toMatch(/2/);
  });

  it("frd-18: AC-18-001.3 — 'marcar visto' button is present when there are new events", () => {
    const markerMs = NOW_MS - 5 * HOUR_MS;
    localStorage.setItem("mc:digest:visto_hasta", String(markerMs));

    render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    const btn = screen.getByRole("button", { name: /marcar visto/i });
    expect(btn).toBeDefined();
  });

  it("frd-18: AC-18-001.3 — clicking 'marcar visto' advances the marker to approximately NOW", () => {
    const markerMs = NOW_MS - 5 * HOUR_MS;
    localStorage.setItem("mc:digest:visto_hasta", String(markerMs));

    render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    const btn = screen.getByRole("button", { name: /marcar visto/i });
    fireEvent.click(btn);

    const stored = localStorage.getItem("mc:digest:visto_hasta");
    expect(stored).toBeTruthy();
    const storedMs = Number(stored);
    // Marker should have been advanced (at least to the latest event's timestamp)
    expect(storedMs).toBeGreaterThan(markerMs);
  });

  it("frd-18: AC-18-001.3 — after 'marcar visto', new-event count drops to 0", () => {
    const markerMs = NOW_MS - 5 * HOUR_MS;
    localStorage.setItem("mc:digest:visto_hasta", String(markerMs));

    render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    // Initially has new events
    expect(screen.getByRole("status").textContent).toMatch(/2/);

    const btn = screen.getByRole("button", { name: /marcar visto/i });
    fireEvent.click(btn);

    // After marking, no new events — al-día state
    expect(screen.queryByRole("button", { name: /marcar visto/i })).toBeNull();
  });

  it("frd-18: AC-18-001.3 — new events are highlighted (data-new attribute or aria)", () => {
    const markerMs = NOW_MS - 5 * HOUR_MS;
    localStorage.setItem("mc:digest:visto_hasta", String(markerMs));

    const { container } = render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    // New items should carry data-new="true"
    const newItems = container.querySelectorAll('[data-new="true"]');
    expect(newItems.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-18-001.4 — al-día state when no new events; last-24h fallback
// ---------------------------------------------------------------------------

describe("frd-18: Digest — AC-18-001.4 (al-día state)", () => {
  it("frd-18: AC-18-001.4 — shows al-día text when marker is NOW and there are no new events", () => {
    localStorage.setItem("mc:digest:visto_hasta", String(NOW_MS));

    render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    // Should show "al día" state
    expect(screen.getByText(/al día/i)).toBeDefined();
  });

  it("frd-18: AC-18-001.4 — shows last-24h events (dimmed) in al-día state (never empty)", () => {
    localStorage.setItem("mc:digest:visto_hasta", String(NOW_MS));

    const { container } = render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    // last-24h items should be present and marked dimmed
    const dimmedItems = container.querySelectorAll('[data-dimmed="true"]');
    expect(dimmedItems.length).toBeGreaterThan(0);
  });

  it("frd-18: AC-18-001.4 — empty event stream shows al-día (never blank)", () => {
    localStorage.setItem("mc:digest:visto_hasta", String(NOW_MS));

    render(<Digest events={EMPTY_EVENTS} nowMs={NOW_MS} />);

    expect(screen.getByText(/al día/i)).toBeDefined();
  });

  it("frd-18: AC-18-001.4 — no 'marcar visto' button in al-día state", () => {
    localStorage.setItem("mc:digest:visto_hasta", String(NOW_MS));

    render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    expect(screen.queryByRole("button", { name: /marcar visto/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-18-001.6 — marker is client-local only (no factory/project write)
// ---------------------------------------------------------------------------

describe("frd-18: Digest — AC-18-001.6 (client-local only)", () => {
  it("frd-18: AC-18-001.6 — marker key is scoped to mc:digest namespace", () => {
    render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    // Click to advance marker
    const btn = screen.queryByRole("button", { name: /marcar visto/i });
    if (btn) fireEvent.click(btn);

    // Check all localStorage keys — none should reference factory or project paths
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) keys.push(key);
    }

    for (const key of keys) {
      expect(key).toMatch(/^mc:/); // must be namespaced under mc:
      expect(key).not.toContain("factory");
      expect(key).not.toContain("status.yaml");
      expect(key).not.toContain(".pandacorp");
    }
  });

  it("frd-18: AC-18-001.6 — mounting without prior marker does not crash (fresh factory)", () => {
    expect(() => render(<Digest events={EMPTY_EVENTS} nowMs={NOW_MS} />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Accessibility — Spanish + a11y (AC-18-001.6 language clause)
// ---------------------------------------------------------------------------

describe("frd-18: Digest — a11y + Spanish (AC-18-001.6)", () => {
  it("frd-18: section has a role=region or article with an accessible name in Spanish", () => {
    const { container } = render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);
    const section =
      container.querySelector("section") ??
      container.querySelector("[role='region']") ??
      container.querySelector("article");
    expect(section).not.toBeNull();
  });

  it("frd-18: 'marcar visto' button is keyboard-accessible (has accessible name)", () => {
    const markerMs = NOW_MS - 5 * HOUR_MS;
    localStorage.setItem("mc:digest:visto_hasta", String(markerMs));

    render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    const btn = screen.getByRole("button", { name: /marcar visto/i });
    expect(btn.tagName.toLowerCase()).toBe("button");
    // Must not be disabled
    expect(btn).not.toBeDisabled();
  });

  it("frd-18: each event item has an accessible description (aria-label or text)", () => {
    const markerMs = NOW_MS - 5 * HOUR_MS;
    localStorage.setItem("mc:digest:visto_hasta", String(markerMs));

    const { container } = render(<Digest events={EVENTS_WITH_NEW} nowMs={NOW_MS} />);

    const items = container.querySelectorAll("[data-testid='digest-item']");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      // Each item should have some text content
      expect(item.textContent?.trim()).not.toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// AC-18-001.5 — live update capability (SHOULD, not MUST)
// ---------------------------------------------------------------------------

describe("frd-18: Digest — AC-18-001.5 (live count, SHOULD)", () => {
  it("frd-18: AC-18-001.5 — component accepts updated events prop and re-renders new count", () => {
    // Marker is 5h ago
    const markerMs = NOW_MS - 5 * HOUR_MS;
    localStorage.setItem("mc:digest:visto_hasta", String(markerMs));

    const { rerender } = render(<Digest events={[ev10hAgo, ev2hAgo]} nowMs={NOW_MS} />);
    // Initially 1 new event (only ev2hAgo is newer than 5h marker)
    expect(screen.getByRole("status").textContent).toMatch(/1/);

    // Simulate a new event arriving
    const evFresh = makeEvent(new Date(NOW_MS - 10 * 60 * 1000).toISOString(), {
      event: "WoCompleted",
      project: "zeta",
    });
    rerender(<Digest events={[ev10hAgo, ev2hAgo, evFresh]} nowMs={NOW_MS} />);

    // Count should now be 2
    expect(screen.getByRole("status").textContent).toMatch(/2/);
  });
});
