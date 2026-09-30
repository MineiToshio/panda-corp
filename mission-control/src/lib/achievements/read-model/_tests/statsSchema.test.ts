/**
 * RED → GREEN tests for the portada schema parser (FRD-23, WO-23-001, AC-23-001.4).
 *
 * Fail-loud (DR-078): `parseStatsPortada` / `parseStatsAggregate` return the typed value on a
 * real production shape, and `null` on any unrecognised/corrupt shape — never a silent partial.
 */

import { describe, expect, it } from "vitest";
import { parseStatsAggregate, parseStatsPortada, type StatsPortada } from "../statsSchema";
import { makePortada } from "./fixtures";

describe("parseStatsPortada — real production shape (per-project only, WO-23-005)", () => {
  it("accepts a well-formed portada and preserves every field verbatim", () => {
    const raw = makePortada();
    const parsed = parseStatsPortada(raw);

    expect(parsed).not.toBeNull();
    const portada = parsed as StatsPortada;
    expect(portada.seal).toBe(raw.seal);
    expect(portada.generatedAt).toBe(raw.generatedAt);
    expect(portada.woFlow.woVerified).toEqual(raw.woFlow.woVerified);
    expect(portada.woFlow.peakWeek).toBe(raw.woFlow.peakWeek);
    expect(portada.scalars).toEqual(raw.scalars);
  });

  it("holds only sealed facts: no commits, funnel or ideas series survive parsing", () => {
    const withUnsealed = {
      ...makePortada(),
      scalars: { frds: 23, commits: 412 },
      funnel: { totalIdeas: 1 },
      woFlow: { woVerified: [], peakWeek: 0, ideasCaptured: [] },
    };
    const parsed = parseStatsPortada(withUnsealed);
    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed ?? {}).sort()).toEqual(["generatedAt", "scalars", "seal", "woFlow"]);
    expect(parsed?.scalars).toEqual({ frds: 23 });
    expect(Object.keys(parsed?.woFlow ?? {}).sort()).toEqual(["peakWeek", "woVerified"]);
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

  it("rejects a woFlow with a malformed bucket (count is a string)", () => {
    const raw = makePortada();
    const bad = {
      ...raw,
      woFlow: { ...raw.woFlow, woVerified: [{ isoWeek: "2026-27", count: "seven" }] },
    };
    expect(parseStatsPortada(bad)).toBeNull();
  });

  it("rejects per-project scalars with a NaN/Infinity count (corrupt number)", () => {
    const raw = makePortada();
    expect(parseStatsPortada({ ...raw, scalars: { frds: Number.NaN } })).toBeNull();
    expect(parseStatsPortada({ ...raw, scalars: { frds: Number.POSITIVE_INFINITY } })).toBeNull();
  });

  it("rejects a pre-seal-coverage portada (weeklyFlow/funnel shape) so it falls back live", () => {
    const { woFlow: _drop, ...rest } = makePortada();
    const legacy = {
      ...rest,
      weeklyFlow: { woVerified: [], ideasCaptured: [], peakWeek: 0, ideasWithoutCreated: 0 },
      scalars: { frds: 23, commits: 412 },
      funnel: { totalIdeas: 0 },
    };
    expect(parseStatsPortada(legacy)).toBeNull();
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
