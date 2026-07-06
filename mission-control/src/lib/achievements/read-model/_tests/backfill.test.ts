/**
 * RED → GREEN tests for the one-shot backfill (FRD-23, WO-23-004, REQ-23-004).
 *
 * Covers:
 *   AC-23-004.1 — a one-shot backfill walks git ONCE per existing project and generates its initial
 *                 portada + seal, equivalent to what the live reader would produce. Modeled with an
 *                 injected `writePortada` so the walk logic is unit-tested without git I/O, plus a
 *                 real end-to-end write against the MC repo (the same equivalence the writer proves).
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBackfill } from "../backfill";
import { readStatsPortada } from "../statsReader";
import { PortadaDeriveError } from "../statsWriter";

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

describe("runBackfill — end-to-end against the real MC repo (equivalent to the live reader)", () => {
  const written: string[] = [];

  afterEach(() => {
    for (const f of written.splice(0)) {
      fs.rmSync(f, { force: true });
    }
  });

  it("generates a portada the fail-loud reader reads back as fresh (seal equivalence)", () => {
    const projectPath = process.cwd();
    const summary = runBackfill([projectPath]);
    written.push(...summary.written);

    // The backfilled portada is exactly what the live reader would accept for this project.
    expect(summary.written).toEqual([path.join(projectPath, ".pandacorp", "stats.json")]);
    const result = readStatsPortada(projectPath);
    expect(result.ok).toBe(true);
  });
});
