/**
 * RED → GREEN tests for the fail-loud portada reader (FRD-23, WO-23-001, REQ-23-001).
 *
 * Real fixtures on disk (a real `.pandacorp/stats.json` per case) + a mocked `currentSeal` so
 * freshness is deterministic. Covers every EARS branch:
 *   AC-23-001.1 present + fresh   → { ok: true, value }
 *   AC-23-001.2 missing           → { ok: false, reason: "missing" }
 *   AC-23-001.3 stale (seal ≠)    → { ok: false, reason: "stale" }
 *   AC-23-001.4 unparseable/corrupt → { ok: false, reason: "unparseable" } (fail loud, DR-078)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentSeal } from "../seal";
import { readStatsAggregate, readStatsPortada } from "../statsReader";
import { FIXTURE_SEAL, makePortada } from "./fixtures";

vi.mock("../seal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../seal")>();
  return { ...actual, currentSeal: vi.fn() };
});

const mockedCurrentSeal = vi.mocked(currentSeal);

let projectDir: string;

/** Create an isolated project dir with a `.pandacorp/` folder; return its absolute path. */
function makeProjectDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portada-"));
  fs.mkdirSync(path.join(dir, ".pandacorp"), { recursive: true });
  return dir;
}

/** Write raw text to `<projectDir>/.pandacorp/stats.json`. */
function writeStatsFile(dir: string, contents: string): void {
  fs.writeFileSync(path.join(dir, ".pandacorp", "stats.json"), contents, "utf-8");
}

beforeEach(() => {
  projectDir = makeProjectDir();
  mockedCurrentSeal.mockReset();
});

afterEach(() => {
  fs.rmSync(projectDir, { recursive: true, force: true });
});

describe("readStatsPortada — present, well-formed, seal matches (AC-23-001.1)", () => {
  it("returns { ok: true, value } and does not fall back", () => {
    writeStatsFile(projectDir, JSON.stringify(makePortada()));
    mockedCurrentSeal.mockReturnValue(FIXTURE_SEAL);

    const result = readStatsPortada(projectDir);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scalars.frds).toBe(23);
      expect(result.value.funnel.launched).toBe(1);
      expect(result.value.weeklyFlow.peakWeek).toBe(7);
    }
    expect(mockedCurrentSeal).toHaveBeenCalledWith(projectDir);
  });
});

describe("readStatsPortada — missing portada (AC-23-001.2)", () => {
  it("returns { ok: false, reason: 'missing' } — never a fabricated zero", () => {
    // No stats.json written.
    const result = readStatsPortada(projectDir);
    expect(result).toEqual({ ok: false, reason: "missing" });
  });
});

describe("readStatsPortada — stale seal mismatch (AC-23-001.3)", () => {
  it("returns { ok: false, reason: 'stale' } when the current seal differs", () => {
    writeStatsFile(projectDir, JSON.stringify(makePortada({ seal: "oldseal000" })));
    mockedCurrentSeal.mockReturnValue("newseal999");

    const result = readStatsPortada(projectDir);
    expect(result).toEqual({ ok: false, reason: "stale" });
  });

  it("treats a null current seal (git unavailable) as stale — never trusts an unvalidatable snapshot", () => {
    writeStatsFile(projectDir, JSON.stringify(makePortada()));
    mockedCurrentSeal.mockReturnValue(null);

    const result = readStatsPortada(projectDir);
    expect(result).toEqual({ ok: false, reason: "stale" });
  });
});

describe("readStatsPortada — unparseable/corrupt (AC-23-001.4, fail loud DR-078)", () => {
  it("returns { ok: false, reason: 'unparseable' } on malformed JSON", () => {
    writeStatsFile(projectDir, "{ this is: not json ]");
    mockedCurrentSeal.mockReturnValue(FIXTURE_SEAL);

    const result = readStatsPortada(projectDir);
    expect(result).toEqual({ ok: false, reason: "unparseable" });
  });

  it("returns { ok: false, reason: 'unparseable' } on a well-formed JSON of the wrong shape", () => {
    writeStatsFile(projectDir, JSON.stringify({ hello: "world", count: 3 }));
    mockedCurrentSeal.mockReturnValue(FIXTURE_SEAL);

    const result = readStatsPortada(projectDir);
    expect(result).toEqual({ ok: false, reason: "unparseable" });
  });

  it("never returns a silent [] / null — the corrupt branch is an explicit reason", () => {
    writeStatsFile(projectDir, JSON.stringify([1, 2, 3]));
    mockedCurrentSeal.mockReturnValue(FIXTURE_SEAL);

    const result = readStatsPortada(projectDir);
    expect(result.ok).toBe(false);
    // The reader never checks the seal for a corrupt file — corruption is decided first.
    expect(mockedCurrentSeal).not.toHaveBeenCalled();
  });
});

describe("readStatsAggregate — fail loud (AC-23-003.2)", () => {
  it("returns { ok: true, value } for a well-formed aggregate", () => {
    const aggPath = path.join(projectDir, "aggregate.json");
    fs.writeFileSync(
      aggPath,
      JSON.stringify({ projects: { alpha: makePortada(), beta: makePortada() } }),
      "utf-8",
    );

    const result = readStatsAggregate(aggPath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value.projects)).toEqual(["alpha", "beta"]);
    }
  });

  it("returns { ok: false, reason: 'missing' } when the aggregate is absent", () => {
    const result = readStatsAggregate(path.join(projectDir, "nope.json"));
    expect(result).toEqual({ ok: false, reason: "missing" });
  });

  it("returns { ok: false, reason: 'unparseable' } on a malformed aggregate — never a silent empty", () => {
    const aggPath = path.join(projectDir, "bad.json");
    fs.writeFileSync(aggPath, JSON.stringify({ projects: { alpha: { seal: "" } } }), "utf-8");

    const result = readStatsAggregate(aggPath);
    expect(result).toEqual({ ok: false, reason: "unparseable" });
  });
});
