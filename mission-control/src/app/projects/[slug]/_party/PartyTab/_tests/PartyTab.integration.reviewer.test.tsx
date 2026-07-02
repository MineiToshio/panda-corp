/**
 * WO-06-005 (La Fragua redesign) — PartyTab reviewer integration test
 *
 * Adversarial / integration: exercises what the project page actually mounts
 * for the Party tab (`<PartyTab />`, CMP-06-party-tab) and asserts:
 *
 * 1. The La Fragua scene reaches the DOM when enriched events are present.
 * 2. The mode is displayed as read-only data — NO mode selector in the DOM.
 * 3. NO pause/reset controls appear (production is read-only, AC-06-009.1).
 * 4. The empty state renders gracefully when no FRD is in build (AC-06-010.1).
 *
 * This replaces the previous reviewer test (which checked for the old 4-zone
 * layout: party-scene, party-zone-library/forge/workshop/lab, party-sprite-*).
 * The La Fragua redesign uses fragua-scene with Forja/Tribunal/Bóveda rooms.
 *
 * Anchored in EARS:
 *   AC-06-002.1 — FRD currently in build displayed in the scene header
 *   AC-06-009.1 — read-only: no mode selector, no pause/reset affordances
 *   AC-06-010.1 — no FRD → empty state, never blank or crash
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FIXTURE_EVENTS_EMPTY_NDJSON, FIXTURE_EVENTS_ENRICHED_NDJSON } from "@/tests/fixtures";
import { PartyTab } from "../PartyTab";

describe("frd-06 REVIEWER (fragua): Party tab mounts the La Fragua scene", () => {
  it("frd-06: WHEN enriched events are present THEN fragua-scene reaches the DOM (AC-06-002.1)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);

    // The La Fragua scene container must mount.
    expect(screen.queryByTestId("fragua-scene")).not.toBeNull();
    // The three rooms must be present (WO-06-006 naming: forge/tribunal/vault).
    expect(screen.queryByTestId("fragua-room-forge")).not.toBeNull();
    expect(screen.queryByTestId("fragua-room-tribunal")).not.toBeNull();
    expect(screen.queryByTestId("fragua-room-vault")).not.toBeNull();
  });

  it("frd-06: WHEN active THEN the single MissionBar header is visible (no in-scene tracker — owner, 2026-07-02)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.getByTestId("mission-bar-root")).toBeInTheDocument();
    expect(screen.queryByTestId("fragua-frd-tracker")).not.toBeInTheDocument();
  });

  it("frd-06: WHEN active THEN the EventFeed renders alongside the scene (AC-06-008.1)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.queryByTestId("event-feed")).not.toBeNull();
  });
});

describe("frd-06 REVIEWER (fragua): Production is read-only — no control affordances (AC-06-009.1)", () => {
  it("frd-06: WHEN active THEN NO mode selector reaches the DOM", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    // The mode travels as read-only TEXT in the MissionBar; never a control.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fragua-mode-display")).not.toBeInTheDocument();
  });

  it("frd-06: WHEN active THEN NO pause button reaches the DOM", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.queryByTestId("pause-button")).toBeNull();
    expect(screen.queryByText(/pausar/i)).toBeNull();
  });

  it("frd-06: WHEN active THEN NO reset button reaches the DOM", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_ENRICHED_NDJSON} />);
    expect(screen.queryByTestId("reset-button")).toBeNull();
    expect(screen.queryByText(/reiniciar/i)).toBeNull();
  });

  it("frd-06: WHEN empty THEN NO mode selector reaches the DOM", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} />);
    expect(screen.queryByTestId("mode-selector")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});

describe("frd-06 REVIEWER (fragua): Empty state (AC-06-010.1)", () => {
  it("frd-06: WHEN no FRD in build THEN empty state renders (not blank, not crash)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_EMPTY_NDJSON} />);
    expect(screen.queryByTestId("party-tab-empty")).not.toBeNull();
    expect(screen.queryByTestId("fragua-scene")).toBeNull();
  });
});
