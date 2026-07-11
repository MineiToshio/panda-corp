/**
 * WO-09-006 — Gamification ledger unit tests (RED phase)
 *
 * Tests for lib/gamification/ledger.ts:
 *   - readLedger: absent file → zero-totals, malformed → zero-totals (never throws)
 *   - mergeLedgerOutcomes: MAX(live, ledger) for each metric
 *   - needsSnapshot: false when live ≤ ledger; true when any live metric > ledger
 *
 * Traceability: AC-09-006.1, AC-09-006.2, AC-09-006.3
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GuildOutcomes } from "@/lib/gamification/gamification";
// Import the module under test — these will NOT resolve until GREEN
import {
  type GamificationLedger,
  mergeLedgerOutcomes,
  needsSnapshot,
  readLedger,
} from "@/lib/gamification/ledger";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Real production shape of factory/gamification-ledger.json (AC-09-006.3) */
const REAL_LEDGER: GamificationLedger = {
  version: 1,
  updatedAt: "2026-06-29T12:00:00Z",
  totals: {
    workOrdersDone: 42,
    phasesCompleted: 7,
    releases: 2,
  },
};

/** Minimum-shape ledger (cold-start variant — what the file looks like at first write) */
const ZERO_LEDGER: GamificationLedger = {
  version: 1,
  updatedAt: "2026-06-01T00:00:00Z",
  totals: {
    workOrdersDone: 0,
    phasesCompleted: 0,
    releases: 0,
  },
};

/** Zero-totals GuildOutcomes (cold start live state) */
const ZERO_OUTCOMES: GuildOutcomes = {
  workOrdersDone: 0,
  phasesCompleted: 0,
  releases: 0,
  greenTestRuns: 0,
  weeklyStreak: 0,
};

/** Non-trivial live outcomes */
const LIVE_OUTCOMES: GuildOutcomes = {
  workOrdersDone: 10,
  phasesCompleted: 3,
  releases: 1,
  greenTestRuns: 50,
  weeklyStreak: 2,
};

/** Ledger with lower values than LIVE_OUTCOMES (live has exceeded) */
const LOW_LEDGER: GamificationLedger = {
  version: 1,
  updatedAt: "2026-06-20T00:00:00Z",
  totals: {
    workOrdersDone: 5,
    phasesCompleted: 2,
    releases: 0,
  },
};

/** Ledger with higher values than LIVE_OUTCOMES (historical max) */
const HIGH_LEDGER: GamificationLedger = {
  version: 1,
  updatedAt: "2026-06-25T00:00:00Z",
  totals: {
    workOrdersDone: 100,
    phasesCompleted: 20,
    releases: 5,
  },
};

