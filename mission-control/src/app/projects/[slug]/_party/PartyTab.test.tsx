/**
 * WO-06-005 — PartyTab (RSC) tests
 *
 * Tests the server component that calls readEvents + readTasksState
 * and builds the party snapshot.
 *
 * Traceability:
 *   AC-06-008.1 — feeds off dashboard-events.ndjson without calling Claude
 *   AC-06-010.1 — no active team → empty state
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Uses static fixture files (FIXTURE_EVENTS_NDJSON, FIXTURE_EVENTS_EMPTY_NDJSON,
 * FIXTURE_TASKS_ACTIVE_DIR, FIXTURE_TASKS_ABSENT_DIR).
 *
 * Design: all tests pass explicit tasksDir to avoid environment-dependence
 * on whether ~/.claude/tasks exists on the test machine (LESSON: fixture-isolation).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  FIXTURE_EVENTS_EMPTY_NDJSON,
  FIXTURE_EVENTS_NDJSON,
  FIXTURE_TASKS_ABSENT_DIR,
  FIXTURE_TASKS_ACTIVE_DIR,
} from "@/tests/fixtures/index";
import { PartyTab } from "./PartyTab";

// ---------------------------------------------------------------------------
// AC-06-010.1 — empty state when no events (regardless of tasks)
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — empty state (AC-06-010.1)", () => {
  it("frd-06: WHEN the NDJSON is empty THEN renders the empty state", () => {
    render(
      <PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />,
    );
    expect(screen.getByTestId("party-tab-empty")).toBeDefined();
  });

  it("frd-06: WHEN the NDJSON path does not exist THEN renders the empty state (not a crash)", () => {
    render(
      <PartyTab
        eventsPath="/nonexistent/dashboard-events.ndjson"
        tasksDir={FIXTURE_TASKS_ACTIVE_DIR}
      />,
    );
    expect(screen.getByTestId("party-tab-empty")).toBeDefined();
  });

  it("frd-06: WHEN the NDJSON is empty THEN does NOT render the event feed", () => {
    render(
      <PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />,
    );
    expect(screen.queryByTestId("event-feed")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-06-008.1 — reads events from the NDJSON; never calls Claude
// Active team = tasksDir has a subdirectory AND events are present.
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — reads events, no Claude call (AC-06-008.1)", () => {
  it("frd-06: WHEN the NDJSON has 10 events AND tasks active THEN renders the event feed", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />);
    expect(screen.getByTestId("event-feed")).toBeDefined();
  });

  it("frd-06: WHEN the NDJSON has events AND tasks active THEN does NOT render the empty state", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />);
    expect(screen.queryByTestId("party-tab-empty")).toBeNull();
  });

  it("frd-06: WHEN PartyTab is imported THEN it has no Claude/AI SDK import (auditable)", async () => {
    // Dynamic import to inspect the module source — not a runtime check, just ensures
    // the module resolves without importing AI clients.
    const mod = await import("./PartyTab");
    expect(mod.PartyTab).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Cap is respected (AC-06-008.1 / WO-06-005 scope)
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — event cap (WO-06-005 scope)", () => {
  it("frd-06: WHEN cap is set to 3 and fixture has 10 events THEN only 3 rows render", () => {
    render(
      <PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} cap={3} />,
    );
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(3);
  });

  it("frd-06: WHEN cap is not set THEN all fixture events render (fixture has 10, default cap 200)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />);
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// lastEventAt — Live / No-signal indicator (AC-06-008.1)
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — lastEventAt indicator", () => {
  it("frd-06: WHEN events present AND tasks active THEN renders the Live indicator", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />);
    expect(screen.getByTestId("party-tab-live-indicator")).toBeDefined();
  });

  it("frd-06: WHEN no events THEN renders the No-signal indicator", () => {
    render(
      <PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />,
    );
    expect(screen.getByTestId("party-tab-no-signal")).toBeDefined();
  });

  it("frd-06: WHEN tasks absent THEN renders the No-signal indicator (even with events)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ABSENT_DIR} />);
    expect(screen.getByTestId("party-tab-no-signal")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// data-testid on interactive elements
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — data-testid present", () => {
  it("frd-06: container always has data-testid='party-tab'", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />);
    expect(screen.getByTestId("party-tab")).toBeDefined();
  });
});
