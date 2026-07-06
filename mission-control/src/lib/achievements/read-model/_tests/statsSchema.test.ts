/**
 * RED → GREEN tests for the portada schema parser (FRD-23, WO-23-001, AC-23-001.4).
 *
 * Fail-loud (DR-078): `parseStatsPortada` / `parseStatsAggregate` return the typed value on a
 * real production shape, and `null` on any unrecognised/corrupt shape — never a silent partial.
 */

import { describe, expect, it } from "vitest";
import { parseStatsAggregate, parseStatsPortada, type StatsPortada } from "../statsSchema";
import { makePortada } from "./fixtures";

describe("parseStatsPortada — real production shape", () => {
  it("accepts a well-formed portada and preserves every field verbatim", () => {
    const raw = makePortada();
    const parsed = parseStatsPortada(raw);

    expect(parsed).not.toBeNull();
    const portada = parsed as StatsPortada;
    expect(portada.seal).toBe(raw.seal);
    expect(portada.generatedAt).toBe(raw.generatedAt);
    expect(portada.weeklyFlow.woVerified).toEqual(raw.weeklyFlow.woVerified);
    expect(portada.weeklyFlow.peakWeek).toBe(raw.weeklyFlow.peakWeek);
    expect(portada.phaseTransitions).toEqual(raw.phaseTransitions);
    expect(portada.scalars).toEqual(raw.scalars);
    expect(portada.funnel).toEqual(raw.funnel);
    expect(portada.lessons).toEqual(raw.lessons);
  });

  it("accepts `lessons: null` as a legitimate 'no cableado' value, not corruption", () => {
    const parsed = parseStatsPortada(makePortada({ lessons: null }));
    expect(parsed).not.toBeNull();
    expect((parsed as StatsPortada).lessons).toBeNull();
  });

  it("accepts `scalars.testsPassing: null` as a legitimate absence", () => {
    const raw = makePortada();
    const withNullTests = { ...raw, scalars: { ...raw.scalars, testsPassing: null } };
    const parsed = parseStatsPortada(withNullTests);
    expect(parsed).not.toBeNull();
    expect((parsed as StatsPortada).scalars.testsPassing).toBeNull();
  });
});

describe("parseStatsPortada — fail loud on unrecognised shapes (AC-23-001.4)", () => {
  it("rejects a non-object", () => {
    expect(parseStatsPortada(null)).toBeNull();
    expect(parseStatsPortada(42)).toBeNull();
    expect(parseStatsPortada("stats")).toBeNull();
    expect(parseStatsPortada([])).toBeNull();
  });

  it("rejects a missing/empty seal", () => {
    const { seal: _omit, ...noSeal } = makePortada();
    expect(parseStatsPortada(noSeal)).toBeNull();
    expect(parseStatsPortada(makePortada({ seal: "" }))).toBeNull();
    expect(parseStatsPortada(makePortada({ seal: 123 as unknown as string }))).toBeNull();
  });

  it("rejects a weeklyFlow with a malformed bucket (count is a string)", () => {
    const raw = makePortada();
    const bad = {
      ...raw,
      weeklyFlow: {
        ...raw.weeklyFlow,
        woVerified: [{ isoWeek: "2026-27", count: "seven" }],
      },
    };
    expect(parseStatsPortada(bad)).toBeNull();
  });

  it("rejects a phaseTransition with an unknown phase value", () => {
    const raw = makePortada();
    const bad = {
      ...raw,
      phaseTransitions: [
        { project: "x", date: "2026-07-01", from: "product", to: "launched", isReopen: false },
      ],
    };
    expect(parseStatsPortada(bad)).toBeNull();
  });

  it("rejects scalars with a NaN/Infinity count (corrupt number)", () => {
    const raw = makePortada();
    expect(parseStatsPortada({ ...raw, scalars: { ...raw.scalars, frds: Number.NaN } })).toBeNull();
    expect(
      parseStatsPortada({ ...raw, scalars: { ...raw.scalars, commits: Number.POSITIVE_INFINITY } }),
    ).toBeNull();
  });

  it("rejects a funnel missing an idea-status bucket", () => {
    const raw = makePortada();
    const { discovered: _drop, ...partialByStatus } = raw.funnel.byStatus;
    const bad = { ...raw, funnel: { ...raw.funnel, byStatus: partialByStatus } };
    expect(parseStatsPortada(bad)).toBeNull();
  });

  it("rejects a lessons object missing a count", () => {
    const raw = makePortada();
    const bad = { ...raw, lessons: { distilled: 3 } };
    expect(parseStatsPortada(bad)).toBeNull();
  });
});

describe("parseStatsAggregate — fail loud (AC-23-003.2)", () => {
  it("accepts a well-formed aggregate of several portadas", () => {
    const agg = { projects: { alpha: makePortada(), beta: makePortada({ seal: "beefbeef" }) } };
    const parsed = parseStatsAggregate(agg);
    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed?.projects ?? {})).toEqual(["alpha", "beta"]);
  });

  it("rejects an aggregate whose entry is a corrupt portada (whole join fails loud)", () => {
    const agg = { projects: { alpha: makePortada(), beta: { seal: "" } } };
    expect(parseStatsAggregate(agg)).toBeNull();
  });

  it("rejects a non-object / missing projects map", () => {
    expect(parseStatsAggregate(null)).toBeNull();
    expect(parseStatsAggregate({})).toBeNull();
    expect(parseStatsAggregate({ projects: [] })).toBeNull();
  });
});
