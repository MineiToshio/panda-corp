/**
 * RED → GREEN tests for the freshness seal (FRD-23, WO-23-001).
 *
 * `isFresh` is a pure equality check (seals are commit hashes, not orderable timestamps);
 * `currentSeal` returns `null` when git is unavailable (never a fabricated seal).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { currentSeal, isFresh } from "../seal";
import { parseStatsPortada } from "../statsSchema";
import { makePortada } from "./fixtures";

const parsed = parseStatsPortada(makePortada({ seal: "seal-abc" }));
if (parsed === null) throw new Error("fixture portada must parse");
const portada = parsed;

describe("isFresh", () => {
  it("is true when the portada seal equals the current seal", () => {
    expect(isFresh(portada, "seal-abc")).toBe(true);
  });

  it("is false when the seal mismatches", () => {
    expect(isFresh(portada, "seal-xyz")).toBe(false);
  });

  it("is false when the current seal is null (git unavailable) — never trust an unvalidatable snapshot", () => {
    expect(isFresh(portada, null)).toBe(false);
  });
});

describe("currentSeal", () => {
  let dir: string;

  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns null in a non-git directory (git unavailable) — never a fabricated seal", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "no-git-"));
    expect(currentSeal(dir)).toBeNull();
  });
});
