/**
 * lib/achievements/report/types.ts — Shared types for the "Informe operativo" report layer (FRD-10 v3, WO-10-014)
 *
 * Platform golden rule (architecture §1): read-only derivation only.
 *
 * Honesty contract (DR-078, FRD-10 REQ-10-020): every git-backed reader returns a
 * discriminated result — a typed value OR an explicit `absent`/`error` variant — so the
 * UI can distinguish "the source is empty" (a real zero) from "git unavailable / shape
 * unparseable" (render "no cableado" / an error band). A bare `[]`/`null` masquerading as
 * "no activity" is forbidden.
 */

import type { IdeaStatus } from "../../ideas/ideas";

/** Pipeline phase order for the reopen detection (product < … < release). */
export type Phase = "product" | "design" | "architecture" | "implementation" | "release";

/**
 * Fail-loud result of a git-backed reader (DR-078, AC-10-014.7).
 *
 * - `ok: true`  → the value (which MAY be a legitimately empty collection — a real zero).
 * - `ok: false` → an explicit reason the source could not be read/parsed; the UI renders
 *   an error / "no cableado" band, NEVER an empty list that reads as zero activity.
 */
export type ReportResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: ReportAbsenceReason };

/** Why a git-backed aggregate is absent (mapped to the UI's error / "no cableado" state).
 *  Module-private: only `ReportResult` references it (the UI branches on `ok`, not the reason). */
type ReportAbsenceReason =
  /** `git` binary or repo not available at read time. */
  | "git-unavailable"
  /** The source was readable but its shape could not be interpreted. */
  | "unparseable";

/** One bucket of a weekly time-series: the ISO-week key and its count. */
export type WeeklyBucket = {
  /** ISO week key "YYYY-WW" (Monday-based), matching signals.ts/stats.ts. */
  readonly isoWeek: string;
  readonly count: number;
};

/** IF-10-flow-series — WO-verified + ideas-captured per ISO week. */
export type WeeklyFlow = {
  /** WO-verified per week, from the git crossing-to-VERIFIED commit of each wo-*.md. */
  readonly woVerified: readonly WeeklyBucket[];
  /** Ideas captured per week, from the `created` frontmatter of factory/ideas/*.md. */
  readonly ideasCaptured: readonly WeeklyBucket[];
  /** Max WO-verified week count (for the records grid, REQ-10-027). */
  readonly peakWeek: number;
  /** Count of idea cards with no `created` frontmatter (excluded, observable — not silently zeroed). */
  readonly ideasWithoutCreated: number;
};

/** IF-10-phase-transitions — one per-project `phase` transition. */
export type PhaseTransition = {
  readonly project: string;
  /** ISO date (YYYY-MM-DD) of the commit that changed the phase. */
  readonly date: string;
  readonly from: Phase;
  readonly to: Phase;
  /** True when `to` precedes `from` in the pipeline order (a reopen / backward move). */
  readonly isReopen: boolean;
};

/** IF-10-scalars — the scalar counts for the ledger / pulse. */
export type ReportScalars = {
  readonly frds: number;
  readonly commits: number;
  readonly decisions: number;
  readonly projects: number;
  /** Real tests-passing count, or `null` → "no cableado" (never a fabricated number). */
  readonly testsPassing: number | null;
};

/** One named usage count (a workflow or an effort level). */
export type UsageCount = {
  readonly name: string;
  readonly count: number;
};

/** Effort tiers the factory runs subagents at (real `data.effort.level` vocabulary). */
export type EffortLevel = "high" | "xhigh" | "max" | "medium";

/** IF-10-usage — most-used workflows + the effort mix, from the event snapshot. */
export type UsageMix = {
  /** Top workflows by run count, descending. */
  readonly workflows: readonly UsageCount[];
  /** Effort mix (high/xhigh/max/medium), descending by count. */
  readonly effort: readonly { readonly level: EffortLevel; readonly count: number }[];
};

/** IF-10-funnel — ideas→launched funnel + WIP + conversion + discard hygiene. */
export type FunnelFlow = {
  readonly totalIdeas: number;
  readonly byStatus: Readonly<Record<IdeaStatus, number>>;
  readonly launched: number;
  /** Conversion ideas→launched as a percentage (rounded), 0 when no ideas. */
  readonly conversionPct: number;
  /** Active projects: phase ∈ {design, architecture, implementation}. */
  readonly wip: number;
  /** Discarded cards whose `discard_reason` is empty (a hygiene signal). */
  readonly discardsWithoutReason: number;
};

/** IF-10-lessons — distilled-vs-captured lesson counts, or null → "no cableado". */
export type LessonCounts = {
  /** Distilled LESSON-*.md cards. */
  readonly distilled: number;
  /** Captured raw notes (inbox lines). */
  readonly captured: number;
};
