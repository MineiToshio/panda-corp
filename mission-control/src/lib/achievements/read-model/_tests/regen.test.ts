/**
 * RED → GREEN tests for the universal regeneration trigger (FRD-23, WO-23-004, REQ-23-002/004).
 *
 * The Informe mixes sources from many skills, so its write cannot depend on `/implement` closing —
 * every change that affects the Informe ends in a COMMIT, so the commit is the universal trigger
 * (Stop hook / git post-commit). `regenerateForCommit` is the entry point those hooks call: it
 * regenerates the affected project's portada and, when the seal genuinely could not be derived,
 * DEGRADES honestly (the reader's live-git fallback covers the gap) instead of aborting the commit.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { regenerateForCommit } from "../regen";
import { readStatsPortada } from "../statsReader";
import { PortadaDeriveError } from "../statsWriter";

describe("regenerateForCommit — the universal (commit) write point", () => {
  it("regenerates the affected project's portada and reports the written path", () => {
    let called = "";
    const outcome = regenerateForCommit("/p/one", {
      writePortada: (projectPath) => {
        called = projectPath;
        return path.join(projectPath, ".pandacorp", "stats.json");
      },
    });

    expect(called).toBe("/p/one");
    expect(outcome).toEqual({ ok: true, written: "/p/one/.pandacorp/stats.json" });
  });

  it("degrades honestly (never throws) when the portada could not be derived — the hook must not break the commit", () => {
    const outcome = regenerateForCommit("/p/nogit", {
      writePortada: () => {
        throw new PortadaDeriveError("git unavailable");
      },
    });

    // The reader's live-git fallback covers the gap; the commit is never aborted.
    expect(outcome).toEqual({ ok: false, reason: "git unavailable" });
  });

  it("re-throws a genuinely unexpected error (not a derive failure) — never swallowed", () => {
    expect(() =>
      regenerateForCommit("/p/boom", {
        writePortada: () => {
          throw new Error("permission denied");
        },
      }),
    ).toThrow("permission denied");
  });
});

describe("regenerateForCommit — end-to-end against the real MC repo", () => {
  const written: string[] = [];

  afterEach(() => {
    for (const f of written.splice(0)) {
      fs.rmSync(f, { force: true });
    }
  });

  it("writes a fresh portada the reader accepts (the same the writer produces)", () => {
    const projectPath = process.cwd();
    const outcome = regenerateForCommit(projectPath);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      written.push(outcome.written);
      expect(outcome.written).toBe(path.join(projectPath, ".pandacorp", "stats.json"));
      expect(readStatsPortada(projectPath).ok).toBe(true);
    }
  });
});
