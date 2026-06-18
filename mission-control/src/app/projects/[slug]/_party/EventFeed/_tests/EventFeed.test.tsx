/**
 * WO-06-007 — EventFeed component tests — RED phase.
 *
 * Tests for the CMP-06-feed client component.
 *
 * Traceability:
 *   AC-06-006.1 — shows a log of workflow events
 *   AC-06-012.1 — events use fixed bounded iconic vocabulary
 *   AC-06-013.1 — failure is a first-class state, never hidden
 *   AC-06-014.1 — auto-scroll + pin button; cap of 100–200 events
 *   AC-06-011.1 — agent color markers; multi-project borders
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EventVM } from "../../event-vm/event-vm";
import { EventFeed } from "../EventFeed";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeVM(overrides: Partial<EventVM> = {}): EventVM {
  return {
    icon: "play-circle",
    isFailure: false,
    label: "Inicio",
    at: "2026-06-15T10:00:00Z",
    ...overrides,
  };
}

function makeVMs(count: number, overrides: Partial<EventVM> = {}): EventVM[] {
  return Array.from({ length: count }, (_, i) =>
    makeVM({ at: `2026-06-15T10:${String(i).padStart(2, "0")}:00Z`, ...overrides }),
  );
}

// ---------------------------------------------------------------------------
// AC-06-006.1 — renders event log
// ---------------------------------------------------------------------------

describe("frd-06: EventFeed — renders event log (AC-06-006.1)", () => {
  it("frd-06: WHEN events is empty THEN shows empty state message", () => {
    render(<EventFeed events={[]} />);
    expect(screen.getByTestId("event-feed-empty")).toBeDefined();
  });

  it("frd-06: WHEN events has items THEN renders an event list", () => {
    render(<EventFeed events={[makeVM()]} />);
    expect(screen.getByTestId("event-feed-list")).toBeDefined();
  });

  it("frd-06: WHEN events has 3 items THEN renders 3 rows", () => {
    render(<EventFeed events={makeVMs(3)} />);
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(3);
  });

  it("frd-06: WHEN an event has a label THEN it appears in the row", () => {
    render(<EventFeed events={[makeVM({ label: "Inicio" })]} />);
    expect(screen.getByText("Inicio")).toBeDefined();
  });

  it("frd-06: WHEN an event has a timestamp THEN it appears in the row (formatted as HH:MM:SS)", () => {
    render(<EventFeed events={[makeVM({ at: "2026-06-15T10:00:00Z" })]} />);
    // Timestamps are formatted to HH:MM:SS for the feed (date is implicit in context).
    const row = screen.getByTestId("event-feed-row");
    expect(row.textContent).toContain("10:00:00");
  });
});

// ---------------------------------------------------------------------------
// AC-06-013.1 — failure is a first-class state, never hidden
// ---------------------------------------------------------------------------

describe("frd-06: EventFeed — failure is first-class, never hidden (AC-06-013.1)", () => {
  it("frd-06: WHEN a failure event is in the list THEN it renders a visible row", () => {
    render(
      <EventFeed
        events={[makeVM({ isFailure: true, label: "Tests fallidos", icon: "circle-x" })]}
      />,
    );
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(1);
  });

  it("frd-06: WHEN a failure event exists THEN the row has data-failure='true' attribute", () => {
    render(<EventFeed events={[makeVM({ isFailure: true })]} />);
    const row = screen.getByTestId("event-feed-row");
    expect(row.getAttribute("data-failure")).toBe("true");
  });

  it("frd-06: WHEN a non-failure event exists THEN data-failure is not 'true'", () => {
    render(<EventFeed events={[makeVM({ isFailure: false })]} />);
    const row = screen.getByTestId("event-feed-row");
    expect(row.getAttribute("data-failure")).not.toBe("true");
  });

  it("frd-06: WHEN both failure and success events exist THEN both render and failure is not filtered", () => {
    render(
      <EventFeed
        events={[
          makeVM({ isFailure: false, at: "2026-06-15T10:00:00Z" }),
          makeVM({ isFailure: true, at: "2026-06-15T10:01:00Z" }),
        ]}
      />,
    );
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(2);
    const failureRows = rows.filter((r) => r.getAttribute("data-failure") === "true");
    expect(failureRows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC-06-011.1 — agent color markers
// ---------------------------------------------------------------------------

describe("frd-06: EventFeed — role color markers (AC-06-011.1)", () => {
  it("frd-06: WHEN event has roleColorKey THEN row has data-role-color attribute", () => {
    render(<EventFeed events={[makeVM({ roleColorKey: "--color-agent-frontend-dev" })]} />);
    const row = screen.getByTestId("event-feed-row");
    expect(row.getAttribute("data-role-color")).toBe("--color-agent-frontend-dev");
  });

  it("frd-06: WHEN event has projectColorKey THEN row has data-project-color attribute", () => {
    render(<EventFeed events={[makeVM({ projectColorKey: "--color-project-proj-a" })]} />);
    const row = screen.getByTestId("event-feed-row");
    expect(row.getAttribute("data-project-color")).toBe("--color-project-proj-a");
  });

  it("frd-06: WHEN event has no roleColorKey THEN data-role-color is absent", () => {
    render(<EventFeed events={[makeVM()]} />);
    const row = screen.getByTestId("event-feed-row");
    expect(row.getAttribute("data-role-color")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-06-014.1 — cap: feed does not grow unbounded
// ---------------------------------------------------------------------------

describe("frd-06: EventFeed — cap (AC-06-014.1)", () => {
  it("frd-06: WHEN events length exceeds the cap THEN only cap rows are rendered", () => {
    const cap = 5;
    render(<EventFeed events={makeVMs(10)} cap={cap} />);
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(cap);
  });

  it("frd-06: WHEN events length is below the cap THEN all events render", () => {
    render(<EventFeed events={makeVMs(3)} cap={10} />);
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(3);
  });

  it("frd-06: WHEN events are capped THEN the most recent events are shown (tail semantics)", () => {
    const events = [
      makeVM({ at: "2026-06-15T10:00:00Z", label: "First" }),
      makeVM({ at: "2026-06-15T10:01:00Z", label: "Second" }),
      makeVM({ at: "2026-06-15T10:02:00Z", label: "Third" }),
    ];
    render(<EventFeed events={events} cap={2} />);
    // With cap=2 the oldest ("First") should be dropped.
    expect(screen.queryByText("First")).toBeNull();
    expect(screen.getByText("Second")).toBeDefined();
    expect(screen.getByText("Third")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-06-014.1 — pin/unpin button appears when scrolled up
// ---------------------------------------------------------------------------

describe("frd-06: EventFeed — pin button (AC-06-014.1)", () => {
  it("frd-06: WHEN component mounts THEN pin button is not visible (auto-scroll active)", () => {
    render(<EventFeed events={makeVMs(5)} />);
    // Pin button should not be visible initially (user hasn't scrolled up).
    // It may be hidden or absent — either way getByTestId should NOT find it.
    // We check it's not visible (hidden or absent).
    const pinBtn = screen.queryByTestId("event-feed-pin");
    // Either absent or has aria-hidden="true" / hidden attribute
    if (pinBtn) {
      const isHidden =
        pinBtn.hasAttribute("hidden") ||
        pinBtn.getAttribute("aria-hidden") === "true" ||
        (pinBtn as HTMLElement).style.display === "none";
      expect(isHidden).toBe(true);
    }
  });

  it("frd-06: WHEN pin button is clicked THEN it is accessible (test-id present when visible)", () => {
    // Simulate: render with showPin=true so the pin button is forced visible.
    // The EventFeed should accept an optional showPin prop for testing.
    render(<EventFeed events={makeVMs(5)} showPin={true} />);
    const pinBtn = screen.getByTestId("event-feed-pin");
    expect(pinBtn).toBeDefined();
    // Click should not throw.
    expect(() => fireEvent.click(pinBtn)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Accessibility (FRD-13, AGENTS.md)
// ---------------------------------------------------------------------------

describe("frd-06: EventFeed — accessibility (FRD-13)", () => {
  it("frd-06: WHEN events present THEN the feed container has aria-live='polite'", () => {
    render(<EventFeed events={makeVMs(3)} />);
    const feed = screen.getByTestId("event-feed-list");
    expect(feed.getAttribute("aria-live")).toBe("polite");
  });

  it("frd-06: WHEN events present THEN the feed has an accessible aria-label in Spanish", () => {
    render(<EventFeed events={makeVMs(3)} />);
    const container = screen.getByTestId("event-feed");
    expect(container.getAttribute("aria-label")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// data-testid present on every interactive element
// ---------------------------------------------------------------------------

describe("frd-06: EventFeed — data-testid on interactive elements", () => {
  it("frd-06: event-feed container has data-testid='event-feed'", () => {
    render(<EventFeed events={[]} />);
    expect(screen.getByTestId("event-feed")).toBeDefined();
  });

  it("frd-06: empty state has data-testid='event-feed-empty'", () => {
    render(<EventFeed events={[]} />);
    expect(screen.getByTestId("event-feed-empty")).toBeDefined();
  });

  it("frd-06: event list has data-testid='event-feed-list' when events present", () => {
    render(<EventFeed events={makeVMs(1)} />);
    expect(screen.getByTestId("event-feed-list")).toBeDefined();
  });
});
