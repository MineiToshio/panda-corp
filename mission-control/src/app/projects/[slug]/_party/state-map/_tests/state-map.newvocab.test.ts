/**
 * state-map — new engine vocabulary (2026-07-07):
 *   - wo_reopen  → setWo(wo, 'building')  [backward: tribunal → forge]
 *   - GateVerdict → closeGate             [the tribunal has ruled]
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import { eventToVisual, STATE_MAP_KNOWN_EVENTS } from "../state-map";

function ev(partial: Partial<DashboardEvent> & { event: string }): DashboardEvent {
  return { at: "2026-07-07T10:00:00Z", ...partial };
}

describe("eventToVisual — wo_reopen (backward transition)", () => {
  it("wo_reopen with a workOrder → setWo building (sprite walks back to the forge)", () => {
    const action = eventToVisual(
      ev({ event: "wo_reopen", workOrder: "WO-03-001", frd: "frd-03-x" }),
    );
    expect(action).toEqual({ kind: "setWo", wo: "WO-03-001", state: "building" });
  });

  it("wo_reopen without a workOrder → noop (never throws)", () => {
    expect(eventToVisual(ev({ event: "wo_reopen" }))).toEqual({ kind: "noop" });
  });
});

describe("eventToVisual — GateVerdict (tribunal ruled)", () => {
  it("GateVerdict → closeGate regardless of verdict", () => {
    expect(eventToVisual(ev({ event: "GateVerdict", verdict: "pass" }))).toEqual({
      kind: "closeGate",
    });
    expect(eventToVisual(ev({ event: "GateVerdict", verdict: "reopen" }))).toEqual({
      kind: "closeGate",
    });
    expect(eventToVisual(ev({ event: "GateVerdict", verdict: "blocked" }))).toEqual({
      kind: "closeGate",
    });
  });
});

describe("STATE_MAP_KNOWN_EVENTS includes the new vocabulary", () => {
  it("wo_reopen and GateVerdict are recognised event types", () => {
    expect(STATE_MAP_KNOWN_EVENTS.has("wo_reopen")).toBe(true);
    expect(STATE_MAP_KNOWN_EVENTS.has("GateVerdict")).toBe(true);
  });
});
