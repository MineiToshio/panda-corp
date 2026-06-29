/**
 * lib/achievements/catalogue/types.ts — Catalogue type contract (FRD-10 v2, WO-10-011)
 *
 * The shared types every axis file + the secrets file build against. Kept dependency-free
 * of `predicates.ts` (which imports the axis files) so there is no import cycle.
 */

import type { ReaderData } from "../stats";
import type { Rarity } from "../tiers";

/** The 8 trophy axes (FRD-10 v2, docs/achievements.md §3). */
export type UniqueCategory =
  | "Discovery"
  | "Speed"
  | "Quality"
  | "Consistency"
  | "Mastery"
  | "Production"
  | "Guild"
  | "Resilience";

/**
 * Result of a unique-achievement unlock check.
 *
 * `date` is OPTIONAL (honesty contract, blueprint §5): a cumulative-count unlock has no
 * single triggering timestamp, so it surfaces a provable `project` WITHOUT fabricating a
 * date. Event-anchored unlocks carry the real event `at` as `date`.
 */
export type UniqueResult = { unlocked: false } | { unlocked: true; project: string; date?: string };

/** Definition of a unique achievement (data table — never mutated at runtime). */
export type UniqueDefinition = {
  readonly name: string;
  readonly category: UniqueCategory;
  /** Per-trophy rarity grade (docs/achievements.md §2). */
  readonly rarity: Rarity;
  /** Human-readable condition (shown when locked — AC-10-003.3). */
  readonly condition: string;
  /** Pure predicate, derived from verifiable reader data (AC-10-003.2). No I/O. */
  readonly check: (data: ReaderData) => UniqueResult;
};

/** Secret achievement definition (data table — never mutated). */
export type SecretDefinition = {
  readonly id: string;
  /** Cryptic hint — always visible (AC-10-004.1). */
  readonly hint: string;
  /** What triggered it — revealed ONLY when unlocked (AC-10-004.2). */
  readonly criterion: string;
  /** Pure predicate; null when locked, or { project, date? } when unlocked (AC-10-004.3). */
  readonly check: (data: ReaderData) => null | { project: string; date?: string };
};
