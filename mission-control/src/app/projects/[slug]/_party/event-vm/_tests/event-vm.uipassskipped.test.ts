/**
 * event-vm — UiPassSkipped (render-uipassskipped-timeline change).
 *
 * The engine emits UiPassSkipped whenever a build run skips the foundation-gate
 * or visual-qa pass (no detected UI artifacts, or forceUiPasses:false). Before
 * this change it fell through to the generic fallback ("·" / "Evento"); it now
 * gets its own icon + a label composing which pass was skipped, the FRD, and
 * the reason.
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import { EVENT_ICON, isFeedEvent, toEventVM } from "../event-vm";

function ev(partial: Partial<DashboardEvent> & { event: string }): DashboardEvent {
  return { at: "2026-09-23T10:00:00Z", ...partial };
}

describe("event-vm — UiPassSkipped", () => {
  it("gets its own icon (not the fallback)", () => {
    const vm = toEventVM(ev({ event: "UiPassSkipped", uiPass: "foundation-gate" }));
    expect(vm.icon).toBe(EVENT_ICON.ui_pass_skipped);
    expect(vm.icon).not.toBe("·");
  });

  it("label composes the skipped pass, the FRD and the reason", () => {
    const vm = toEventVM(
      ev({
        event: "UiPassSkipped",
        uiPass: "foundation-gate",
        frd: "frd-06-party",
        reason: "no-ui-artifacts",
      }),
    );
    expect(vm.label).toContain("foundation-gate");
    expect(vm.label).toContain("frd-06-party");
    expect(vm.label).toContain("no-ui-artifacts");
    expect(vm.frd).toBe("frd-06-party");
  });

  it("label degrades gracefully when frd/reason are absent", () => {
    const vm = toEventVM(ev({ event: "UiPassSkipped", uiPass: "visual-qa" }));
    expect(vm.label).toContain("visual-qa");
    expect(vm.label).not.toBe("Evento");
  });

  it("falls back to the generic label when even uiPass is absent", () => {
    const vm = toEventVM(ev({ event: "UiPassSkipped" }));
    expect(vm.label).not.toBe("Evento");
    expect(vm.icon).toBe(EVENT_ICON.ui_pass_skipped);
  });

  it("is admitted into the feed (isFeedEvent)", () => {
    expect(isFeedEvent(ev({ event: "UiPassSkipped", uiPass: "visual-qa" }))).toBe(true);
  });

  it("does not affect PreviewSmoke's own icon/label contract", () => {
    const ok = toEventVM(ev({ event: "PreviewSmoke", pass: true, routes: 5 }));
    expect(ok.icon).toBe(EVENT_ICON.test_ok);
    expect(ok.label).toBe("Humo OK · 5 rutas");

    const fail = toEventVM(ev({ event: "PreviewSmoke", pass: false, routes: 5, failed: 2 }));
    expect(fail.icon).toBe(EVENT_ICON.test_fail);
    expect(fail.isFailure).toBe(true);
  });
});
