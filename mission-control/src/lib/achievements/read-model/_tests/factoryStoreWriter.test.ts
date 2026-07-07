/**
 * RED → GREEN tests for the single factory-store writer (FRD-23, WO-23-005, REQ-23-006.1/.3).
 *
 * Covers:
 *   AC-23-006.1 — factory-wide facts derived ONCE via the report cores + factory seal stamped;
 *                 NEVER incremental writes (the writer only unwraps the readers, no +1/-1 math).
 *   AC-23-006.3 — atomic write (tmp + rename); a mid-write crash never leaves a corrupt store.
 *   Equivalence — the materialized factory numbers EQUAL the live `derive*` cores' numbers.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lessonCounts } from "../../report/lessons";
import { phaseTransitions } from "../../report/phaseTransitions";
import { reportScalars } from "../../report/scalars";
import { currentFactorySeal } from "../factorySeal";
import { readStatsFactory } from "../factoryStoreReader";
import type { FactoryStamp, LiveFactoryValues } from "../factoryStoreWriter";
import {
  buildFactoryStore,
  FactoryDeriveError,
  writeFactoryStoreAtomic,
  writeStatsFactory,
} from "../factoryStoreWriter";
import { parseStatsFactory } from "../statsSchema";
import { FIXTURE_FACTORY_SEAL, makeFactoryStore } from "./fixtures";

const FIXTURE = makeFactoryStore();

function okValues(): LiveFactoryValues {
  return {
    phaseTransitions: { ok: true, value: [...FIXTURE.phaseTransitions] },
    scalars: FIXTURE.scalars,
    lessons: FIXTURE.lessons,
  };
}

const STAMP: FactoryStamp = {
  seal: FIXTURE_FACTORY_SEAL,
  generatedAt: "2026-07-06T12:00:00.000Z",
};

// ── buildFactoryStore — pure assembly (AC-23-006.1: unwrap, never re-derive) ──────
describe("buildFactoryStore — assembles from live values, never re-derives (AC-23-006.1)", () => {
  it("materializes the live numbers verbatim + stamps the factory seal", () => {
    const store = buildFactoryStore(okValues(), STAMP);
    expect(store.seal).toBe(FIXTURE_FACTORY_SEAL);
    expect(store.generatedAt).toBe("2026-07-06T12:00:00.000Z");
    expect(store.phaseTransitions).toEqual(FIXTURE.phaseTransitions);
    expect(store.scalars).toEqual(FIXTURE.scalars);
    expect(store.lessons).toEqual(FIXTURE.lessons);
  });

  it("produces a store that satisfies the fail-loud parser (round-trips)", () => {
    const store = buildFactoryStore(okValues(), STAMP);
    const round = parseStatsFactory(JSON.parse(JSON.stringify(store)));
    expect(round).toEqual(store);
  });

  it("accepts a null lessons ('no cableado') without fabricating a count", () => {
    const store = buildFactoryStore({ ...okValues(), lessons: null }, STAMP);
    expect(store.lessons).toBeNull();
  });

  it("fails loud when phaseTransitions could not be derived (DR-078)", () => {
    const values: LiveFactoryValues = {
      ...okValues(),
      phaseTransitions: { ok: false, reason: "git-unavailable" },
    };
    expect(() => buildFactoryStore(values, STAMP)).toThrow(FactoryDeriveError);
  });

  it("fails loud on an empty seal (never stamps a blank factory seal)", () => {
    expect(() => buildFactoryStore(okValues(), { ...STAMP, seal: "" })).toThrow(FactoryDeriveError);
  });
});

// ── writeFactoryStoreAtomic — atomic write (AC-23-006.3) ──────────────────────────
describe("writeFactoryStoreAtomic — atomic tmp + rename (AC-23-006.3)", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "factory-writer-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("writes a valid, parseable stats-factory.json", () => {
    const target = path.join(dir, ".pandacorp", "stats-factory.json");
    writeFactoryStoreAtomic(target, FIXTURE);
    const raw = fs.readFileSync(target, "utf-8");
    expect(parseStatsFactory(JSON.parse(raw))).toEqual(FIXTURE);
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("leaves the previous file intact if the rename step throws mid-write", () => {
    const target = path.join(dir, ".pandacorp", "stats-factory.json");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const previous = makeFactoryStore({ seal: "0".repeat(40) });
    fs.writeFileSync(target, `${JSON.stringify(previous, null, 2)}\n`, "utf-8");

    vi.spyOn(fs, "renameSync").mockImplementationOnce(() => {
      throw new Error("simulated crash before rename");
    });

    expect(() => writeFactoryStoreAtomic(target, FIXTURE)).toThrow("simulated crash");

    // The reader must still see the WHOLE previous file — never a half-written corrupt one.
    expect(parseStatsFactory(JSON.parse(fs.readFileSync(target, "utf-8")))).toEqual(previous);
    // No temp litter left behind (cleanup on failure).
    const leftovers = fs.readdirSync(path.dirname(target)).filter((f) => f.includes(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("never leaves a readable partial file: the target is only ever whole", () => {
    const target = path.join(dir, ".pandacorp", "stats-factory.json");
    vi.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
      throw new Error("disk full mid-write");
    });
    expect(() => writeFactoryStoreAtomic(target, FIXTURE)).toThrow("disk full");
    expect(fs.existsSync(target)).toBe(false);
  });
});

// ── writeStatsFactory — end-to-end single writer against the real MC repo ─────────
describe("writeStatsFactory — single writer, seal stamped, atomic (AC-23-006.1/.3)", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "factory-e2e-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("fails loud (writes nothing) when git is unavailable (null seal, DR-078)", () => {
    expect(() => writeStatsFactory(dir)).toThrow(FactoryDeriveError);
    expect(fs.existsSync(path.join(dir, ".pandacorp", "stats-factory.json"))).toBe(false);
  });

  it("writes a fresh, seal-matching store the reader accepts (real factory repo)", () => {
    // The factory root of the running MC (one level up) is a real git work-tree.
    const factoryRoot = path.resolve(process.cwd(), "..");
    const seal = currentFactorySeal(factoryRoot);
    expect(seal).not.toBeNull();
    if (seal === null) return;

    const written = writeStatsFactory(factoryRoot, () => new Date("2026-07-06T00:00:00.000Z"));
    expect(written).toBe(path.join(factoryRoot, ".pandacorp", "stats-factory.json"));

    const result = readStatsFactory(factoryRoot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.seal).toBe(seal);
    }

    // Restore: remove the file we wrote so the working tree is left clean for the gate.
    fs.rmSync(written, { force: true });
  });
});

// ── Equivalence: materialized == live derive* cores ──────────────────────────────
describe("factory-store-vs-live equivalence", () => {
  it("materialized factory numbers equal the live report cores' numbers", () => {
    const factoryRoot = path.resolve(process.cwd(), "..");

    const liveTransitions = phaseTransitions();
    const liveScalars = reportScalars(factoryRoot);
    const liveLessons = lessonCounts();

    if (!liveTransitions.ok) return; // git-unavailable → the writer's fail-loud path covers it

    const seal = currentFactorySeal(factoryRoot);
    if (seal === null) return;

    const written = writeStatsFactory(factoryRoot, () => new Date("2026-07-06T00:00:00.000Z"));
    const materialized = parseStatsFactory(JSON.parse(fs.readFileSync(written, "utf-8")));
    fs.rmSync(written, { force: true });

    expect(materialized).not.toBeNull();
    if (materialized === null) return;

    expect(materialized.phaseTransitions).toEqual(liveTransitions.value);
    expect(materialized.scalars).toEqual({
      projects: liveScalars.projects,
      decisions: liveScalars.decisions,
    });
    expect(materialized.lessons).toEqual(liveLessons);
  });
});
