/**
 * composedReader.reviewer.test.ts — REVIEWER-AUTHORED adversarial integration suite (DR-080, FRD-23).
 *
 * WO-23-006 exercised the resolver with hand-built PortadaResult/FactoryResult values. This suite
 * exercises the FULL production chain the page seam runs: aggregate → resolvePortadaFromAggregate →
 * readStatsFactory (real fail-loud reader over a real tmp file) → resolveInformeSources, on the seams
 * the isolated unit tests under-exercise:
 *
 *   1. A fresh aggregate entry + a fresh on-disk factory store → BOTH scopes served from the stores,
 *      neither scope's live git reader shells out for the facts it supplies (AC-23-003.1 / AC-23-007.1),
 *      and NO factory-wide value is fabricated (DR-078).
 *   2. A CORRUPT on-disk stats-factory.json → the reader fails LOUD (unparseable) → the composed
 *      reader falls back to the live factory-wide cores VERBATIM (never a silent zero), while a fresh
 *      portada keeps supplying per-project facts untouched (independent fallback, AC-23-007.2).
 *   3. The factory store is NEVER read as fresh when git can't compute a seal (null) — an unvalidatable
 *      store is treated stale, so the store's numbers can never masquerade as fresh truth (AC-23-006.3).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FunnelFlow,
  LessonCounts,
  PhaseTransition,
  ReportResult,
  ReportScalars,
  WeeklyFlow,
} from "../../report/types";
import { resolvePortadaFromAggregate } from "../aggregateConsumer";
import * as factorySeal from "../factorySeal";
import { readStatsFactory } from "../factoryStoreReader";
import { resolveInformeSources } from "../informeResolver";
import { currentSeal } from "../seal";
import type { AggregateResult } from "../statsReader";
import { FIXTURE_FACTORY_SEAL, makeFactoryStore, makePortada } from "./fixtures";

vi.mock("../seal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../seal")>();
  return { ...actual, currentSeal: vi.fn() };
});
const mockedCurrentSeal = vi.mocked(currentSeal);

let dir: string;
let projectDir: string;

// Distinct, non-zero LIVE factory-wide values so "store vs live" is observable in every branch.
const LIVE_TRANSITIONS: ReportResult<PhaseTransition[]> = {
  ok: true,
  value: [
    { project: "live", date: "2026-07-05", from: "design", to: "architecture", isReopen: false },
  ],
};
const LIVE_SCALARS: ReportScalars = {
  frds: 7,
  commits: 700,
  decisions: 555, // live factory-wide — distinct from the store's 118
  projects: 66, // live factory-wide — distinct from the store's 4
  testsPassing: null,
};
const LIVE_LESSONS: LessonCounts | null = { distilled: 1, captured: 2 };
const LIVE_WEEKLY: ReportResult<WeeklyFlow> = {
  ok: true,
  value: { woVerified: [], ideasCaptured: [], peakWeek: 9, ideasWithoutCreated: 0 },
};
const LIVE_FUNNEL: FunnelFlow = {
  totalIdeas: 3,
  byStatus: { discovered: 3, recommended: 0, "in-pipeline": 0, shipped: 0, discarded: 0 },
  launched: 0,
  conversionPct: 0,
  wip: 0,
  discardsWithoutReason: 0,
};

function spyReaders() {
  return {
    weeklyFlow: vi.fn((): ReportResult<WeeklyFlow> => LIVE_WEEKLY),
    phaseTransitions: vi.fn((): ReportResult<PhaseTransition[]> => LIVE_TRANSITIONS),
    scalars: vi.fn((): ReportScalars => LIVE_SCALARS),
    lessons: vi.fn((): LessonCounts | null => LIVE_LESSONS),
    funnel: vi.fn((): FunnelFlow => LIVE_FUNNEL),
  };
}

function okAggregate(seal: string): AggregateResult {
  return { ok: true, value: { projects: { "mission-control": makePortada({ seal }) } } };
}

/** Write a stats-factory.json under a fake factory root; return that root. */
function writeFactoryFile(contents: string): string {
  const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "composed-factory-"));
  fs.mkdirSync(path.join(factoryRoot, ".pandacorp"), { recursive: true });
  fs.writeFileSync(path.join(factoryRoot, ".pandacorp", "stats-factory.json"), contents);
  return factoryRoot;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "composed-chain-"));
  projectDir = path.join(dir, "mission-control");
  fs.mkdirSync(projectDir, { recursive: true });
  mockedCurrentSeal.mockReset();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("full aggregate → factory-store → composed chain (FRD-23, WO-23-006)", () => {
  it("fresh aggregate entry + fresh on-disk factory store → BOTH from stores, no per-project git shell-out, no fabricated factory-wide value", () => {
    const seal = "fresh".padEnd(40, "f");
    mockedCurrentSeal.mockReturnValue(seal);
    // Real factory reader over a real fresh file (seal matches the store fixture's seal).
    vi.spyOn(factorySeal, "currentFactorySeal").mockReturnValue(FIXTURE_FACTORY_SEAL);
    const store = makeFactoryStore(); // scalars {projects:4, decisions:118}, lessons {92,40}
    const factoryRoot = writeFactoryFile(JSON.stringify(store));

    const portadaResult = resolvePortadaFromAggregate(
      okAggregate(seal),
      "mission-control",
      projectDir,
    );
    expect(portadaResult.ok).toBe(true);

    const factoryResult = readStatsFactory(factoryRoot);
    expect(factoryResult.ok).toBe(true);

    const readers = spyReaders();
    const sources = resolveInformeSources(portadaResult, readers, factoryResult);

    // Per-project facts from the fresh portada → their live readers NEVER shell out (AC-23-003.1).
    expect(readers.weeklyFlow).not.toHaveBeenCalled();
    expect(readers.funnel).not.toHaveBeenCalled();
    // Factory-wide facts from the FRESH store → their live readers NEVER shell out (AC-23-007.1).
    expect(readers.phaseTransitions).not.toHaveBeenCalled();
    expect(readers.lessons).not.toHaveBeenCalled();

    // The composed numbers are the STORE's, not the live sentinels — no fabricated zero.
    expect(sources.scalars.projects).toBe(store.scalars.projects);
    expect(sources.scalars.decisions).toBe(store.scalars.decisions);
    expect(sources.lessons).toEqual(store.lessons);
    expect(sources.phaseTransitions).toEqual({ ok: true, value: store.phaseTransitions });
    fs.rmSync(factoryRoot, { recursive: true, force: true });
  });

  it("CORRUPT on-disk stats-factory.json → reader fails LOUD → factory-wide facts fall back to live VERBATIM, per-project untouched (independent, DR-078)", () => {
    const seal = "fresh".padEnd(40, "f");
    mockedCurrentSeal.mockReturnValue(seal);
    // A well-formed-JSON-but-wrong-shape store: the fail-loud parser must reject it (unparseable).
    const factoryRoot = writeFactoryFile(JSON.stringify({ seal: "x".padEnd(40, "x"), nope: true }));

    const factoryResult = readStatsFactory(factoryRoot);
    expect(factoryResult).toEqual({ ok: false, reason: "unparseable" });

    const portadaResult = resolvePortadaFromAggregate(
      okAggregate(seal),
      "mission-control",
      projectDir,
    );
    expect(portadaResult.ok).toBe(true);

    const readers = spyReaders();
    const sources = resolveInformeSources(portadaResult, readers, factoryResult);

    // Factory-wide facts fall back to the LIVE cores verbatim — the live sentinels, NOT a fabricated zero.
    expect(sources.phaseTransitions).toEqual(LIVE_TRANSITIONS);
    expect(sources.scalars.projects).toBe(LIVE_SCALARS.projects);
    expect(sources.scalars.decisions).toBe(LIVE_SCALARS.decisions);
    expect(sources.lessons).toEqual(LIVE_LESSONS);
    expect(readers.phaseTransitions).toHaveBeenCalled();
    expect(readers.lessons).toHaveBeenCalled();

    // Per-project facts stay from the fresh portada — the corrupt factory store did NOT touch them.
    const portada = makePortada();
    expect(sources.scalars.frds).toBe(portada.scalars.frds);
    expect(sources.scalars.commits).toBe(portada.scalars.commits);
    expect(readers.weeklyFlow).not.toHaveBeenCalled();
    expect(readers.funnel).not.toHaveBeenCalled();
    fs.rmSync(factoryRoot, { recursive: true, force: true });
  });

  it("on-disk store present but git seal is NULL (git unavailable) → treated STALE, never read as fresh → live fallback", () => {
    const seal = "fresh".padEnd(40, "f");
    mockedCurrentSeal.mockReturnValue(seal);
    // Well-formed store on disk, but the factory seal cannot be computed → must NOT be trusted.
    vi.spyOn(factorySeal, "currentFactorySeal").mockReturnValue(null);
    const factoryRoot = writeFactoryFile(JSON.stringify(makeFactoryStore()));

    const factoryResult = readStatsFactory(factoryRoot);
    expect(factoryResult).toEqual({ ok: false, reason: "stale" });

    const portadaResult = resolvePortadaFromAggregate(
      okAggregate(seal),
      "mission-control",
      projectDir,
    );
    const readers = spyReaders();
    const sources = resolveInformeSources(portadaResult, readers, factoryResult);

    // The unvalidatable store's numbers never surface — the live cores do.
    expect(sources.scalars.projects).toBe(LIVE_SCALARS.projects);
    expect(sources.phaseTransitions).toEqual(LIVE_TRANSITIONS);
    expect(readers.phaseTransitions).toHaveBeenCalled();
    fs.rmSync(factoryRoot, { recursive: true, force: true });
  });
});
