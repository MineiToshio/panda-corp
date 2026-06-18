/**
 * WO-06-011 — EventFeed multi-project border tests — RED phase.
 *
 * AC-06-011.1: Each agent SHALL have a fixed color reused across the UI;
 *              multi-project → project-color (left border) + agent-color (second border).
 *
 * Tests:
 *   - WHEN snapshot contains events from 2 projects THEN rows with projectColorKey
 *     carry BOTH data-project-color AND data-agent-color attributes
 *   - WHEN a row has projectColorKey AND agentColorKey THEN it renders a double border
 *     (project-color left border + agent-color outline — verifiable via data attributes
 *     since jsdom does not compute CSS)
 *   - WHEN a row has only agentColorKey (no project) THEN only the agent border applies
 *   - WHEN a row has neither THEN no color border
 *   - Empty/reduced-motion never throw (defensive)
 *
 * Traceability:
 *   AC-06-011.1 → REQ-06-011 (multi-project borders)
 *   WO-06-011: Empty state + reduced-motion + multi-project borders
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventFeed } from "./EventFeed";
import type { EventVM } from "./event-vm";

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

// Snapshot from 2 different projects
function makeTwoProjectVMs(): EventVM[] {
  return [
    makeVM({
      at: "2026-06-15T10:00:00Z",
      label: "Inicio proj-a",
      project: "proj-a",
      projectColorKey: "--color-project-proj-a",
      agentColorKey: "--color-agent-backend-dev",
    }),
    makeVM({
      at: "2026-06-15T10:01:00Z",
      label: "Inicio proj-b",
      project: "proj-b",
      projectColorKey: "--color-project-proj-b",
      agentColorKey: "--color-agent-frontend-dev",
    }),
    makeVM({
      at: "2026-06-15T10:02:00Z",
      label: "Sin proyecto",
      agentColorKey: "--color-agent-test-writer",
      // no project / no projectColorKey
    }),
  ];
}

// ---------------------------------------------------------------------------
// AC-06-011.1 — multi-project: both data attributes present on rows with project
// ---------------------------------------------------------------------------

describe("frd-06: EventFeed — multi-project double border (AC-06-011.1)", () => {
  it("frd-06: WHEN a row has projectColorKey THEN data-project-color is set", () => {
    render(
      <EventFeed
        events={[
          makeVM({
            projectColorKey: "--color-project-proj-a",
            agentColorKey: "--color-agent-backend-dev",
          }),
        ]}
      />,
    );
    const row = screen.getByTestId("event-feed-row");
    expect(row.getAttribute("data-project-color")).toBe("--color-project-proj-a");
  });

  it("frd-06: WHEN a row has both projectColorKey AND agentColorKey THEN BOTH data attributes are present", () => {
    render(
      <EventFeed
        events={[
          makeVM({
            projectColorKey: "--color-project-proj-a",
            agentColorKey: "--color-agent-backend-dev",
          }),
        ]}
      />,
    );
    const row = screen.getByTestId("event-feed-row");
    expect(row.getAttribute("data-project-color")).toBe("--color-project-proj-a");
    expect(row.getAttribute("data-agent-color")).toBe("--color-agent-backend-dev");
  });

  it("frd-06: WHEN 2-project snapshot THEN rows from proj-a and proj-b each have their own project-color", () => {
    render(<EventFeed events={makeTwoProjectVMs()} />);
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(3);

    const projARow = rows[0];
    expect(projARow?.getAttribute("data-project-color")).toBe("--color-project-proj-a");
    expect(projARow?.getAttribute("data-agent-color")).toBe("--color-agent-backend-dev");

    const projBRow = rows[1];
    expect(projBRow?.getAttribute("data-project-color")).toBe("--color-project-proj-b");
    expect(projBRow?.getAttribute("data-agent-color")).toBe("--color-agent-frontend-dev");
  });

  it("frd-06: WHEN a row has no project THEN data-project-color is absent", () => {
    render(
      <EventFeed
        events={[
          makeVM({
            agentColorKey: "--color-agent-test-writer",
            // no projectColorKey
          }),
        ]}
      />,
    );
    const row = screen.getByTestId("event-feed-row");
    expect(row.getAttribute("data-project-color")).toBeNull();
    expect(row.getAttribute("data-agent-color")).toBe("--color-agent-test-writer");
  });

  it("frd-06: WHEN row from no-project event THEN only agent border applies (no double border)", () => {
    render(<EventFeed events={makeTwoProjectVMs()} />);
    const rows = screen.getAllByTestId("event-feed-row");
    const noProjectRow = rows[2]; // third row: no project
    expect(noProjectRow?.getAttribute("data-project-color")).toBeNull();
    expect(noProjectRow?.getAttribute("data-agent-color")).toBe("--color-agent-test-writer");
  });

  it("frd-06: WHEN a row has neither agentColorKey nor projectColorKey THEN neither data attribute is set", () => {
    render(
      <EventFeed
        events={[
          makeVM({
            // no agentColorKey, no projectColorKey
          }),
        ]}
      />,
    );
    const row = screen.getByTestId("event-feed-row");
    expect(row.getAttribute("data-project-color")).toBeNull();
    expect(row.getAttribute("data-agent-color")).toBeNull();
  });

  it("frd-06: WHEN 2-project snapshot THEN all rows still render (never crash)", () => {
    expect(() => render(<EventFeed events={makeTwoProjectVMs()} />)).not.toThrow();
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Legacy/global events (no project field) — rendered with agent color only
// (FRD-06 blueprint §3: Events without `project` are legacy/global)
// ---------------------------------------------------------------------------

describe("frd-06: EventFeed — legacy/global events (no project field)", () => {
  it("frd-06: WHEN event has no project field THEN it renders with agent color only (no project border)", () => {
    render(
      <EventFeed
        events={[
          makeVM({
            agentColorKey: "--color-agent-reviewer",
            // no project, no projectColorKey — legacy/global event
          }),
        ]}
      />,
    );
    const row = screen.getByTestId("event-feed-row");
    expect(row.getAttribute("data-agent-color")).toBe("--color-agent-reviewer");
    expect(row.getAttribute("data-project-color")).toBeNull();
  });

  it("frd-06: WHEN mixing project events with legacy events THEN legacy events do not inherit a projectColorKey", () => {
    const events: EventVM[] = [
      makeVM({
        at: "2026-06-15T10:00:00Z",
        projectColorKey: "--color-project-proj-a",
        agentColorKey: "--color-agent-backend-dev",
        project: "proj-a",
      }),
      makeVM({
        at: "2026-06-15T10:01:00Z",
        agentColorKey: "--color-agent-reviewer",
        // no project — legacy
      }),
    ];
    render(<EventFeed events={events} />);
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(2);
    // First row: project border
    expect(rows[0]?.getAttribute("data-project-color")).toBe("--color-project-proj-a");
    // Second row: no project border
    expect(rows[1]?.getAttribute("data-project-color")).toBeNull();
    expect(rows[1]?.getAttribute("data-agent-color")).toBe("--color-agent-reviewer");
  });
});
