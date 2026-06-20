/**
 * lib/achievements.ts — Pure stats / chains / uniques / secrets derivation (FRD-10)
 *
 * Platform golden rule (architecture §1): read-only derivation only. Pure functions. No I/O.
 * This module is flagged as a NEW file in blueprint §3.
 *
 * Interfaces implemented (blueprint §4 Components & Interfaces):
 *   IF-10-stats    — computeStats(readerData): Stat[]      (in ./stats)
 *   IF-10-chains   — computeChains(stats): ChainState[]
 *   IF-10-uniques  — computeUniques(readerData): Unique[]
 *   IF-10-secrets  — computeSecrets(readerData): Secret[]
 *
 * Honesty contract (blueprint §2):
 *   - Every stat derived from verifiable real outcomes (readers) — never an app-incremented counter.
 *   - Counters only grow (cumulative real history).
 *   - Empty factory → honest zeros, never fabricated.
 *   - Endowed progress: bars start at real progress, never inflated, never stuck.
 *   - Secrets always reveal their criterion on unlock — no permanent obscurity.
 *   - No notifications/nagging, no leaderboards, no false urgency.
 *
 * Traceability:
 *   AC-10-001.1..4 — computeStats           (in ./stats)
 *   AC-10-002.1..5 — computeChains + CHAIN_DEFINITIONS
 *   AC-10-003.1..4 — computeUniques + UNIQUE_DEFINITIONS
 *   AC-10-004.1..4 — computeSecrets + SECRET_DEFINITIONS
 *
 * Structure: the chain data tables live in ./definitions; the unique/secret tables
 * (with their unlock predicates) live in ./predicates; the reader input + stat
 * derivation live in ./stats. This file keeps the chain/unique/secret computations
 * and re-exports the moved public symbols so the import surface is unchanged.
 *
 * Thresholds/tier names from docs/achievements.md. Prototype data tables in prototype/index.html.
 */

import type { TierEntry } from "./definitions";
import { CHAIN_DEFINITIONS } from "./definitions";
import type { UniqueCategory } from "./predicates";
import { SECRET_DEFINITIONS, UNIQUE_DEFINITIONS } from "./predicates";
import type { ReaderData, Stat, TierUnlockEvent } from "./stats";

// ─────────────────────────────────────────────────────────────────────────────
// § 5. IF-10-chains — computeChains
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The computed state of a cumulative chain (AC-10-002.1).
 */
export type ChainState = {
  /** Stat key this chain tracks (same as ChainDefinition.statKey). */
  readonly statKey: string;
  /** Display label for this chain. */
  readonly label: string;
  /** Current tier index (0-based); -1 = no tier unlocked yet. */
  readonly currentTierIndex: number;
  /** Current tier name (null if no tier unlocked). */
  readonly currentTierName: string | null;
  /** Next tier entry (null if maxed out). */
  readonly nextTier: { readonly name: string; readonly threshold: number } | null;
  /**
   * Honest endowed progress toward the next tier, 0–100.
   *
   * Endowed = starts from real achieved progress (AC-10-002.3):
   *   - 0 when exactly at a tier boundary (just unlocked).
   *   - 100 when maxed (no next tier).
   *   - For lower-is-better: improves as value decreases toward next threshold.
   *   - NEVER inflated, NEVER artificially stuck (FRD-09 forbidden pattern).
   */
  readonly pctToNext: number;
  /** Whether this chain is lower-is-better (e.g. speed/idea→launch). */
  readonly lowerIsBetter: boolean;
  /** Unlock records per tier (AC-10-002.2). */
  readonly unlocks: readonly TierUnlockEvent[];
};

/**
 * Compute the chain states from the stats array (IF-10-chains, WO-10-001).
 *
 * Accepts EITHER:
 *   - A full Stat[] from computeStats (normal usage), OR
 *   - A partial Stat[] override (tests pass individual stats directly).
 *
 * Pure function: no I/O, no side effects.
 *
 * Prototype chainState() logic (prototype/index.html line ~381) translated to TypeScript:
 *   - Walk thresholds; current tier = last crossed threshold.
 *   - For lower-is-better: tier crossed when value ≤ threshold.
 *   - Progress: from current threshold boundary toward next.
 *   - Endowed: bar starts from real earned position, never zero-faked.
 */
export function computeChains(stats: readonly Stat[]): ChainState[] {
  return CHAIN_DEFINITIONS.map((chainDef) => {
    const stat = stats.find((s) => s.key === chainDef.statKey);
    const value = stat?.value ?? 0;
    const unlockEvents = stat?.unlockEvents ?? [];
    const lowerIsBetter = chainDef.lowerIsBetter === true;
    const tiers = chainDef.tiers;

    const currentTierIndex = _findCurrentTierIndex(tiers, value, lowerIsBetter);

    const currentTier = currentTierIndex >= 0 ? tiers[currentTierIndex] : undefined;
    const currentTierName = currentTier?.name ?? null;
    const nextTierEntry =
      currentTierIndex < tiers.length - 1 ? (tiers[currentTierIndex + 1] ?? null) : null;
    const nextTier = nextTierEntry
      ? { name: nextTierEntry.name, threshold: nextTierEntry.threshold }
      : null;

    const pctToNext = _computeChainPct({
      tiers,
      value,
      lowerIsBetter,
      currentTierIndex,
      nextTierEntry,
    });

    return {
      statKey: chainDef.statKey,
      label: chainDef.label,
      currentTierIndex,
      currentTierName,
      nextTier,
      pctToNext,
      lowerIsBetter,
      unlocks: unlockEvents,
    };
  });
}

