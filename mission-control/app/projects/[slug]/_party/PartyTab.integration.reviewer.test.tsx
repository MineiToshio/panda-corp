/**
 * FRD-06 REVIEWER integration test (Opus 4.8, gate 2026-06-17)
 *
 * Adversarial / integration: exercises what the project page actually mounts
 * for the Party tab (`<PartyTab />`, the single CMP-06-party-tab integration
 * seam) and asserts the FRD's HEADLINE acceptance criteria reach the DOM when
 * a team is active — not just the event feed.
 *
 * The per-WO unit tests proved each piece in isolation (PartyScene renders
 * zones/sprites; ActivityPulse, AchievementToast, RpgViewToggle render given
 * props). But the blueprint makes CMP-06-party-tab responsible for "renders the
 * scene + feed + empty state" — so if the tab never mounts the scene, the
 * owner opens the Party tab and sees NO RPG map, NO sprites, NO zones: the core
 * of the feature is invisible. These assertions catch exactly that gap.
 *
 * Anchored in EARS:
 *   REQ-06-001 — 4 pixel-art zones with labels (library/forge/workshop/lab)
 *   REQ-06-002 — a sprite per workflow subagent placed in its zone
 *   REQ-06-016 — RPG ↔ timeline toggle over the same data
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FIXTURE_EVENTS_NDJSON, FIXTURE_TASKS_ACTIVE_DIR } from "@/tests/fixtures/index";
import { PartyTab } from "./PartyTab";

describe("frd-06 REVIEWER: the Party tab actually mounts the RPG scene (integration)", () => {
  it("frd-06: WHEN a team is active THEN the 4 pixel-art zones reach the DOM (REQ-06-001)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />);

    // The scene container must mount.
    expect(screen.queryByTestId("party-scene")).not.toBeNull();
    // All four canonical zones with their labels.
    expect(screen.queryByTestId("party-zone-library")).not.toBeNull();
    expect(screen.queryByTestId("party-zone-forge")).not.toBeNull();
    expect(screen.queryByTestId("party-zone-workshop")).not.toBeNull();
    expect(screen.queryByTestId("party-zone-lab")).not.toBeNull();
  });

  it("frd-06: WHEN a team is active THEN at least one subagent sprite is placed (REQ-06-002)", () => {
    render(<PartyTab eventsPath={FIXTURE_EVENTS_NDJSON} tasksDir={FIXTURE_TASKS_ACTIVE_DIR} />);

    // The backend-dev sprite is present in every non-empty roster (pro..deep).
    expect(screen.queryByTestId("party-sprite-backend-dev")).not.toBeNull();
  });
});
