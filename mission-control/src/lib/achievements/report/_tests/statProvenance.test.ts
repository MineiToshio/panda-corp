import { describe, expect, it } from "vitest";
import { neverRecorded, recordedKinds } from "../statProvenance";

describe("AC-10-026.2 AC-10-028.5 counter provenance", () => {
  it.each([
    "agents",
    "streak",
    "speed",
    "builds",
    "subagents",
    "gates",
    "reviews",
    "findings",
    "modes",
    "activedays",
    "iterations",
    "flawless",
  ])("%s distinguishes never-recorded from a measured zero", (key) => {
    expect(neverRecorded(key, 0, new Set())).toBe(true);
    expect(neverRecorded(key, 4, new Set())).toBe(false);
  });
  it("event presence with a non-qualifying result still measures a real zero", () => {
    expect(neverRecorded("gates", 0, new Set(["GateResult"]))).toBe(false);
    expect(neverRecorded("reviews", 0, new Set(["ReviewVerdict"]))).toBe(false);
    expect(neverRecorded("shipped", 0, new Set())).toBe(false);
    expect(neverRecorded("testsPassing", 0, new Set())).toBe(false);
  });
  it("recognises observed telemetry without a corroborated result", () => {
    expect(
      recordedKinds({
        ideas: [],
        statuses: [],
        durableEvents: [],
        eventsSnapshot: {
          events: [{ event: "ReviewVerdict", at: "2026-10-20T00:00:00Z", verdict: "REJECTED" }],
          lastEventAt: null,
          byProject: {},
        },
      }).has("ReviewVerdict"),
    ).toBe(true);
  });
});