/**
 * Find the current tier index for a chain value (behavior copied verbatim from
 * the original inline loop).
 *
 * Walk all thresholds; current = last one crossed.
 * For lower-is-better: crossed when value ≤ threshold; for normal: value ≥ threshold.
 * Special case for lower-is-better: value=0 means "no record" → no tier (-1).
 */
function _findCurrentTierIndex(
  tiers: readonly TierEntry[],
  value: number,
  lowerIsBetter: boolean,
): number {
  let currentTierIndex = -1;
  if (lowerIsBetter && value <= 0) {
    return currentTierIndex;
  }
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    if (!tier) continue;
    if (lowerIsBetter ? value <= tier.threshold : value >= tier.threshold) {
      currentTierIndex = i;
    }
  }
  return currentTierIndex;
}

/**
 * Honest endowed progress toward the next tier, 0–100 (behavior copied verbatim
 * from the original inline branching).
 */
function _computeChainPct(args: {
  tiers: readonly TierEntry[];
  value: number;
  lowerIsBetter: boolean;
  currentTierIndex: number;
  nextTierEntry: TierEntry | null;
}): number {
  const { tiers, value, lowerIsBetter, currentTierIndex, nextTierEntry } = args;

  if (nextTierEntry === null) {
    // Maxed out (or no tiers exist): 100%
    return currentTierIndex >= 0 ? 100 : 0;
  }

  if (lowerIsBetter) {
    if (value === 0) {
      // No record yet: 0%
      return 0;
    }
    // Lower-is-better progress:
    // prevThreshold = threshold of current tier (or the value itself if no tier yet)
    // progress = (prevThreshold - value) / (prevThreshold - nextThreshold) * 100
    const prevThreshold =
      currentTierIndex >= 0 ? (tiers[currentTierIndex]?.threshold ?? value) : value;
    const span = prevThreshold - nextTierEntry.threshold;
    const progress = prevThreshold - value;
    return span > 0 ? Math.min(100, Math.floor((progress / span) * 100)) : 0;
  }

  // Normal progress (higher is better):
  // progress = (value - currentThreshold) / (nextThreshold - currentThreshold) * 100
  const currentThreshold = currentTierIndex >= 0 ? (tiers[currentTierIndex]?.threshold ?? 0) : 0;
  const span = nextTierEntry.threshold - currentThreshold;
  const progress = value - currentThreshold;
  return span > 0 ? Math.min(100, Math.floor((progress / span) * 100)) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7. IF-10-uniques — computeUniques
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A computed unique achievement result (AC-10-003.1).
 */
export type Unique = {
  readonly name: string;
  readonly category: UniqueCategory;
  /** True when the achievement has been earned. */
  readonly unlocked: boolean;
  /** Date when unlocked (ISO string); present only when unlocked (AC-10-003.3). */
  readonly date?: string;
  /** Project slug when unlocked; present only when unlocked (AC-10-003.3). */
  readonly project?: string;
  /** Shown when locked — must be non-obscure (AC-10-003.3). */
  readonly condition: string;
};

/**
 * Compute all unique achievement states (IF-10-uniques, WO-10-001).
 *
 * Pure function: no I/O, no side effects.
 * Unlock state is derived from verifiable reader data (AC-10-003.2).
 * Locked uniques expose their condition (AC-10-003.3).
 */
export function computeUniques(data: ReaderData): Unique[] {
  return UNIQUE_DEFINITIONS.map((def) => {
    const result = def.check(data);
    if (result.unlocked) {
      return {
        name: def.name,
        category: def.category,
        unlocked: true,
        date: result.date,
        project: result.project,
        condition: def.condition,
      };
    }
    return {
      name: def.name,
      category: def.category,
      unlocked: false,
      condition: def.condition,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9. IF-10-secrets — computeSecrets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A computed secret achievement result (AC-10-004.1).
 */
export type Secret = {
  /** Always available (cryptic hint shown even when locked — AC-10-004.1). */
  readonly hint: string;
  /** True when the secret has been unlocked. */
  readonly unlocked: boolean;
  /**
   * What triggered the achievement — revealed ONLY when unlocked (AC-10-004.2).
   * NEVER present when locked (the criterion stays hidden until earned).
   */
  readonly criterion?: string;
  /** Date when unlocked; present only when unlocked. */
  readonly date?: string;
  /** Project when unlocked; present only when unlocked. */
  readonly project?: string;
};

/**
 * Compute all secret achievement states (IF-10-secrets, WO-10-001).
 *
 * Pure function: no I/O, no side effects.
 * Unlock state derived from verifiable reader data (AC-10-004.3).
 *
 * Locked: criterion is hidden (only hint visible — AC-10-004.2).
 * Unlocked: criterion is revealed (AC-10-004.2 — never permanent obscurity).
 */
export function computeSecrets(data: ReaderData): Secret[] {
  return SECRET_DEFINITIONS.map((def) => {
    const unlockResult = def.check(data);
    if (unlockResult !== null) {
      // Unlocked: reveal the criterion (AC-10-004.2)
      return {
        hint: def.hint,
        unlocked: true,
        criterion: def.criterion,
        date: unlockResult.date,
        project: unlockResult.project,
      };
    }
    // Locked: criterion is hidden (only hint)
    return {
      hint: def.hint,
      unlocked: false,
      // criterion, date, project are absent (undefined) — enforced by type (AC-10-004.2)
    };
  });
}
