/**
 * event-vm — new engine vocabulary (2026-07-07): wo_reopen, verdict-aware
 * GateVerdict, PreviewSmoke (pass→test glyphs), Hardening, PatchResult.
 *
 * CRITICAL contract: isFeedEvent admits ONLY names resolving into EVENT_ICON, so
 * every new name must resolve or it is silently dropped from the bitácora.
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import { EVENT_ICON, isFeedEvent, toEventVM } from "../event-vm";

function ev(partial: Partial<DashboardEvent> & { event: string }): DashboardEvent {
  return { at: "2026-07-07T10:00:00Z", ...partial };
}

describe("event-vm new vocabulary → icons + labels", () => {
  it("wo_reopen → ↩️ glyph + 'WO reabierto' + carries the wo", () => {
    const vm = toEventVM(ev({ event: "wo_reopen", workOrder: "WO-03-001", frd: "frd-03-x" }));
    expect(vm.icon).toBe(EVENT_ICON.reopen);
    expect(vm.label).toBe("WO reabierto");
    expect(vm.wo).toBe("WO-03-001");
  });

  it("GateVerdict verdict 'reopen' with a count → verdict-aware label", () => {
    const vm = toEventVM(ev({ event: "GateVerdict", verdict: "reopen", reopenCount: 2 }));
    expect(vm.icon).toBe(EVENT_ICON.review);
    expect(vm.label).toBe("Veredicto: reopen · 2 reabiertos");
  });

  it("GateVerdict keeps a plain verdict label (back-compat with uppercase PASS)", () => {
    expect(toEventVM(ev({ event: "GateVerdict", verdict: "pass" })).label).toBe("Veredicto: pass");
    expect(toEventVM(ev({ event: "GateVerdict", verdict: "PASS" })).label).toBe("Veredicto: PASS");
  });

  it("PreviewSmoke pass → ✅ test glyph + route count, not a failure", () => {
    const vm = toEventVM(ev({ event: "PreviewSmoke", pass: true, routes: 5 }));
    expect(vm.icon).toBe(EVENT_ICON.test_ok);
    expect(vm.label).toBe("Humo OK · 5 rutas");
    expect(vm.isFailure).toBe(false);
  });

  it("PreviewSmoke fail → ❌ test glyph + failed/total, marked as failure", () => {
    const vm = toEventVM(ev({ event: "PreviewSmoke", pass: false, routes: 5, failed: 2 }));
    expect(vm.icon).toBe(EVENT_ICON.test_fail);
    expect(vm.label).toBe("Humo falló · 2/5 rutas");
    expect(vm.isFailure).toBe(true);
  });

  it("Hardening → 🛡️ shield glyph + stage · status label", () => {
    const vm = toEventVM(ev({ event: "Hardening", stage: "security", status: "ok" }));
    expect(vm.icon).toBe(EVENT_ICON.hardening);
    expect(vm.label).toBe("Endurecimiento: security · ok");
  });

  it("Hardening with a fail status is a first-class failure", () => {
    expect(
      toEventVM(ev({ event: "Hardening", stage: "telemetry", status: "fail" })).isFailure,
    ).toBe(true);
  });

  it("PatchResult → 🩹 glyph + outcome label", () => {
    const vm = toEventVM(ev({ event: "PatchResult", outcome: "green" }));
    expect(vm.icon).toBe(EVENT_ICON.patch);
    expect(vm.label).toBe("Parche: green");
  });
});

describe("event-vm new vocabulary → isFeedEvent admission (CRITICAL)", () => {
  it("every new engine name resolves into EVENT_ICON (never silently dropped)", () => {
    for (const name of [
      "wo_reopen",
      "GateVerdict",
      "PreviewSmoke",
      "Hardening",
      "PatchResult",
      "BuildLaunch",
      "BuildComplete",
    ]) {
      expect(isFeedEvent(ev({ event: name })), `${name} must pass isFeedEvent`).toBe(true);
    }
  });
});