// ---------------------------------------------------------------------------
// Temp dir for file-based tests
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `ledger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// readLedger
// ---------------------------------------------------------------------------

describe("readLedger — absent file", () => {
  it("returns zero-totals when file does not exist (cold start)", () => {
    const result = readLedger(join(tmpDir, "nonexistent-ledger.json"));
    expect(result.totals.workOrdersDone).toBe(0);
    expect(result.totals.phasesCompleted).toBe(0);
    expect(result.totals.releases).toBe(0);
    expect(result.version).toBe(2);
  });

  it("returns zero-totals when default factory path does not exist", () => {
    // Called with no path argument — must not throw even if factory/gamification-ledger.json absent
    // (we set an env override to a nonexistent path to isolate)
    const result = readLedger(join(tmpDir, "no-factory-ledger.json"));
    expect(result.totals.workOrdersDone).toBe(0);
    expect(result.totals.phasesCompleted).toBe(0);
    expect(result.totals.releases).toBe(0);
  });
});

describe("readLedger — real fixture (production shape)", () => {
  it("reads and parses a well-formed ledger file correctly", () => {
    const ledgerPath = join(tmpDir, "gamification-ledger.json");
    writeFileSync(ledgerPath, JSON.stringify(REAL_LEDGER), "utf8");

    const result = readLedger(ledgerPath);
    expect(result.version).toBe(2);
    expect(result.migration.v1ImportedAt).toBeTruthy();
    expect(result.totals.workOrdersDone).toBe(42);
    expect(result.totals.phasesCompleted).toBe(7);
    expect(result.totals.releases).toBe(2);
  });

  it("reads a zero-totals (first write after cold start) ledger correctly", () => {
    const ledgerPath = join(tmpDir, "gamification-ledger.json");
    writeFileSync(ledgerPath, JSON.stringify(ZERO_LEDGER), "utf8");

    const result = readLedger(ledgerPath);
    expect(result.totals.workOrdersDone).toBe(0);
    expect(result.totals.phasesCompleted).toBe(0);
    expect(result.totals.releases).toBe(0);
  });
});

describe("readLedger — malformed file (negative ACs — DR-078 fail-loud)", () => {
  it("returns zero-totals (never throws) on empty file", () => {
    const ledgerPath = join(tmpDir, "gamification-ledger.json");
    writeFileSync(ledgerPath, "", "utf8");

    // Must NOT throw — AC-09-006.3: handles absence/malform gracefully
    expect(() => readLedger(ledgerPath)).not.toThrow();
    const result = readLedger(ledgerPath);
    expect(result.totals.workOrdersDone).toBe(0);
    expect(result.totals.phasesCompleted).toBe(0);
    expect(result.totals.releases).toBe(0);
  });

  it("returns zero-totals on non-JSON content (corrupted file)", () => {
    const ledgerPath = join(tmpDir, "gamification-ledger.json");
    writeFileSync(ledgerPath, "NOT JSON {{{{", "utf8");

    expect(() => readLedger(ledgerPath)).not.toThrow();
    const result = readLedger(ledgerPath);
    expect(result.totals.workOrdersDone).toBe(0);
  });

  it("returns zero-totals on JSON with wrong shape (missing totals)", () => {
    const ledgerPath = join(tmpDir, "gamification-ledger.json");
    writeFileSync(ledgerPath, JSON.stringify({ version: 1, updatedAt: "2026-01-01" }), "utf8");

    expect(() => readLedger(ledgerPath)).not.toThrow();
    const result = readLedger(ledgerPath);
    expect(result.totals.workOrdersDone).toBe(0);
    expect(result.totals.phasesCompleted).toBe(0);
    expect(result.totals.releases).toBe(0);
  });

  it("returns zero-totals on JSON with null totals field", () => {
    const ledgerPath = join(tmpDir, "gamification-ledger.json");
    writeFileSync(ledgerPath, JSON.stringify({ version: 1, updatedAt: "x", totals: null }), "utf8");

    expect(() => readLedger(ledgerPath)).not.toThrow();
    const result = readLedger(ledgerPath);
    expect(result.totals.workOrdersDone).toBe(0);
  });

  it("returns zero-totals on JSON array instead of object (wrong shape)", () => {
    const ledgerPath = join(tmpDir, "gamification-ledger.json");
    writeFileSync(ledgerPath, JSON.stringify([1, 2, 3]), "utf8");

    expect(() => readLedger(ledgerPath)).not.toThrow();
    const result = readLedger(ledgerPath);
    expect(result.totals.workOrdersDone).toBe(0);
  });

  it("returns zero-totals and never returns undefined/null", () => {
    const ledgerPath = join(tmpDir, "gamification-ledger.json");
    writeFileSync(ledgerPath, "null", "utf8");

    expect(() => readLedger(ledgerPath)).not.toThrow();
    const result = readLedger(ledgerPath);
    // DR-078: never silent null/undefined — always a typed result
    expect(result).toBeDefined();
    expect(result.totals).toBeDefined();
  });

  it("coerces non-numeric totals to 0 (partial shape)", () => {
    const ledgerPath = join(tmpDir, "gamification-ledger.json");
    writeFileSync(
      ledgerPath,
      JSON.stringify({
        version: 1,
        updatedAt: "2026-01-01",
        totals: { workOrdersDone: "not-a-number", phasesCompleted: null, releases: undefined },
      }),
      "utf8",
    );

    expect(() => readLedger(ledgerPath)).not.toThrow();
    const result = readLedger(ledgerPath);
    expect(result.totals.workOrdersDone).toBe(0);
    expect(result.totals.phasesCompleted).toBe(0);
    expect(result.totals.releases).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// mergeLedgerOutcomes — MAX(live, ledger)
// ---------------------------------------------------------------------------

describe("mergeLedgerOutcomes — MAX(live, ledger)", () => {
  it("returns live values when live > ledger on all metrics (AC-09-006.1)", () => {
    const merged = mergeLedgerOutcomes(LIVE_OUTCOMES, LOW_LEDGER);
    expect(merged.workOrdersDone).toBe(10); // live=10 > ledger=5
    expect(merged.phasesCompleted).toBe(3); // live=3  > ledger=2
    expect(merged.releases).toBe(1); // live=1  > ledger=0
  });

  it("returns ledger values when ledger > live on all metrics (core invariant — project deleted)", () => {
    // Simulates deleting a project: live drops, ledger stays at historical max
    const merged = mergeLedgerOutcomes(ZERO_OUTCOMES, HIGH_LEDGER);
    expect(merged.workOrdersDone).toBe(100); // ledger=100 > live=0
    expect(merged.phasesCompleted).toBe(20); // ledger=20  > live=0
    expect(merged.releases).toBe(5); // ledger=5   > live=0
  });

  it("returns MAX per-metric (some live higher, some ledger higher)", () => {
    const mixed: GuildOutcomes = {
      workOrdersDone: 200, // live > ledger (100)
      phasesCompleted: 1, // live < ledger (20)
      releases: 5, // live === ledger (5)
      greenTestRuns: 0,
      weeklyStreak: 0,
    };
    const merged = mergeLedgerOutcomes(mixed, HIGH_LEDGER);
    expect(merged.workOrdersDone).toBe(200); // MAX(200, 100) = 200
    expect(merged.phasesCompleted).toBe(20); // MAX(1, 20) = 20
    expect(merged.releases).toBe(5); // MAX(5, 5) = 5
  });

  it("preserves non-ledger fields (greenTestRuns, weeklyStreak) from live", () => {
    const merged = mergeLedgerOutcomes(LIVE_OUTCOMES, LOW_LEDGER);
    // greenTestRuns and weeklyStreak are not in the ledger — live values must survive
    expect(merged.greenTestRuns).toBe(50);
    expect(merged.weeklyStreak).toBe(2);
  });

  it("returns zero-state when both live and ledger are zero (honest zero, FRD-09)", () => {
    const merged = mergeLedgerOutcomes(ZERO_OUTCOMES, ZERO_LEDGER);
    expect(merged.workOrdersDone).toBe(0);
    expect(merged.phasesCompleted).toBe(0);
    expect(merged.releases).toBe(0);
  });

  it("is pure — same inputs always produce the same result", () => {
    const a = mergeLedgerOutcomes(LIVE_OUTCOMES, HIGH_LEDGER);
    const b = mergeLedgerOutcomes(LIVE_OUTCOMES, HIGH_LEDGER);
    expect(a).toEqual(b);
  });

  it("does not mutate the live outcomes input", () => {
    const original = { ...LIVE_OUTCOMES };
    mergeLedgerOutcomes(LIVE_OUTCOMES, HIGH_LEDGER);
    expect(LIVE_OUTCOMES).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// needsSnapshot
// ---------------------------------------------------------------------------

describe("needsSnapshot", () => {
  it("returns false when live equals ledger on all metrics", () => {
    const equalOutcomes: GuildOutcomes = {
      ...ZERO_OUTCOMES,
      workOrdersDone: HIGH_LEDGER.totals.workOrdersDone,
      phasesCompleted: HIGH_LEDGER.totals.phasesCompleted,
      releases: HIGH_LEDGER.totals.releases,
    };
    expect(needsSnapshot(equalOutcomes, HIGH_LEDGER)).toBe(false);
  });

  it("returns false when live < ledger on all metrics (no write needed)", () => {
    expect(needsSnapshot(ZERO_OUTCOMES, HIGH_LEDGER)).toBe(false);
  });

  it("returns true when workOrdersDone live > ledger", () => {
    const live: GuildOutcomes = {
      ...ZERO_OUTCOMES,
      workOrdersDone: HIGH_LEDGER.totals.workOrdersDone + 1,
    };
    expect(needsSnapshot(live, HIGH_LEDGER)).toBe(true);
  });

  it("returns true when phasesCompleted live > ledger", () => {
    const live: GuildOutcomes = {
      ...ZERO_OUTCOMES,
      phasesCompleted: HIGH_LEDGER.totals.phasesCompleted + 1,
    };
    expect(needsSnapshot(live, HIGH_LEDGER)).toBe(true);
  });

  it("returns true when releases live > ledger", () => {
    const live: GuildOutcomes = {
      ...ZERO_OUTCOMES,
      releases: HIGH_LEDGER.totals.releases + 1,
    };
    expect(needsSnapshot(live, HIGH_LEDGER)).toBe(true);
  });

  it("returns true even when only one metric exceeds ledger", () => {
    const live: GuildOutcomes = {
      workOrdersDone: LOW_LEDGER.totals.workOrdersDone + 1, // exceeds
      phasesCompleted: LOW_LEDGER.totals.phasesCompleted, // equal
      releases: LOW_LEDGER.totals.releases, // equal
      greenTestRuns: 0,
      weeklyStreak: 0,
    };
    expect(needsSnapshot(live, LOW_LEDGER)).toBe(true);
  });

  it("returns false when live is exactly zero and ledger is also zero", () => {
    expect(needsSnapshot(ZERO_OUTCOMES, ZERO_LEDGER)).toBe(false);
  });

  it("is pure — same inputs always produce the same result", () => {
    const a = needsSnapshot(LIVE_OUTCOMES, HIGH_LEDGER);
    const b = needsSnapshot(LIVE_OUTCOMES, HIGH_LEDGER);
    expect(a).toBe(b);
  });
});
