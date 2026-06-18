/**
 * WO-06-005 (La Fragua redesign) — PartyTab snapshot shape tests
 *
 * Covers the FraguaSnapshot-based behavior of WO-06-005:
 *   - active=false when no enriched frd events (AC-06-010.1)
 *   - active=true when enriched events with frd field are present
 *   - FraguaSnapshot shape: events, active, lastEventAt
 *   - Malformed lines tolerated (never throws)
 *
 * Previously these tests checked lib/tasks for the active gate.
 * After the La Fragua redesign, active is derived from the event stream.
 *
 * Stack: Vitest + @testing-library/react + jsdom
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
// FraguaSnapshot — active flag driven by enriched events (not lib/tasks)
// AC-06-010.1: "IF there is no FRD currently in build, show empty state"
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab (fragua) — no frd events → empty state (AC-06-010.1)", () => {
  it("frd-06: WHEN events have no frd field THEN renders empty state (no active FRD)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} />);
    expect(screen.getByTestId("party-tab-empty")).toBeDefined();
  });

  it("frd-06: WHEN events have no frd field THEN does NOT render the event feed", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} />);
    expect(screen.queryByTestId("event-feed")).toBeNull();
  });

  it("frd-06: WHEN events have no frd field THEN renders the no-signal indicator", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} />);
    expect(screen.getByTestId("party-tab-no-signal")).toBeDefined();
  });

  it("frd-06: WHEN no events THEN renders empty state", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} />);
    expect(screen.getByTestId("party-tab-empty")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// FraguaSnapshot — active=true only when enriched events with frd field exist
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab (fragua) — active when enriched events present", () => {
  it("frd-06: WHEN enriched events have frd field THEN active=true (feed visible)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.getByTestId("event-feed")).toBeDefined();
  });

  it("frd-06: WHEN enriched events have frd field THEN fragua-scene renders", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.queryByTestId("fragua-scene")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FraguaSnapshot — container always renders (AC-06-002.1 integration seam)
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab (fragua) — container renders regardless of state", () => {
  it("frd-06: WHEN enriched events present THEN renders party-tab", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.getByTestId("party-tab")).toBeDefined();
  });

  it("frd-06: WHEN no enriched events THEN party-tab container still renders", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} />);
    expect(screen.getByTestId("party-tab")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// FraguaSnapshot — lastEventAt is the newest at field
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab (fragua) — lastEventAt is newest event timestamp", () => {
  it("frd-06: WHEN enriched events present THEN live indicator shown (lastEventAt not null)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.getByTestId("party-tab-live-indicator")).toBeDefined();
  });

  it("frd-06: WHEN no events THEN no-signal indicator shown (lastEventAt null)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} />);
    expect(screen.getByTestId("party-tab-no-signal")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// FraguaSnapshot — malformed lines tolerated (never throws)
// ---------------------------------------------------------------------------

describe("frd-06: PartyTab (fragua) — malformed lines tolerated", () => {
  it("frd-06: WHEN NDJSON contains a malformed line THEN renders without throwing", () => {
    // FIXTURE_EVENTS_ENRICHED_NDJSON contains 1 malformed line (per fixture)
    expect(() => render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />)).not.toThrow();
  });
});
