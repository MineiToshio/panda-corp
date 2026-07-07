/**
 * RED → GREEN tests for the fail-loud factory store reader (FRD-23, WO-23-005, REQ-23-006.3).
 *
 * Fail-loud (DR-078): every read returns a discriminated result — never a silent empty. Covers the
 * four EARS branches on REAL on-disk fixtures with a mocked `currentFactorySeal`:
 *   present + fresh (seal matches)   → { ok: true, value }
 *   missing (no file)                → { ok: false, reason: "missing" }
 *   stale (seal mismatch / git down) → { ok: false, reason: "stale" }
 *   malformed JSON / wrong shape     → { ok: false, reason: "unparseable" }
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readStatsFactory } from "../factoryStoreReader";
import { FIXTURE_FACTORY_SEAL, makeFactoryStore } from "./fixtures";

// The seal read is mocked so the on-disk fixture's freshness is deterministic (no real git needed).
const sealMock = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("../factorySeal", async () => {
  const actual = await vi.importActual<typeof import("../factorySeal")>("../factorySeal");
  return {
    ...actual,
    currentFactorySeal: (): string | null => sealMock.value,
  };
});

let factoryRoot: string;

function writeStore(content: string): void {
  const dir = path.join(factoryRoot, ".pandacorp");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "stats-factory.json"), content, "utf-8");
}

beforeEach(() => {
  factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "factory-reader-"));
  sealMock.value = null;
});

afterEach(() => {
  fs.rmSync(factoryRoot, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("readStatsFactory — present + fresh (AC-23-006.1)", () => {
  it("returns { ok: true, value } when the store is well-formed and its seal matches", () => {
    writeStore(`${JSON.stringify(makeFactoryStore(), null, 2)}\n`);
    sealMock.value = FIXTURE_FACTORY_SEAL;

    const result = readStatsFactory(factoryRoot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scalars).toEqual({ projects: 4, decisions: 118 });
      expect(result.value.phaseTransitions).toHaveLength(1);
      expect(result.value.lessons).toEqual({ distilled: 92, captured: 40 });
    }
  });
});

describe("readStatsFactory — fail loud, never a silent empty (AC-23-006.3)", () => {
  it("returns { ok: false, reason: 'missing' } when the store does not exist", () => {
    const result = readStatsFactory(factoryRoot);
    expect(result).toEqual({ ok: false, reason: "missing" });
  });

  it("returns { ok: false, reason: 'stale' } when the seal mismatches", () => {
    writeStore(`${JSON.stringify(makeFactoryStore(), null, 2)}\n`);
    sealMock.value = "0000000000000000000000000000000000000000";
    expect(readStatsFactory(factoryRoot)).toEqual({ ok: false, reason: "stale" });
  });

  it("returns { ok: false, reason: 'stale' } when git is unavailable (null seal)", () => {
    writeStore(`${JSON.stringify(makeFactoryStore(), null, 2)}\n`);
    sealMock.value = null;
    expect(readStatsFactory(factoryRoot)).toEqual({ ok: false, reason: "stale" });
  });

  it("returns { ok: false, reason: 'unparseable' } on malformed JSON", () => {
    writeStore("{ not json ]");
    sealMock.value = FIXTURE_FACTORY_SEAL;
    expect(readStatsFactory(factoryRoot)).toEqual({ ok: false, reason: "unparseable" });
  });

  it("returns { ok: false, reason: 'unparseable' } on a well-formed JSON of the wrong shape", () => {
    writeStore(JSON.stringify({ seal: "x", phaseTransitions: "not-an-array" }));
    sealMock.value = FIXTURE_FACTORY_SEAL;
    expect(readStatsFactory(factoryRoot)).toEqual({ ok: false, reason: "unparseable" });
  });

  it("returns { ok: false, reason: 'unparseable' } on an array (never a silent [])", () => {
    writeStore("[]");
    sealMock.value = FIXTURE_FACTORY_SEAL;
    expect(readStatsFactory(factoryRoot)).toEqual({ ok: false, reason: "unparseable" });
  });
});
