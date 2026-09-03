/**
 * WO-24-002 — Golden-vector regression suite (library <-> CLI agreement)
 *
 * FRD-24, REQ-24-002. A committed fixture (`fixtures/decisions-golden.md`) plus a committed
 * `EXPECTED_IDS` array proving `parseDecisionBlocks` (the library function, REQ-24-001) and
 * `decision-id-cli.mjs` (the CLI, spawned as a real subprocess, AC-24-001.2) produce the exact
 * same ordered id list for it — and that list matches `EXPECTED_IDS`. This is a real regression
 * gate (AC-24-002.2): if the derivation rule changes without this fixture/array being updated in
 * the same change, one of the three equality checks below goes RED.
 *
 * Traceability:
 *   AC-24-002.1 — both call paths, run against decisions-golden.md, produce the same ordered id
 *                 list, and that list equals the committed EXPECTED_IDS.
 *   AC-24-002.2 — the two-path comparison is exercised on every gate run (two independent
 *                 equality checks against the same golden array, never one derived from the
 *                 other) plus a CLI-boundary loud-failure case (nonexistent path).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDecisionBlocks } from "../activity";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const CLI_PATH = path.join(REPO_ROOT, "scripts", "decisions", "decision-id-cli.mjs");
const LOADER_PATH = path.join(REPO_ROOT, "scripts", "read-model", "ts-loader.mjs");
const FIXTURE_PATH = path.join(__dirname, "fixtures", "decisions-golden.md");

/**
 * The golden vector: the exact ordered id list both call paths MUST produce for
 * `fixtures/decisions-golden.md`. Committed on purpose (AC-24-002.1) — if the derivation rule
 * ever changes, this array must be updated in the SAME change, or this suite goes RED.
 *
 * The fixture exercises, in file order:
 *   1. "2026-08-01-1" — first dated heading, pending (NECESITA DECISIÓN DEL OWNER).
 *   2. "2026-08-01-2" — second dated heading sharing the EXACT SAME date, resolved (Estado:
 *      RESUELTO). Proves the per-date counter is shared across pending+resolved blocks.
 *   3. "legacy-1"      — legacy "## OPEN:" heading (no date).
 *   4. "legacy-2"      — legacy "## CLOSED:" heading.
 *   5. "legacy-3"      — legacy "## RESOLVED:" heading. Proves the legacy counter is
 *      independent of the per-date counters and counts across all three legacy keywords.
 *   6. "2026-08-15-1"  — a later dated heading, resolved, own distinct date.
 *   7. "2026-08-20-1"  — a final dated heading, obsolete (SUPERSEDIDO) — still counted.
 */
const EXPECTED_IDS: string[] = [
  "2026-08-01-1",
  "2026-08-01-2",
  "legacy-1",
  "legacy-2",
  "legacy-3",
  "2026-08-15-1",
  "2026-08-20-1",
];

describe("frd-24: decision-id golden vectors — AC-24-002.1/AC-24-002.2", () => {
  it("frd-24: AC-24-002.1 — the fixture exists on disk", () => {
    expect(fs.existsSync(FIXTURE_PATH)).toBe(true);
  });

  it("frd-24: AC-24-002.1 — the library function (parseDecisionBlocks) produces EXPECTED_IDS", () => {
    const content = fs.readFileSync(FIXTURE_PATH, "utf-8");
    const ids = parseDecisionBlocks(content).map((d) => d.id);
    expect(ids).toEqual(EXPECTED_IDS);
  });

  it("frd-24: AC-24-002.1 — the CLI subprocess produces EXPECTED_IDS", () => {
    const stdout = execFileSync("node", ["--loader", LOADER_PATH, CLI_PATH, FIXTURE_PATH], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    const printedIds = stdout.split("\n").filter((line) => line.length > 0);
    expect(printedIds).toEqual(EXPECTED_IDS);
  });

  it("frd-24: AC-24-002.1/AC-24-002.2 — the library and the CLI agree with each other (not just individually with EXPECTED_IDS)", () => {
    const content = fs.readFileSync(FIXTURE_PATH, "utf-8");
    const viaLibrary = parseDecisionBlocks(content).map((d) => d.id);

    const stdout = execFileSync("node", ["--loader", LOADER_PATH, CLI_PATH, FIXTURE_PATH], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    const viaCli = stdout.split("\n").filter((line) => line.length > 0);

    // Two independent equality checks against the SAME golden array (AC-24-002.2) — never
    // one path's output asserted equal to the other's and stopping there.
    expect(viaLibrary).toEqual(EXPECTED_IDS);
    expect(viaCli).toEqual(EXPECTED_IDS);
    expect(viaLibrary).toEqual(viaCli);
  });

  it("frd-24: CLI boundary — a nonexistent path exits non-zero and writes to stderr, never a silent empty stdout", () => {
    const missingPath = path.join(
      REPO_ROOT,
      "src",
      "lib",
      "docs",
      "_tests",
      "fixtures",
      "decisions-golden-DOES-NOT-EXIST.md",
    );
    expect(fs.existsSync(missingPath)).toBe(false);

    let threw = false;
    try {
      execFileSync("node", ["--loader", LOADER_PATH, CLI_PATH, missingPath], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      threw = true;
      const err = error as { status: number | null; stdout: string; stderr: string };
      expect(err.status).not.toBe(0);
      expect(err.stderr.trim().length).toBeGreaterThan(0);
      // Loud failure, not a silent empty success (DR-078): stdout carries no fabricated ids.
      expect(err.stdout.trim()).toBe("");
    }
    expect(threw).toBe(true);
  });
});
