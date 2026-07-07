/**
 * aggregateChain.reviewer.test.ts — REVIEWER-AUTHORED adversarial integration suite (DR-080, FRD-23).
 *
 * Exercises WO-23-001 (reader/seal) + WO-23-003 (informe wiring) + WO-23-004 (aggregate consumer)
 * TOGETHER, on the fail-loud honesty contract the isolated unit tests under-exercise: the FULL
 * aggregate → resolve → informe-sources chain must NEVER fabricate a zero, and must fall through
 * to the live readers on every non-usable outcome (missing / unparseable / no-entry / stale entry
 * with no on-disk fallback), reflecting the LIVE readers' own results verbatim (REQ-23-001, DR-078).
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
import { resolveInformeSources } from "../informeResolver";
import { currentSeal } from "../seal";
import type { AggregateResult } from "../statsReader";
import { makePortada } from "./fixtures";

vi.mock("../seal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../seal")>();
  return { ...actual, currentSeal: vi.fn() };
});
const mockedCurrentSeal = vi.mocked(currentSeal);

let dir: string;
let projectDir: string;

// Sentinel live-reader results — a CORRECT chain returns these VERBATIM on any fallback, never a
// fabricated zero synthesized inside the resolver.
const LIVE_WEEKLY: ReportResult<WeeklyFlow> = { ok: false, reason: "git-unavailable" };
const LIVE_TRANSITIONS: ReportResult<PhaseTransition[]> = {
  ok: true,
  value: [{ project: "p", date: "2026-07-01", from: "product", to: "design", isReopen: false }],
};
const LIVE_SCALARS: ReportScalars = {
  frds: 99,
  commits: 1234,
  decisions: 7,
  projects: 3,
  testsPassing: null,
};
const LIVE_LESSONS: LessonCounts | null = null;
const LIVE_FUNNEL: FunnelFlow = {
  totalIdeas: 5,
  byStatus: { discovered: 5, recommended: 0, "in-pipeline": 0, shipped: 0, discarded: 0 },
  launched: 0,
  conversionPct: 0,
  wip: 0,
  discardsWithoutReason: 0,
};

const liveReaders = {
  weeklyFlow: () => LIVE_WEEKLY,
  phaseTransitions: () => LIVE_TRANSITIONS,
  scalars: () => LIVE_SCALARS,
  lessons: () => LIVE_LESSONS,
  funnel: () => LIVE_FUNNEL,
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "agg-chain-"));
  projectDir = path.join(dir, "mission-control");
  fs.mkdirSync(projectDir, { recursive: true });
  mockedCurrentSeal.mockReset();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function okAggregate(seal: string): AggregateResult {
  return { ok: true, value: { projects: { "mission-control": makePortada({ seal }) } } };
}

describe("full aggregate→resolve→informe chain — honest fallback, never a fabricated zero (DR-078)", () => {
  it("a STALE aggregate entry with NO on-disk portada falls THROUGH to the live readers verbatim (git-unavailable is surfaced, not zeroed)", () => {
    // Aggregate holds a stale entry (old seal); git moved on; NO stats.json on disk either.
    mockedCurrentSeal.mockReturnValue("new".padEnd(40, "9"));
    const portadaResult = resolvePortadaFromAggregate(
      okAggregate("old".padEnd(40, "0")),
      "mission-control",
      projectDir,
    );
    // The chain did not manufacture a portada — it degraded to a non-ok reason.
    expect(portadaResult.ok).toBe(false);

    const sources = resolveInformeSources(portadaResult, liveReaders);
    // The live readers' OWN results flow through verbatim — including their fail-loud git-unavailable.
    expect(sources.weeklyFlow).toEqual(LIVE_WEEKLY);
    expect(sources.phaseTransitions).toEqual(LIVE_TRANSITIONS);
    expect(sources.scalars).toEqual(LIVE_SCALARS);
    expect(sources.lessons).toBeNull();
    expect(sources.funnel).toEqual(LIVE_FUNNEL);
    // Never a fabricated zero-length transition array masquerading as "no activity" (DR-078).
    if (sources.phaseTransitions.ok) {
      expect(sources.phaseTransitions.value.length).toBeGreaterThan(0);
    }
  });

  it("a FRESH aggregate entry supplies its PER-PROJECT facts directly — only the FACTORY-WIDE readers shell out to live (SSOT split, REQ-23-006.4 / AC-23-003.1)", () => {
    const seal = "fresh".padEnd(40, "f");
    mockedCurrentSeal.mockReturnValue(seal);
    const spy = {
      weeklyFlow: vi.fn(liveReaders.weeklyFlow),
      phaseTransitions: vi.fn(liveReaders.phaseTransitions),
      scalars: vi.fn(liveReaders.scalars),
      lessons: vi.fn(liveReaders.lessons),
      funnel: vi.fn(liveReaders.funnel),
    };

    const portadaResult = resolvePortadaFromAggregate(
      okAggregate(seal),
      "mission-control",
      projectDir,
    );
    expect(portadaResult.ok).toBe(true);

    const sources = resolveInformeSources(portadaResult, spy);
    // PER-PROJECT facts come from the fresh portada → their live git readers NEVER run.
    expect(spy.weeklyFlow).not.toHaveBeenCalled();
    expect(spy.funnel).not.toHaveBeenCalled();
    // FACTORY-WIDE facts are NOT covered by the per-project seal (SSOT split, REQ-23-006.4) — the
    // portada can no longer supply them, so they MUST come from live: these DO run (that is correct,
    // never-stale behavior, not a needless shell-out of a per-project fact).
    expect(spy.phaseTransitions).toHaveBeenCalled();
    expect(spy.lessons).toHaveBeenCalled();
    expect(spy.scalars).toHaveBeenCalled();
    // Honest composition: per-project numbers from the portada, factory-wide from live.
    const portada = makePortada();
    if (sources.weeklyFlow.ok) {
      expect(sources.weeklyFlow.value.peakWeek).toBe(portada.weeklyFlow.peakWeek);
    }
    expect(sources.scalars.frds).toBe(portada.scalars.frds);
    expect(sources.scalars.projects).toBe(LIVE_SCALARS.projects);
    expect(sources.phaseTransitions).toEqual(LIVE_TRANSITIONS);
  });
});
