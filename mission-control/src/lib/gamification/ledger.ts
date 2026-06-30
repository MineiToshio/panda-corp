/**
 * lib/gamification/ledger.ts — Persistent XP accumulator (WO-09-006, AC-09-006.1–3)
 *
 * The gamification ledger records the MAXIMUM guild outcomes ever seen so that
 * deleting a project NEVER decreases the guild's XP or level.
 *
 * Design: pure read + merge functions (no I/O side effects). The Server Action
 * (`app/_actions/snapshotLedger.ts`) owns the write path.
 *
 * File location: `factory/gamification-ledger.json` (gitignored, DR-033 personal data).
 * Default path resolved via `resolveFactoryRoot()` from `lib/config/config.ts`.
 *
 * Traceability:
 *   AC-09-006.1 — mergeLedgerOutcomes returns MAX(live, ledger) per metric
 *   AC-09-006.2 — needsSnapshot detects when live > ledger (triggers the write)
 *   AC-09-006.3 — readLedger handles absence/malform gracefully (never throws)
 *
 * DR-078: readLedger NEVER returns silent null/undefined — it always returns a typed
 * zero-totals ledger on any failure, and the caller can always consume it safely.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveFactoryRoot } from "@/lib/config/config";
import type { GuildOutcomes } from "./gamification";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The shape of `factory/gamification-ledger.json`.
 *
 * `totals` records the historical maximum for each XP-bearing metric.
 * `greenTestRuns` and `weeklyStreak` are NOT persisted (ephemeral signals).
 */
export type GamificationLedger = {
  /** Schema version — always 1 for this initial schema. */
  readonly version: 1;
  /** ISO-8601 timestamp of the last write. */
  readonly updatedAt: string;
  /** Historical maximum for each ledgered metric. */
  readonly totals: {
    readonly workOrdersDone: number;
    readonly phasesCompleted: number;
    readonly releases: number;
  };
};

// ---------------------------------------------------------------------------
// Zero-value sentinel (cold start / parse failure)
// ---------------------------------------------------------------------------

/** Returns a zero-totals ledger (cold start — no XP lost, no XP inflated). */
function zeroLedger(): GamificationLedger {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    totals: {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// readLedger — DR-078 compliant: never throws, never returns null
// ---------------------------------------------------------------------------

/**
 * Read `factory/gamification-ledger.json` from `ledgerPath` (or the default
 * factory path if omitted) and return a typed `GamificationLedger`.
 *
 * Failure modes handled gracefully (DR-078 — never throws, never returns null):
 *   - File absent → zero-totals (cold start; live data is the floor)
 *   - File empty / non-JSON / wrong shape → zero-totals
 *   - Any individual field missing or wrong type → coerced to 0
 *
 * @param ledgerPath  Absolute path to the ledger file. Defaults to
 *                    `<factoryRoot>/factory/gamification-ledger.json`.
 */
export function readLedger(
  ledgerPath: string = join(resolveFactoryRoot(), "factory", "gamification-ledger.json"),
): GamificationLedger {
  let raw: string;
  try {
    raw = readFileSync(ledgerPath, "utf8");
  } catch {
    // File does not exist — cold start
    return zeroLedger();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupted / empty file — treat as cold start
    return zeroLedger();
  }

  return _coerceLedger(parsed);
}

/**
 * Coerce an unknown parsed value into a `GamificationLedger`, defaulting every
 * field that is missing or wrong-typed to a safe zero.
 *
 * Never throws — all validation is coercive (wrong type → 0 or fallback string).
 */
function _coerceLedger(raw: unknown): GamificationLedger {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return zeroLedger();
  }

  const obj = raw as Record<string, unknown>;
  const totalsRaw = obj.totals;

  // totals must be a non-null, non-array object
  if (totalsRaw === null || typeof totalsRaw !== "object" || Array.isArray(totalsRaw)) {
    return zeroLedger();
  }

  const t = totalsRaw as Record<string, unknown>;

  return {
    version: 1,
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : new Date(0).toISOString(),
    totals: {
      workOrdersDone: _safeNat(t.workOrdersDone),
      phasesCompleted: _safeNat(t.phasesCompleted),
      releases: _safeNat(t.releases),
    },
  };
}

/** Coerce a value to a non-negative integer; returns 0 for anything invalid. */
function _safeNat(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.trunc(v));
}

// ---------------------------------------------------------------------------
// mergeLedgerOutcomes — MAX(live, ledger) per metric (AC-09-006.1)
// ---------------------------------------------------------------------------

/**
 * Merge live guild outcomes with the historical ledger by taking the MAX per
 * metric (AC-09-006.1). Preserves non-ledgered fields (greenTestRuns, weeklyStreak)
 * from the live outcomes unchanged.
 *
 * Pure function — no I/O, no mutation, same inputs → same output.
 *
 * @param live    The live outcomes derived from the current portfolio state.
 * @param ledger  The stored historical maximums.
 * @returns       A new `GuildOutcomes` where each metric is `MAX(live, ledger)`.
 */
export function mergeLedgerOutcomes(
  live: GuildOutcomes,
  ledger: GamificationLedger,
): GuildOutcomes {
  return {
    workOrdersDone: Math.max(live.workOrdersDone, ledger.totals.workOrdersDone),
    phasesCompleted: Math.max(live.phasesCompleted, ledger.totals.phasesCompleted),
    releases: Math.max(live.releases, ledger.totals.releases),
    // Non-ledgered fields pass through from live (ephemeral signals)
    greenTestRuns: live.greenTestRuns,
    weeklyStreak: live.weeklyStreak,
  };
}

// ---------------------------------------------------------------------------
// needsSnapshot — determines if a write is warranted (AC-09-006.2)
// ---------------------------------------------------------------------------

/**
 * Returns `true` when any live metric exceeds the stored ledger value, meaning
 * a new historical maximum exists and the ledger should be updated.
 *
 * Returns `false` when live ≤ ledger on all metrics (no write needed — avoids
 * unnecessary fs writes on every page load).
 *
 * Pure function — no I/O, no side effects.
 *
 * @param live    The live outcomes derived from the current portfolio state.
 * @param ledger  The stored historical maximums.
 */
export function needsSnapshot(live: GuildOutcomes, ledger: GamificationLedger): boolean {
  return (
    live.workOrdersDone > ledger.totals.workOrdersDone ||
    live.phasesCompleted > ledger.totals.phasesCompleted ||
    live.releases > ledger.totals.releases
  );
}
