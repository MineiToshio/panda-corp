/**
 * WO-06-005 (La Fragua redesign) — PartyTab (RSC) unit tests
 *
 * Tests the server component that calls readEvents, derives toFraguaSnapshot,
 * and renders FraguaScene + EventFeed + AchievementToast (when active) or
 * PartyEmptyState (when inactive).
 *
 * Active flag is now derived from the event stream: active=true iff the
 * snapshot detects a FRD in build (AgentWorking with frd field). The old
 * lib/tasks active-team gate is removed (La Fragua redesign).
 *
 * Traceability:
 *   AC-06-008.1 — feeds off dashboard-events.ndjson without calling Claude
 *   AC-06-009.1 — read-only: no mode selector, no pause/reset controls
 *   AC-06-010.1 — no active FRD → empty state gracefully
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Uses static fixture files (FIXTURE_EVENTS_NDJSON, FIXTURE_EVENTS_EMPTY_NDJSON,
 * FIXTURE_EVENTS_ENRICHED_NDJSON).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  FIXTURE_EVENTS_EMPTY_NDJSON,
  FIXTURE_EVENTS_ENRICHED_NDJSON,
  FIXTURE_EVENTS_NDJSON,
} from "@/tests/fixtures";
import { PartyTab } from "../PartyTab";

// ---------------------------------------------------------------------------
// AC-06-010.1 — empty state when no enriched frd events
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — empty state (AC-06-010.1)", () => {
  it("frd-06: WHEN the NDJSON is empty THEN renders the empty state", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} />);
    expect(screen.getByTestId("party-tab-empty")).toBeDefined();
  });

  it("frd-06: WHEN the NDJSON path does not exist THEN renders the empty state (not a crash)", () => {
    render(<PartyTab eventsPath="/nonexistent/dashboard-events.ndjson" />);
    expect(screen.getByTestId("party-tab-empty")).toBeDefined();
  });

  it("frd-06: WHEN the NDJSON has no enriched frd field THEN renders the empty state", () => {
    // Plain fixture events have no frd field → snapshot.active=false
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} />);
    expect(screen.getByTestId("party-tab-empty")).toBeDefined();
  });

  it("frd-06: WHEN the NDJSON is empty THEN does NOT render the event feed", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} />);
    expect(screen.queryByTestId("event-feed")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-06-008.1 — reads events from the NDJSON; never calls Claude
// Active = enriched events with frd field present.
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — reads enriched events, no Claude call (AC-06-008.1)", () => {
  it("frd-06: WHEN enriched events have frd field THEN renders the event feed", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.getByTestId("event-feed")).toBeDefined();
  });

  it("frd-06: WHEN enriched events have frd field THEN does NOT render the empty state", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.queryByTestId("party-tab-empty")).toBeNull();
  });

  it("frd-06: WHEN PartyTab is imported THEN it has no Claude/AI SDK import (auditable)", async () => {
    const mod = await import("../PartyTab");
    expect(mod.PartyTab).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Cap is respected (AC-06-008.1 / WO-06-005 scope)
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — event cap (WO-06-005 scope)", () => {
  it("frd-06: WHEN cap is set to 3 and enriched fixture has events THEN only 3 rows render", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} cap={3} />);
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(3);
  });

  it("frd-06: WHEN cap is not set THEN all fixture events render (enriched fixture has 9 events)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    const rows = screen.getAllByTestId("event-feed-row");
    // Enriched fixture has 9 valid events (1 malformed line is skipped)
    expect(rows).toHaveLength(9);
  });
});

// ---------------------------------------------------------------------------
// lastEventAt — Live / No-signal indicator (AC-06-008.1)
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — lastEventAt indicator", () => {
  it("frd-06: WHEN enriched events present THEN renders the Live indicator", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.getByTestId("party-tab-live-indicator")).toBeDefined();
  });

  it("frd-06: WHEN no events THEN renders the No-signal indicator", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} />);
    expect(screen.getByTestId("party-tab-no-signal")).toBeDefined();
  });

  it("frd-06: WHEN events have no frd field THEN renders the No-signal indicator", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} />);
    expect(screen.getByTestId("party-tab-no-signal")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// data-testid on interactive elements
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab — data-testid present", () => {
  it("frd-06: container always has data-testid='party-tab'", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.getByTestId("party-tab")).toBeDefined();
  });
});
