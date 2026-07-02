/**
 * event-vm Wave 3 — real engine vocabulary + feed noise filter (REQ-06-015,
 * 2026-07-01). The bitácora previously rendered every real event as the
 * "Evento" fallback with a raw Lucide identifier as its icon; these tests pin
 * the real-name mapping, the emoji glyphs, and `isFeedEvent`.
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import { EVENT_ICON, isFeedEvent, toEventVM } from "../event-vm";

function ev(partial: Partial<DashboardEvent> & { event: string }): DashboardEvent {
  return { at: "2026-07-01T10:00:00Z", ...partial };
}

describe("frd-06 Wave 3: real event names map into the bounded vocabulary", () => {
  it("frd-06: AgentWorking (build/implement) → forging label + start glyph", () => {
    const vm = toEventVM(ev({ event: "AgentWorking", phase: "build", activity: "implement" }));
    expect(vm.icon).toBe(EVENT_ICON.start);
    expect(vm.label).toBe("Forjando");
  });

  it("frd-06: AgentWorking (review, no activity) → generic review label", () => {
    const vm = toEventVM(ev({ event: "AgentWorking", phase: "review" }));
    expect(vm.label).toBe("Revisión en curso");
  });

  it("frd-06: BuildLaunch → launch glyph + Spanish label", () => {
    const vm = toEventVM(ev({ event: "BuildLaunch" }));
    expect(vm.icon).toBe(EVENT_ICON.launch);
    expect(vm.label).toBe("Build lanzado");
  });

  it("frd-06: GateVerdict carries its verdict in the label", () => {
    const vm = toEventVM(ev({ event: "GateVerdict", verdict: "PASS" }));
    expect(vm.icon).toBe(EVENT_ICON.review);
    expect(vm.label).toBe("Veredicto: PASS");
  });

  it("frd-06: wo_commit (per-WO green commit) → commit glyph", () => {
    const vm = toEventVM(ev({ event: "wo_commit", workOrder: "WO-03-001" }));
    expect(vm.icon).toBe(EVENT_ICON.commit);
    expect(vm.wo).toBe("WO-03-001");
  });

  it("frd-06: every EVENT_ICON glyph is a short emoji, not a Lucide identifier", () => {
    for (const icon of Object.values(EVENT_ICON)) {
      expect(icon).not.toMatch(/^[a-z-]+$/);
      expect(icon.length).toBeLessThanOrEqual(3);
    }
  });
});

describe("frd-06 Wave 3: isFeedEvent — the bitácora noise filter (AC-06-015.1)", () => {
  it("frd-06: SupervisorTick and hook SubagentStop are session noise → filtered", () => {
    expect(isFeedEvent(ev({ event: "SupervisorTick" }))).toBe(false);
    expect(isFeedEvent(ev({ event: "SubagentStop" }))).toBe(false);
  });

  it("frd-06: engine vocabulary passes (AgentWorking, gate, achievement, wo_commit)", () => {
    expect(isFeedEvent(ev({ event: "AgentWorking" }))).toBe(true);
    expect(isFeedEvent(ev({ event: "gate" }))).toBe(true);
    expect(isFeedEvent(ev({ event: "achievement" }))).toBe(true);
    expect(isFeedEvent(ev({ event: "wo_commit" }))).toBe(true);
  });

  it("frd-06: a FAILURE always passes, whatever its type (first-class state)", () => {
    expect(isFeedEvent(ev({ event: "SubagentStop", status: "fail" }))).toBe(true);
    expect(isFeedEvent(ev({ event: "test_fail" }))).toBe(true);
  });
});
