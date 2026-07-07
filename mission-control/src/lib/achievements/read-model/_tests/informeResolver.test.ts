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
import type { PhaseTransition, ReportResult } from "../../report/types";
import type { FactoryResult } from "../factoryStoreReader";
import { resolveInformeSources } from "../informeResolver";
import type { PortadaResult } from "../statsReader";
import { makeFactoryStore, makePortada } from "./fixtures";

/** A live-reader stand-in that records whether it was invoked (never eagerly called). */
function spyLive<T>(value: T): { fn: () => T; calls: () => number } {
  const spy = vi.fn(() => value);
  return { fn: spy, calls: () => spy.mock.calls.length };
}

describe("resolveInformeSources — fresh portada (AC-23-001.1, SSOT split WO-23-005)", () => {
  it("uses the portada for per-project facts + the live cores for factory-wide facts", () => {
    const portada = makePortada();
    const portadaResult: PortadaResult = { ok: true, value: portada };
    const weeklyFlowLive = spyLive({
      ok: true as const,
      value: { woVerified: [], ideasCaptured: [], peakWeek: 0, ideasWithoutCreated: 0 },
    });
    const phaseTransitionsLive = spyLive({
      ok: true as const,
      value: [
        {
          project: "p",
          date: "2026-07-02",
          from: "design" as const,
          to: "architecture" as const,
          isReopen: false,
        },
      ],
    });
    const scalarsLive = spyLive({
      frds: 99,
      commits: 999,
      decisions: 42,
      projects: 7,
      testsPassing: null,
    });
    const lessonsLive = spyLive({ distilled: 5, captured: 6 });
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

    // Per-project facts come from the portada (the per-project git shell-out is skipped).
    expect(sources.weeklyFlow).toEqual({ ok: true, value: portada.weeklyFlow });
    expect(sources.funnel).toEqual(portada.funnel);
    expect(sources.scalars.frds).toBe(portada.scalars.frds);
    expect(sources.scalars.commits).toBe(portada.scalars.commits);
    expect(weeklyFlowLive.calls()).toBe(0);
    expect(funnelLive.calls()).toBe(0);

    // Factory-wide facts come from the LIVE cores (the portada no longer holds them — SSOT split).
    expect(sources.phaseTransitions).toEqual(phaseTransitionsLive.fn());
    expect(sources.lessons).toEqual(lessonsLive.fn());
    expect(sources.scalars.projects).toBe(7);
    expect(sources.scalars.decisions).toBe(42);
    expect(sources.scalars.testsPassing).toBeNull();
    expect(phaseTransitionsLive.calls()).toBeGreaterThan(0);
    expect(lessonsLive.calls()).toBeGreaterThan(0);
    expect(scalarsLive.calls()).toBeGreaterThan(0);
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

// ── WO-23-006: composed reader — factory-wide facts from the factory store ─────────────────────

/** A distinct, non-zero set of LIVE factory-wide values so "store vs live" is observable. */
function makeLive() {
  const weeklyFlow = spyLive({
    ok: true as const,
    value: { woVerified: [], ideasCaptured: [], peakWeek: 1, ideasWithoutCreated: 0 },
  });
  const phaseTransitions = spyLive({
    ok: true as const,
    value: [
      {
        project: "live-project",
        date: "2026-06-30",
        from: "product" as const,
        to: "design" as const,
        isReopen: false,
      },
    ],
  });
  const scalars = spyLive({
    frds: 5,
    commits: 100,
    decisions: 999, // live factory-wide count (distinct from the store's)
    projects: 88, // live factory-wide count (distinct from the store's)
    testsPassing: null,
  });
  const lessons = spyLive({ distilled: 1, captured: 2 });
  const funnel = spyLive({
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
  return { weeklyFlow, phaseTransitions, scalars, lessons, funnel };
}

function readers(live: ReturnType<typeof makeLive>) {
  return {
    weeklyFlow: live.weeklyFlow.fn,
    phaseTransitions: live.phaseTransitions.fn,
    scalars: live.scalars.fn,
    lessons: live.lessons.fn,
    funnel: live.funnel.fn,
  };
}

describe("resolveInformeSources — composes factory-wide store + per-project portada (AC-23-007.1)", () => {
  it("takes factory-wide facts from a FRESH factory store, per-project facts from a FRESH portada, and does NOT shell out to the factory-wide live readers", () => {
    const portada = makePortada();
    const store = makeFactoryStore(); // phaseTransitions[mission-control], scalars {projects:4, decisions:118}, lessons {92,40}
    const live = makeLive();

    const sources = resolveInformeSources({ ok: true, value: portada }, readers(live), {
      ok: true,
      value: store,
    } satisfies FactoryResult);

    // Factory-wide facts come from the STORE, not live → live factory-wide readers NOT invoked.
    expect(sources.phaseTransitions).toEqual({ ok: true, value: store.phaseTransitions });
    expect(sources.lessons).toEqual(store.lessons);
    expect(sources.scalars.projects).toBe(store.scalars.projects);
    expect(sources.scalars.decisions).toBe(store.scalars.decisions);
    expect(live.phaseTransitions.calls()).toBe(0);
    expect(live.lessons.calls()).toBe(0);

    // Per-project facts come from the fresh portada; its live readers not invoked either.
    expect(sources.scalars.frds).toBe(portada.scalars.frds);
    expect(sources.scalars.commits).toBe(portada.scalars.commits);
    expect(sources.weeklyFlow).toEqual({ ok: true, value: portada.weeklyFlow });
    expect(sources.funnel).toEqual(portada.funnel);
    expect(live.weeklyFlow.calls()).toBe(0);
    expect(live.funnel.calls()).toBe(0);

    // testsPassing is composed live (not held in either store) — never fabricated.
    expect(sources.scalars.testsPassing).toBeNull();
  });
});

describe("resolveInformeSources — independent fallback per scope (AC-23-007.2)", () => {
  it("factory-store MISS falls back for factory-wide facts ONLY; a fresh portada's per-project facts are untouched", () => {
    const portada = makePortada();
    const live = makeLive();

    const sources = resolveInformeSources({ ok: true, value: portada }, readers(live), {
      ok: false,
      reason: "stale",
    } satisfies FactoryResult);

    // Factory-wide facts fall back to LIVE (never a fabricated zero).
    expect(sources.phaseTransitions).toEqual(live.phaseTransitions.fn());
    expect(sources.lessons).toEqual(live.lessons.fn());
    expect(sources.scalars.projects).toBe(88);
    expect(sources.scalars.decisions).toBe(999);
    expect(live.phaseTransitions.calls()).toBeGreaterThan(0);

    // Per-project facts still come from the fresh portada — untouched by the factory-store miss.
    expect(sources.scalars.frds).toBe(portada.scalars.frds);
    expect(sources.scalars.commits).toBe(portada.scalars.commits);
    expect(sources.weeklyFlow).toEqual({ ok: true, value: portada.weeklyFlow });
    expect(live.weeklyFlow.calls()).toBe(0);
  });

  it("portada MISS falls back for per-project facts ONLY; a fresh factory store's factory-wide facts are untouched", () => {
    const store = makeFactoryStore();
    const live = makeLive();

    const sources = resolveInformeSources({ ok: false, reason: "missing" }, readers(live), {
      ok: true,
      value: store,
    } satisfies FactoryResult);

    // Per-project facts fall back to LIVE.
    expect(sources.weeklyFlow).toEqual(live.weeklyFlow.fn());
    expect(sources.funnel).toEqual(live.funnel.fn());
    expect(sources.scalars.frds).toBe(5);
    expect(sources.scalars.commits).toBe(100);
    expect(live.weeklyFlow.calls()).toBeGreaterThan(0);

    // Factory-wide facts still come from the fresh store — untouched by the portada miss.
    expect(sources.phaseTransitions).toEqual({ ok: true, value: store.phaseTransitions });
    expect(sources.lessons).toEqual(store.lessons);
    expect(sources.scalars.projects).toBe(store.scalars.projects);
    expect(sources.scalars.decisions).toBe(store.scalars.decisions);
    expect(live.phaseTransitions.calls()).toBe(0);
  });

  it("both stores non-ok → both scopes fall back to live, never a fabricated zero", () => {
    const live = makeLive();
    const sources = resolveInformeSources({ ok: false, reason: "unparseable" }, readers(live), {
      ok: false,
      reason: "unparseable",
    } satisfies FactoryResult);
    expect(sources.weeklyFlow).toEqual(live.weeklyFlow.fn());
    expect(sources.phaseTransitions).toEqual(live.phaseTransitions.fn());
    expect(sources.scalars).toEqual(live.scalars.fn());
    expect(sources.lessons).toEqual(live.lessons.fn());
    expect(sources.funnel).toEqual(live.funnel.fn());
  });
});

describe("resolveInformeSources — cross-project staleness regression (AC-23-007.3)", () => {
  // GIVEN two materialized projects A and B, WHEN a phase change in B invalidates the factory-wide
  // facts (the factory seal mismatches → readStatsFactory returns a non-ok FactoryResult), project A's
  // Informe must NOT be served the stale embedded factory-wide copy: it re-derives / falls back to live
  // for those facts. This MUST fail if the resolver ignored the FactoryResult and served stored data.
  it("project A does NOT read stale factory-wide data when B's phase change mismatches the factory seal", () => {
    // A's per-project portada is fresh (A itself did not change) — its per-project facts stay.
    const portadaA = makePortada({ scalars: { frds: 11, commits: 222 } });

    // The factory store still holds B's OLD phase transitions + OLD scalars (pre-change) — but the
    // factory seal now mismatches (B changed), so the reader returns STALE, forcing a live re-derive.
    const staleFactoryResult: FactoryResult = { ok: false, reason: "stale" };

    // Live re-derivation reflects B's NEW reality.
    const live = makeLive();
    const freshPhaseTransitions: ReportResult<PhaseTransition[]> = {
      ok: true,
      value: [
        {
          project: "B",
          date: "2026-07-06",
          from: "design",
          to: "architecture",
          isReopen: false,
        },
      ],
    };
    const phaseTransitionsLive = spyLive(freshPhaseTransitions);

    const sources = resolveInformeSources(
      { ok: true, value: portadaA },
      {
        weeklyFlow: live.weeklyFlow.fn,
        phaseTransitions: phaseTransitionsLive.fn,
        scalars: live.scalars.fn,
        lessons: live.lessons.fn,
        funnel: live.funnel.fn,
      },
      staleFactoryResult,
    );

    // A's factory-wide facts come from the LIVE re-derivation (B's new phase change), NOT a stale copy.
    expect(sources.phaseTransitions).toEqual(freshPhaseTransitions);
    expect(phaseTransitionsLive.calls()).toBeGreaterThan(0);

    // A's own per-project facts are untouched (its portada is still fresh).
    expect(sources.scalars.frds).toBe(11);
    expect(sources.scalars.commits).toBe(222);
    expect(sources.weeklyFlow).toEqual({ ok: true, value: portadaA.weeklyFlow });
  });
});
