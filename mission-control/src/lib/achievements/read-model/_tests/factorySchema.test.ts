/**
 * RED → GREEN tests for the factory-store schema parser + the portada scope-split (FRD-23, WO-23-005).
 *
 * SSOT split (DR-115, REQ-23-006): `parseStatsFactory` accepts a real factory-store shape and fails
 * loud (DR-078) on any corrupt shape; `parseStatsPortada` REJECTS the OLD shape's removed
 * factory-wide fields as "a shape it no longer owns" (they moved to the factory store).
 */

import { describe, expect, it } from "vitest";
import { parseStatsFactory, parseStatsPortada, type StatsFactory } from "../statsSchema";
import { makeFactoryStore, makePortada } from "./fixtures";

describe("parseStatsFactory — real production shape (AC-23-006.1/.3)", () => {
  it("accepts a well-formed factory store and preserves every field verbatim", () => {
    const raw = makeFactoryStore();
    const parsed = parseStatsFactory(raw);

    expect(parsed).not.toBeNull();
    const store = parsed as StatsFactory;
    expect(store.seal).toBe(raw.seal);
    expect(store.generatedAt).toBe(raw.generatedAt);
    expect(store.phaseTransitions).toEqual(raw.phaseTransitions);
    expect(store.scalars).toEqual(raw.scalars);
    expect(store.lessons).toEqual(raw.lessons);
  });

  it("accepts `lessons: null` as a legitimate 'no cableado' value, not corruption", () => {
    const parsed = parseStatsFactory(makeFactoryStore({ lessons: null }));
    expect(parsed).not.toBeNull();
    expect((parsed as StatsFactory).lessons).toBeNull();
  });

  it("accepts an empty phaseTransitions list (a real zero, not an error)", () => {
    const parsed = parseStatsFactory(makeFactoryStore({ phaseTransitions: [] }));
    expect(parsed).not.toBeNull();
    expect((parsed as StatsFactory).phaseTransitions).toEqual([]);
  });
});

describe("parseStatsFactory — fail loud on unrecognised shapes (AC-23-006.3)", () => {
  it("rejects a non-object", () => {
    expect(parseStatsFactory(null)).toBeNull();
    expect(parseStatsFactory(42)).toBeNull();
    expect(parseStatsFactory("factory")).toBeNull();
    expect(parseStatsFactory([])).toBeNull();
  });

  it("rejects a missing/empty seal", () => {
    const { seal: _omit, ...noSeal } = makeFactoryStore();
    expect(parseStatsFactory(noSeal)).toBeNull();
    expect(parseStatsFactory(makeFactoryStore({ seal: "" }))).toBeNull();
    expect(parseStatsFactory(makeFactoryStore({ seal: 123 as unknown as string }))).toBeNull();
  });

  it("rejects a phaseTransition with an unknown phase value", () => {
    const raw = makeFactoryStore();
    const bad = {
      ...raw,
      phaseTransitions: [
        { project: "x", date: "2026-07-01", from: "product", to: "launched", isReopen: false },
      ],
    };
    expect(parseStatsFactory(bad)).toBeNull();
  });

  it("rejects factory scalars with a NaN/Infinity or missing count (corrupt)", () => {
    const raw = makeFactoryStore();
    expect(
      parseStatsFactory({ ...raw, scalars: { ...raw.scalars, projects: Number.NaN } }),
    ).toBeNull();
    expect(
      parseStatsFactory({
        ...raw,
        scalars: { ...raw.scalars, decisions: Number.POSITIVE_INFINITY },
      }),
    ).toBeNull();
    expect(parseStatsFactory({ ...raw, scalars: { projects: 4 } })).toBeNull();
  });

  it("rejects a lessons object missing a count", () => {
    const raw = makeFactoryStore();
    expect(parseStatsFactory({ ...raw, lessons: { distilled: 3 } })).toBeNull();
  });
});

describe("parseStatsPortada — the pruned per-project shape (AC-23-006.4)", () => {
  it("accepts a portada holding ONLY per-project facts", () => {
    const parsed = parseStatsPortada(makePortada());
    expect(parsed).not.toBeNull();
  });

  it("parses per-project scalars as {frds, commits} only", () => {
    const parsed = parseStatsPortada(makePortada());
    expect(parsed?.scalars).toEqual({ frds: 23, commits: 412 });
  });

  it("no longer exposes factory-wide fields on the parsed portada (retired by construction)", () => {
    const parsed = parseStatsPortada(makePortada());
    expect(parsed).not.toBeNull();
    // The removed fields are absent from the parsed value — they are a shape the portada no
    // longer owns (DR-115: retire the stale copy, don't just stop writing it).
    expect(parsed).not.toHaveProperty("phaseTransitions");
    expect(parsed).not.toHaveProperty("lessons");
    expect(parsed?.scalars).not.toHaveProperty("projects");
    expect(parsed?.scalars).not.toHaveProperty("decisions");
  });

  it("rejects a portada whose scalars carry the OLD factory-wide-only shape (no per-project counts)", () => {
    // A pre-split portada whose `scalars` only had projects/decisions and no frds/commits is now
    // an unrecognised shape → fail loud (the parser requires the per-project counts).
    const raw = makePortada();
    const preSplit = { ...raw, scalars: { decisions: 118, projects: 4 } };
    expect(parseStatsPortada(preSplit)).toBeNull();
  });
});
