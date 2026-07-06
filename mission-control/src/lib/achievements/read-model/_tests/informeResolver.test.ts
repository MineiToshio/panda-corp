/**
 * RED → GREEN tests for the Informe resolver (FRD-23, WO-23-003, REQ-23-001).
 *
 * The resolver tries the portada/aggregate first (via `statsReader`) and falls back to the
 * existing live git readers (WO-10-014) on ANY non-`ok` `PortadaResult`. Covers all four EARS
 * branches with a REAL production-shape portada fixture AND malformed variants (DR-078):
 *   AC-23-001.1 fresh portada    → numbers come from the portada, live readers NOT called.
 *   AC-23-001.2 missing portada  → live fallback, never a fabricated zero.
 *   AC-23-001.3 stale portada    → live fallback.
 *   AC-23-001.4 corrupt portada  → fail loud upstream (reader), resolver still falls back live.
 */

import { describe, expect, it, vi } from "vitest";
import { resolveInformeSources } from "../informeResolver";
import type { PortadaResult } from "../statsReader";
import { makePortada } from "./fixtures";

/** A live-reader stand-in that records whether it was invoked (never eagerly called). */
function spyLive<T>(value: T): { fn: () => T; calls: () => number } {
  const spy = vi.fn(() => value);
  return { fn: spy, calls: () => spy.mock.calls.length };
}

describe("resolveInformeSources — fresh portada (AC-23-001.1)", () => {
  it("uses the portada's numbers and never calls the live readers", () => {
    const portada = makePortada();
    const portadaResult: PortadaResult = { ok: true, value: portada };
    const weeklyFlowLive = spyLive({
      ok: true as const,
      value: { woVerified: [], ideasCaptured: [], peakWeek: 0, ideasWithoutCreated: 0 },
    });
    const phaseTransitionsLive = spyLive({ ok: true as const, value: [] });
    const scalarsLive = spyLive({
      frds: 0,
      commits: 0,
      decisions: 0,
      projects: 0,
      testsPassing: null,
    });
    const lessonsLive = spyLive(null);
    const funnelLive = spyLive({
      totalIdeas: 0,
      byStatus: {
        discovered: 0,
        recommended: 0,
        "in-pipeline": 0,
        shipped: 0,
        discarded: 0,
      },
      launched: 0,
      conversionPct: 0,
      wip: 0,
      discardsWithoutReason: 0,
    });

    const sources = resolveInformeSources(portadaResult, {
      weeklyFlow: weeklyFlowLive.fn,
      phaseTransitions: phaseTransitionsLive.fn,
      scalars: scalarsLive.fn,
      lessons: lessonsLive.fn,
      funnel: funnelLive.fn,
    });

    expect(sources.weeklyFlow).toEqual({ ok: true, value: portada.weeklyFlow });
    expect(sources.phaseTransitions).toEqual({ ok: true, value: portada.phaseTransitions });
    expect(sources.scalars).toEqual(portada.scalars);
    expect(sources.lessons).toEqual(portada.lessons);
    expect(sources.funnel).toEqual(portada.funnel);

    expect(weeklyFlowLive.calls()).toBe(0);
    expect(phaseTransitionsLive.calls()).toBe(0);
    expect(scalarsLive.calls()).toBe(0);
    expect(lessonsLive.calls()).toBe(0);
    expect(funnelLive.calls()).toBe(0);
  });
});

describe("resolveInformeSources — non-ok portada falls back to live (AC-23-001.2/.3/.4)", () => {
  const cases: { readonly label: string; readonly result: PortadaResult }[] = [
    { label: "missing (AC-23-001.2)", result: { ok: false, reason: "missing" } },
    { label: "stale (AC-23-001.3)", result: { ok: false, reason: "stale" } },
    { label: "unparseable/corrupt (AC-23-001.4)", result: { ok: false, reason: "unparseable" } },
  ];

  for (const { label, result } of cases) {
    it(`falls back to every live reader when the portada is ${label}`, () => {
      const weeklyFlowLive = spyLive({
        ok: true as const,
        value: { woVerified: [], ideasCaptured: [], peakWeek: 3, ideasWithoutCreated: 0 },
      });
      const phaseTransitionsLive = spyLive({ ok: true as const, value: [] });
      const scalarsLive = spyLive({
        frds: 5,
        commits: 100,
        decisions: 2,
        projects: 1,
        testsPassing: null,
      });
      const lessonsLive = spyLive({ distilled: 1, captured: 2 });
      const funnelLive = spyLive({
        totalIdeas: 4,
        byStatus: {
          discovered: 1,
          recommended: 0,
          "in-pipeline": 1,
          shipped: 0,
          discarded: 2,
        },
        launched: 0,
        conversionPct: 0,
        wip: 1,
        discardsWithoutReason: 2,
      });

      const sources = resolveInformeSources(result, {
        weeklyFlow: weeklyFlowLive.fn,
        phaseTransitions: phaseTransitionsLive.fn,
        scalars: scalarsLive.fn,
        lessons: lessonsLive.fn,
        funnel: funnelLive.fn,
      });

      expect(sources.weeklyFlow).toEqual(weeklyFlowLive.fn());
      expect(sources.scalars).toEqual(scalarsLive.fn());
      expect(sources.lessons).toEqual(lessonsLive.fn());
      expect(sources.funnel).toEqual(funnelLive.fn());

      // Never a fabricated zero: the resolver truly delegates, it does not synthesize its own empty.
      expect(weeklyFlowLive.calls()).toBeGreaterThan(0);
      expect(phaseTransitionsLive.calls()).toBeGreaterThan(0);
      expect(scalarsLive.calls()).toBeGreaterThan(0);
      expect(lessonsLive.calls()).toBeGreaterThan(0);
      expect(funnelLive.calls()).toBeGreaterThan(0);
    });
  }
});

describe("resolveInformeSources — never returns a silent empty on fallback", () => {
  it("propagates the live reader's OWN fail-loud result verbatim (does not collapse to ok:true)", () => {
    const weeklyFlowLive = spyLive({ ok: false as const, reason: "git-unavailable" as const });
    const phaseTransitionsLive = spyLive({
      ok: false as const,
      reason: "git-unavailable" as const,
    });
    const scalarsLive = spyLive({
      frds: 0,
      commits: 0,
      decisions: 0,
      projects: 0,
      testsPassing: null,
    });
    const lessonsLive = spyLive(null);
    const funnelLive = spyLive({
      totalIdeas: 0,
      byStatus: {
        discovered: 0,
        recommended: 0,
        "in-pipeline": 0,
        shipped: 0,
        discarded: 0,
      },
      launched: 0,
      conversionPct: 0,
      wip: 0,
      discardsWithoutReason: 0,
    });

    const sources = resolveInformeSources(
      { ok: false, reason: "missing" },
      {
        weeklyFlow: weeklyFlowLive.fn,
        phaseTransitions: phaseTransitionsLive.fn,
        scalars: scalarsLive.fn,
        lessons: lessonsLive.fn,
        funnel: funnelLive.fn,
      },
    );

    expect(sources.weeklyFlow).toEqual({ ok: false, reason: "git-unavailable" });
    expect(sources.phaseTransitions).toEqual({ ok: false, reason: "git-unavailable" });
  });
});
