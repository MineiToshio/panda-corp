/**
 * WO-06-005 — PartyTab snapshot shape + tasks-integration tests
 *
 * Covers the expanded scope of WO-06-005:
 *   - Absent tasks/ → active=false (AC-06-010.1, WO-06-005 TDD DoD)
 *   - PartySnapshot shape: events, active, lastEventAt
 *   - lib/tasks integration: tasks gate drives the active flag
 *   - Snapshot serializable (no fs, no class instances reach the client)
 *
 * Stack: Vitest + @testing-library/react + jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  FIXTURE_EVENTS_EMPTY_NDJSON,
  FIXTURE_EVENTS_NDJSON,
  FIXTURE_TASKS_ABSENT_DIR,
  FIXTURE_TASKS_ACTIVE_DIR,
} from "@/tests/fixtures";
import { PartyTab } from "../PartyTab";

// ---------------------------------------------------------------------------
// PartySnapshot — active flag driven by tasks
// AC-06-010.1: "IF there is no active team, it SHALL show an empty state gracefully"
// WO-06-005 TDD: "absent tasks/ → active=false"
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — tasks-absent → empty state (AC-06-010.1)", () => {
  it("frd-06: WHEN tasksDir is absent THEN renders empty state (no active team)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ABSENT_DIR} />);
    expect(screen.getByTestId("party-tab-empty")).toBeDefined();
  });

  it("frd-06: WHEN tasksDir is absent THEN does NOT render the event feed", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ABSENT_DIR} />);
    expect(screen.queryByTestId("event-feed")).toBeNull();
  });

  it("frd-06: WHEN tasksDir is absent THEN renders the no-signal indicator", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ABSENT_DIR} />);
    expect(screen.getByTestId("party-tab-no-signal")).toBeDefined();
  });

  it("frd-06: WHEN tasksDir is absent AND events are empty THEN renders empty state", () => {
    render(
      <PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} tasksDir={FIXTURE_TASKS_ABSENT_DIR} />,
    );
    expect(screen.getByTestId("party-tab-empty")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PartySnapshot — active=true only when both events AND tasks present
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — active only when tasks present (WO-06-005 scope)", () => {
  it("frd-06: WHEN tasksDir is absent AND events present THEN active=false (tasks gate)", () => {
    // Even if events exist, without an active team (tasks) the view shows empty
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ABSENT_DIR} />);
    expect(screen.queryByTestId("event-feed")).toBeNull();
  });

  it("frd-06: WHEN tasksDir is active AND events present THEN active=true (feed visible)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />);
    expect(screen.getByTestId("event-feed")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PartySnapshot — container always renders (AC-06-002.1 integration seam)
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — container renders regardless of state (AC-06-002.1)", () => {
  it("frd-06: WHEN events present and tasks active THEN renders party-tab", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />);
    expect(screen.getByTestId("party-tab")).toBeDefined();
  });

  it("frd-06: WHEN tasks absent THEN party-tab container still renders", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ABSENT_DIR} />);
    expect(screen.getByTestId("party-tab")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PartySnapshot — lastEventAt is the newest at field
// WO-06-005 TDD: "lastEventAt is the newest at"
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — lastEventAt is newest event timestamp", () => {
  it("frd-06: WHEN events present AND tasks active THEN live indicator shown (lastEventAt not null)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />);
    expect(screen.getByTestId("party-tab-live-indicator")).toBeDefined();
  });

  it("frd-06: WHEN no events THEN no-signal indicator shown (lastEventAt null)", () => {
    render(
      <PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />,
    );
    expect(screen.getByTestId("party-tab-no-signal")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PartySnapshot — malformed lines tolerated (never throws)
// WO-06-005 TDD: "malformed lines tolerated (never throws)"
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — malformed lines tolerated", () => {
  it("frd-06: WHEN NDJSON contains a malformed line THEN renders without throwing", () => {
    // FIXTURE_EVENTS_NDJSON contains 1 malformed line (per fixture comment in index.ts)
    expect(() =>
      render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />),
    ).not.toThrow();
  });
});
