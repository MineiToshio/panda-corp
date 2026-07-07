/**
 * RED → GREEN tests for the single portada writer (FRD-23, WO-23-002, REQ-23-002).
 *
 * Covers:
 *   AC-23-002.1 — numbers re-derived from git + seal stamped; NEVER incremental writes
 *                 (verified: the writer only unwraps the report readers, no +1/-1 arithmetic).
 *   AC-23-002.2 — atomic write (tmp + rename); a mid-write crash never leaves a corrupt stats.json.
 *   AC-23-002.3 — equivalence: the materialized numbers EQUAL the live git reader's numbers.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withFactoryRoot } from "../../../../tests/fixtures/index";
import { getGuildState } from "../../../gamification/guildState";
import { readIdeas } from "../../../ideas/ideas";
import { weeklyFlow } from "../../report/flowSeries";
import { funnelAndFlow } from "../../report/funnel";
import { reportScalars } from "../../report/scalars";
import { currentSeal } from "../seal";
import { readStatsPortada } from "../statsReader";
import { parseStatsPortada } from "../statsSchema";
import type { LiveReportValues, PortadaStamp } from "../statsWriter";
import {
  buildPortada,
  gatherLiveValues,
  PortadaDeriveError,
  writePortadaAtomic,
  writeStatsPortada,
} from "../statsWriter";
import { FIXTURE_SEAL, makePortada } from "./fixtures";
import { makeSyntheticFactoryRepo, type SyntheticFactoryRepo } from "./gitFixture";

// ── Live report values from the fixture portada (so tests are deterministic) ──────
// SSOT split (WO-23-005): the portada holds ONLY per-project facts now.
const FIXTURE = makePortada();

function okValues(): LiveReportValues {
  return {
    weeklyFlow: { ok: true, value: FIXTURE.weeklyFlow },
    scalars: FIXTURE.scalars,
    funnel: FIXTURE.funnel,
  };
}

const STAMP: PortadaStamp = { seal: FIXTURE_SEAL, generatedAt: "2026-07-06T12:00:00.000Z" };

// ── buildPortada — pure assembly (AC-23-002.1: unwrap, never re-derive) ───────────
describe("buildPortada — assembles from live values, never re-derives (AC-23-002.1)", () => {
  it("materializes the live numbers verbatim + stamps the seal", () => {
    const portada = buildPortada(okValues(), STAMP);

    expect(portada.seal).toBe(FIXTURE_SEAL);
    expect(portada.generatedAt).toBe("2026-07-06T12:00:00.000Z");
    expect(portada.weeklyFlow).toEqual(FIXTURE.weeklyFlow);
    expect(portada.scalars).toEqual(FIXTURE.scalars);
    expect(portada.funnel).toEqual(FIXTURE.funnel);
  });

  it("produces a portada that satisfies the fail-loud parser (round-trips)", () => {
    const portada = buildPortada(okValues(), STAMP);
    const round = parseStatsPortada(JSON.parse(JSON.stringify(portada)));
    expect(round).not.toBeNull();
    expect(round).toEqual(portada);
  });

  it("holds only per-project facts — no factory-wide fields (SSOT split, WO-23-005)", () => {
    const portada = buildPortada(okValues(), STAMP);
    expect(portada).not.toHaveProperty("phaseTransitions");
    expect(portada).not.toHaveProperty("lessons");
    expect(portada.scalars).toEqual({
      frds: FIXTURE.scalars.frds,
      commits: FIXTURE.scalars.commits,
    });
  });

  it("fails loud when weeklyFlow could not be derived (never a fabricated zero, DR-078)", () => {
    const values: LiveReportValues = {
      ...okValues(),
      weeklyFlow: { ok: false, reason: "git-unavailable" },
    };
    expect(() => buildPortada(values, STAMP)).toThrow(PortadaDeriveError);
  });

  it("fails loud on an empty seal (never stamps a blank freshness seal)", () => {
    expect(() => buildPortada(okValues(), { ...STAMP, seal: "" })).toThrow(PortadaDeriveError);
  });
});

// ── writePortadaAtomic — atomic write (AC-23-002.2) ───────────────────────────────
describe("writePortadaAtomic — atomic tmp + rename (AC-23-002.2)", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "portada-writer-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("writes a valid, parseable stats.json", () => {
    const target = path.join(dir, ".pandacorp", "stats.json");
    writePortadaAtomic(target, FIXTURE);

    const raw = fs.readFileSync(target, "utf-8");
    const parsed = parseStatsPortada(JSON.parse(raw));
    expect(parsed).toEqual(FIXTURE);
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("leaves the previous file intact if the rename step throws mid-write", () => {
    const target = path.join(dir, ".pandacorp", "stats.json");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const previous = makePortada({ seal: "0".repeat(40) });
    fs.writeFileSync(target, `${JSON.stringify(previous, null, 2)}\n`, "utf-8");

    // Simulate a crash at the rename boundary: the temp file was written but the swap fails.
    vi.spyOn(fs, "renameSync").mockImplementationOnce(() => {
      throw new Error("simulated crash before rename");
    });

    expect(() => writePortadaAtomic(target, FIXTURE)).toThrow("simulated crash");

    // The reader must still see the WHOLE previous file — never a half-written corrupt one.
    const raw = fs.readFileSync(target, "utf-8");
    const parsed = parseStatsPortada(JSON.parse(raw));
    expect(parsed).toEqual(previous);

    // And no temp litter left behind (cleanup on failure).
    const leftovers = fs.readdirSync(path.dirname(target)).filter((f) => f.includes(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("never leaves a readable partial file: the target is only ever whole", () => {
    const target = path.join(dir, ".pandacorp", "stats.json");
    // Force the write of the tmp file to throw AFTER partial content — the target must not exist.
    vi.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
      throw new Error("disk full mid-write");
    });
    expect(() => writePortadaAtomic(target, FIXTURE)).toThrow("disk full");
    expect(fs.existsSync(target)).toBe(false);
  });
});

// ── gatherLiveValues — reuses the report readers (DR-092) ─────────────────────────
describe("gatherLiveValues — assembles from the report readers, not a re-derivation", () => {
  it("calls the injected ideas/statuses through funnelAndFlow (single derivation)", () => {
    // Real MC repo at cwd backs the git-derived series; ideas/statuses default to the single sources.
    const values = gatherLiveValues(process.cwd(), [], []);
    // funnelAndFlow of empty ideas/statuses is a real, deterministic zero funnel.
    expect(values.funnel.totalIdeas).toBe(0);
    expect(values.funnel.launched).toBe(0);
    expect(values.funnel.wip).toBe(0);
  });
});

// ── writeStatsPortada — end-to-end single writer (AC-23-002.1/.2) ─────────────────
// Runs against a SYNTHETIC factory git fixture (gitFixture.ts) — never the real .pandacorp/:
// the previous version wrote and then deleted the REAL `mission-control/.pandacorp/stats.json`
// on every gate run, destroying the owner's live FRD-23 materialization (defective test, repaired
// 2026-07-07). Real git is still exercised end-to-end — inside the temp fixture repo.
describe("writeStatsPortada — single writer, seal stamped, atomic (AC-23-002.1/.2)", () => {
  let dir: string;
  let fixture: SyntheticFactoryRepo;

  beforeAll(() => {
    fixture = makeSyntheticFactoryRepo();
  });

  afterAll(() => {
    fixture.cleanup();
  });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "portada-e2e-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("fails loud (writes nothing) when git is unavailable (null seal, DR-078)", () => {
    // A fresh non-git temp dir → currentSeal returns null.
    expect(() => writeStatsPortada(dir)).toThrow(PortadaDeriveError);
    expect(fs.existsSync(path.join(dir, ".pandacorp", "stats.json"))).toBe(false);
  });

  it("writes a fresh, seal-matching portada the reader accepts (synthetic git fixture)", async () => {
    await withFactoryRoot(fixture.factoryRoot, () => {
      const projectPath = fixture.projectPath;
      const seal = currentSeal(projectPath);
      expect(seal).toMatch(/^[0-9a-f]{40}$/);

      const written = writeStatsPortada(projectPath, () => new Date("2026-07-06T00:00:00.000Z"));
      expect(written).toBe(path.join(projectPath, ".pandacorp", "stats.json"));

      // Read it back through the fail-loud reader: it must be fresh (seal matches) and parse.
      const result = readStatsPortada(projectPath);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.seal).toBe(seal);
      }
    });
  });
});

// ── Equivalence: materialized == live git reader (AC-23-002.3) ────────────────────
describe("portada-vs-live equivalence (AC-23-002.3)", () => {
  let fixture: SyntheticFactoryRepo;

  beforeAll(() => {
    fixture = makeSyntheticFactoryRepo();
  });

  afterAll(() => {
    fixture.cleanup();
  });

  it("materialized numbers equal the live git reader's numbers for the same project", async () => {
    await withFactoryRoot(fixture.factoryRoot, () => {
      const projectPath = fixture.projectPath;

      // The live git reader's numbers (the fallback path MC uses today). The fixture guarantees
      // derivability (committed docs/frds + status.yaml history), so `ok` is ASSERTED, not skipped.
      const liveWeekly = weeklyFlow(projectPath);
      const liveScalars = reportScalars(projectPath);
      const liveFunnel = funnelAndFlow(readIdeas(), getGuildState().statuses);
      expect(liveWeekly.ok).toBe(true);
      if (!liveWeekly.ok) return;

      const seal = currentSeal(projectPath);
      expect(seal).not.toBeNull();
      if (seal === null) return;

      const written = writeStatsPortada(projectPath, () => new Date("2026-07-06T00:00:00.000Z"));
      const materialized = parseStatsPortada(JSON.parse(fs.readFileSync(written, "utf-8")));

      expect(materialized).not.toBeNull();
      if (materialized === null) return;

      // Field-by-field: the materialized per-project portada equals the live-git derivation (no drift).
      expect(materialized.weeklyFlow).toEqual(liveWeekly.value);
      // Per-project subset only — projects/decisions are factory-wide (WO-23-005 factory store).
      expect(materialized.scalars).toEqual({
        frds: liveScalars.frds,
        commits: liveScalars.commits,
      });
      // The funnel depends on ideas/statuses read at write time — it uses the same single sources,
      // so re-deriving here with those same sources equals the materialized value.
      expect(materialized.funnel).toEqual(liveFunnel);
    });
  });
});
