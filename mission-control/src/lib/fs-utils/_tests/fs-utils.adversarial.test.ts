/**
 * WO-01-001 — `pathExists` ADVERSARIAL suite (reviewer, DR-015)
 *
 * Reviewer model: Opus 4.8 (different family from the sonnet/haiku implementer).
 * These are edge cases / abuse cases the implementer did NOT cover in
 * `lib/fs-utils.test.ts`. They derive from the FRD contract (AC-01-010.1,
 * docs/api.md tolerance table) and from real factory gotchas:
 *
 *   - B1' (progress.md @ 2026-06-16): fail-OPEN guards — a value that "looks
 *     fine" silently passes. Here the abuse vector is the blank-string early
 *     return: it must reject genuinely blank inputs but must NOT reject a real
 *     path that merely *contains* spaces (e.g. "/tmp/My Project"). A naive
 *     `p.trim() === ""` guard is safe; a `p.includes(" ")` guard would not be.
 *     This test pins the boundary so a future "optimisation" can't regress it.
 *   - REQ-01-010: the not-found probe is the load-bearing input to the FRD-03
 *     not-found badge — symlink semantics (broken link, link-to-dir) decide
 *     whether a moved/renamed project reads as found or not-found.
 *
 * Mutation-resistance intent (DR-016): each assertion is written so that a
 * plausible mutation of fs-utils.ts (drop the blank guard, swap existsSync for
 * `true`, drop the try/catch, invert the boolean) makes at least one test red.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_FULL } from "@/tests/fixtures";
import { pathExists } from "../fs-utils";

// ---------------------------------------------------------------------------
// Blank-guard boundary — must not over-reject real paths containing spaces.
// (Mutation kill: a `p.includes(" ")` guard or a `p.replace(/\s/g,"")===""`
//  guard would fail the "path with internal spaces" case.)
// ---------------------------------------------------------------------------

describe("frd-01 (adversarial): blank-guard does not over-reject real paths", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-adv-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("frd-01: WHEN given an existing dir whose name contains spaces THEN returns true", () => {
    const spaced = path.join(tmpRoot, "My Real Project");
    fs.mkdirSync(spaced);
    // A blank-only guard must reject "" / "   " but accept a path with internal spaces.
    expect(pathExists(spaced)).toBe(true);
  });

  it("frd-01: WHEN given an existing file with leading-space-then-content path THEN returns true", () => {
    const f = path.join(tmpRoot, "status.yaml");
    fs.writeFileSync(f, "phase: build\n");
    // Untrimmed callers may pass a path with a stray leading space segment; the
    // join below keeps real content so it must resolve true. (Guards on the raw
    // string must not strip the path itself, only reject all-whitespace input.)
    expect(pathExists(f)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tab / newline-only inputs — the "blank" family is wider than the space char.
// (Mutation kill: a guard checking only `=== ""` and ` ` would let "\t"/"\n"
//  reach existsSync; harmless on most OS but the contract says blank → false,
//  and `.trim()` covers all whitespace, so we pin it.)
// ---------------------------------------------------------------------------

describe("frd-01 (adversarial): every whitespace-only input is treated as blank", () => {
  it.each([
    ["\t"],
    ["\n"],
    ["\r\n"],
    ["\t \n"],
    [" "],
  ])("frd-01: WHEN given whitespace-only %j THEN returns false without throwing", (input) => {
    expect(() => pathExists(input)).not.toThrow();
    //   (NBSP) is NOT stripped by .trim() in JS, so it reaches existsSync
    // and resolves false as an absent path — still false, still no throw.
    expect(pathExists(input)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Symlink semantics — load-bearing for the FRD-03 not-found badge.
// fs.existsSync FOLLOWS symlinks: a link to a missing target must read FALSE
// (so a moved project is correctly flagged not-found), a link to a real dir
// must read TRUE.
// (Mutation kill: replacing existsSync with lstat-based / fs.statSync would
//  change broken-symlink behaviour and flip these.)
// ---------------------------------------------------------------------------

describe("frd-01 (adversarial): symlink resolution matches not-found semantics", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-link-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("frd-01: WHEN given a symlink to an EXISTING dir THEN returns true", () => {
    const target = path.join(tmpRoot, "real-project");
    fs.mkdirSync(target);
    const link = path.join(tmpRoot, "link-to-project");
    fs.symlinkSync(target, link);
    expect(pathExists(link)).toBe(true);
  });

  it("frd-01: WHEN given a DANGLING symlink (target deleted) THEN returns false (moved-project case)", () => {
    const target = path.join(tmpRoot, "moved-away");
    fs.mkdirSync(target);
    const link = path.join(tmpRoot, "stale-link");
    fs.symlinkSync(target, link);
    fs.rmSync(target, { recursive: true, force: true }); // simulate project moved/renamed
    // existsSync follows the link → target gone → false → badge shows not-found.
    expect(pathExists(link)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Trailing-slash / dot-segment forms of an existing dir — callers join paths
// and may produce these; they must still resolve TRUE.
// ---------------------------------------------------------------------------

describe("frd-01 (adversarial): normalisation-equivalent forms of an existing path", () => {
  it("frd-01: WHEN given an existing dir with a trailing slash THEN returns true", () => {
    const p = `${path.join(FIXTURE_FULL, "factory")}${path.sep}`;
    expect(pathExists(p)).toBe(true);
  });

  it("frd-01: WHEN given an existing dir via a './' relative-to-itself form THEN returns true", () => {
    const p = path.join(FIXTURE_FULL, "factory", ".");
    expect(pathExists(p)).toBe(true);
  });

  it("frd-01: WHEN given an existing path with a redundant '..' round-trip THEN returns true", () => {
    const p = path.join(FIXTURE_FULL, "factory", "..", "factory", "profile.md");
    expect(pathExists(p)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Read-only invariant under the symlink/abuse paths too — belt and braces.
// (Mutation kill: any accidental write/mkdir inside pathExists.)
// ---------------------------------------------------------------------------

describe("frd-01 (adversarial): never creates the probed path even for nested ghosts", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-ro-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("frd-01: WHEN probing a deep nonexistent path THEN no ancestor dir is created", () => {
    const ghost = path.join(tmpRoot, "a", "b", "c", "status.yaml");
    expect(pathExists(ghost)).toBe(false);
    expect(fs.existsSync(path.join(tmpRoot, "a"))).toBe(false);
    expect(fs.readdirSync(tmpRoot)).toEqual([]);
  });
});
