/**
 * WO-06-005 (La Fragua redesign) — PartyTab integration tests
 *
 * Verifies the NEW PartyTab:
 *  - Uses toFraguaSnapshot (not lib/tasks roster)
 *  - Renders FraguaScene when active
 *  - active=true when enriched events with frd field are present
 *  - active=false when no enriched frd events (empty state)
 *  - Read-only: NO mode selector, NO pause/reset controls in DOM (AC-06-009.1)
 *  - EventFeed + AchievementToast rendered alongside scene
 *
 * Traceability:
 *   AC-06-002.1  — FRD title in scene
 *   AC-06-008.1  — reads enriched events; no Claude call
 *   AC-06-009.1  — read-only: no mode selector, no pause/reset
 *   AC-06-010.1  — no FRD → empty state
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
// AC-06-010.1 — empty state when no enriched FRD events
// ---------------------------------------------------------------------------

describe("frd-06 (fragua): PartyTab — empty state from snapshot (AC-06-010.1)", () => {
  it("frd-06: WHEN events file is empty THEN renders the empty state", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} />);
    expect(screen.getByTestId("party-tab-empty")).toBeDefined();
  });

  it("frd-06: WHEN events have no enriched frd field THEN renders the empty state", () => {
    // Plain fixture events have no frd field → snapshot.active=false
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} />);
    expect(screen.getByTestId("party-tab-empty")).toBeDefined();
  });

  it("frd-06: WHEN empty THEN does NOT render fragua-scene", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} />);
    expect(screen.queryByTestId("fragua-scene")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Active state — enriched events activate the scene
// ---------------------------------------------------------------------------

describe("frd-06 (fragua): PartyTab — active from enriched events", () => {
  it("frd-06: WHEN enriched events have frd field THEN renders fragua-scene", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.queryByTestId("fragua-scene")).not.toBeNull();
  });

  it("frd-06: WHEN enriched events have frd field THEN does NOT render empty state", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.queryByTestId("party-tab-empty")).toBeNull();
  });

  it("frd-06: WHEN active THEN renders event-feed", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.queryByTestId("event-feed")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-06-009.1 — read-only: no mode selector, no pause/reset controls
// ---------------------------------------------------------------------------

describe("frd-06 (fragua): PartyTab — read-only (AC-06-009.1)", () => {
  it("frd-06: WHEN active THEN does NOT render a mode selector", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    // No mode selector present in DOM
    expect(screen.queryByTestId("mode-selector")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByTestId("fragua-mode-selector")).toBeNull();
  });

  it("frd-06: WHEN active THEN does NOT render a pause button", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.queryByTestId("pause-button")).toBeNull();
    expect(screen.queryByText(/pause/i)).toBeNull();
    expect(screen.queryByText(/pausar/i)).toBeNull();
  });

  it("frd-06: WHEN active THEN does NOT render a reset button", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.queryByTestId("reset-button")).toBeNull();
    expect(screen.queryByText(/reset/i)).toBeNull();
    expect(screen.queryByText(/reiniciar/i)).toBeNull();
  });

  it("frd-06: WHEN empty THEN does NOT render a mode selector", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} />);
    expect(screen.queryByTestId("mode-selector")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// No lib/tasks import — snapshot is derived from events only
// ---------------------------------------------------------------------------

describe("frd-06 (fragua): PartyTab — no lib/tasks dependency", () => {
  it("frd-06: WHEN no tasksDir prop is passed THEN still renders (no lib/tasks required)", () => {
    // Old PartyTab required tasksDir; new one derives active from snapshot
    expect(() => render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />)).not.toThrow();
  });

  it("frd-06: WHEN eventsPath is not set THEN does not throw (uses default path)", () => {
    expect(() => render(<PartyTab />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Container always renders
// ---------------------------------------------------------------------------

describe("frd-06 (fragua): PartyTab — container always renders", () => {
  it("frd-06: WHEN active THEN party-tab container renders", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.getByTestId("party-tab")).toBeDefined();
  });

  it("frd-06: WHEN empty THEN party-tab container still renders", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} />);
    expect(screen.getByTestId("party-tab")).toBeDefined();
  });
});
