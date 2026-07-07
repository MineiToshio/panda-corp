/**
 * RED → GREEN tests for the one-shot backfill (FRD-23, WO-23-004, REQ-23-004).
 *
 * Covers:
 *   AC-23-004.1 — a one-shot backfill walks git ONCE per existing project and generates its initial
 *                 portada + seal, equivalent to what the live reader would produce. Modeled with an
 *                 injected `writePortada` so the walk logic is unit-tested without git I/O, plus a
 *                 real end-to-end write against a synthetic factory git fixture (gitFixture.ts —
 *                 never the real `.pandacorp/`; the same equivalence the writer proves).
 */

import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withFactoryRoot } from "../../../../tests/fixtures/index";
import { runBackfill } from "../backfill";
import { readStatsPortada } from "../statsReader";
import { PortadaDeriveError } from "../statsWriter";
import { makeSyntheticFactoryRepo, type SyntheticFactoryRepo } from "./gitFixture";

describe("runBackfill — one portada write per existing project (AC-23-004.1)", () => {
  it("calls the writer exactly once per project (walks git once each)", () => {
    const calls: string[] = [];
    const summary = runBackfill(["/p/one", "/p/two", "/p/three"], {
      writePortada: (projectPath) => {
        calls.push(projectPath);
        return path.join(projectPath, ".pandacorp", "stats.json");
      },
    });

    expect(calls).toEqual(["/p/one", "/p/two", "/p/three"]);
    expect(summary.written).toEqual([
      "/p/one/.pandacorp/stats.json",
      "/p/two/.pandacorp/stats.json",
      "/p/three/.pandacorp/stats.json",
    ]);
    expect(summary.skipped).toEqual([]);
  });

  it("skips (never aborts) a project whose portada could not be derived (fail-loud, DR-078)", () => {
    const summary = runBackfill(["/p/ok", "/p/nogit", "/p/ok2"], {
      writePortada: (projectPath) => {
        if (projectPath === "/p/nogit") {
          throw new PortadaDeriveError("git unavailable");
        }
        return path.join(projectPath, ".pandacorp", "stats.json");
      },
    });

    // The good projects are still backfilled; the un-derivable one is reported, not fatal.
    expect(summary.written).toEqual([
      "/p/ok/.pandacorp/stats.json",
      "/p/ok2/.pandacorp/stats.json",
    ]);
    expect(summary.skipped).toEqual([{ projectPath: "/p/nogit", reason: "git unavailable" }]);
  });

  it("re-throws a genuinely unexpected error (not a derive failure) — never swallowed", () => {
    expect(() =>
      runBackfill(["/p/boom"], {
        writePortada: () => {
          throw new Error("disk exploded");
        },
      }),
    ).toThrow("disk exploded");
  });

  it("an empty project list is a valid no-op (explicit empty summary, not an error)", () => {
    const summary = runBackfill([], { writePortada: () => "unused" });
    expect(summary).toEqual({ written: [], skipped: [] });
  });
});

// Runs against a SYNTHETIC factory git fixture (gitFixture.ts) — never the real .pandacorp/:
// the previous version wrote and then deleted the REAL `mission-control/.pandacorp/stats.json` on
// every gate run, destroying the owner's live FRD-23 materialization (defective test, repaired
// 2026-07-07). Real git is still exercised end-to-end — inside the temp fixture repo.
describe("runBackfill — end-to-end against a synthetic git fixture (equivalent to the live reader)", () => {
  let fixture: SyntheticFactoryRepo;

  beforeAll(() => {
    fixture = makeSyntheticFactoryRepo();
  });

  afterAll(() => {
    fixture.cleanup();
  });

  it("generates a portada the fail-loud reader reads back as fresh (seal equivalence)", async () => {
    await withFactoryRoot(fixture.factoryRoot, () => {
      const projectPath = fixture.projectPath;
      const summary = runBackfill([projectPath]);

      // The backfilled portada is exactly what the live reader would accept for this project.
      expect(summary.written).toEqual([path.join(projectPath, ".pandacorp", "stats.json")]);
      expect(summary.skipped).toEqual([]);
      const result = readStatsPortada(projectPath);
      expect(result.ok).toBe(true);
    });
  });
});
