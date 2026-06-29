/**
 * lib/achievements/catalogue/helpers.ts — Shared unlock-check helpers (FRD-10 v2, WO-10-011)
 *
 * Pure helpers the axis files + secrets compose to express unlock conditions. Every
 * helper derives from VERIFIABLE reader data (statuses · ideas · the real event stream
 * via the signals layer). No I/O. Honesty contract: never fabricate a date/project.
 */

import type { Event } from "../../events/events";
import { signalsFor } from "../signals";
import type { ReaderData } from "../stats";
import type { UniqueResult } from "./types";

/** Re-export: the memoized real-signal aggregates for a ReaderData (DR-092). */
export { signalsFor };

/** Locked result (the common "not yet" return). */
const LOCKED: UniqueResult = { unlocked: false };

/** Pipeline phase order → rank (product=0 … release=4). */
const PHASE_RANK: Record<string, number> = {
  product: 0,
  design: 1,
  architecture: 2,
  implementation: 3,
  release: 4,
};

/** Rank of a phase string (unknown → -1). */
function phaseRank(phase: string | undefined): number {
  if (phase === undefined) return -1;
  return PHASE_RANK[phase] ?? -1;
}

/** A present project status reduced to { phase, project, updatedAt }. */
export type PhaseRow = { phase: string; project: string; updatedAt: string };

/** All present statuses as { phase, project, updatedAt } rows (skips absent/blank). */
export function phaseRows(data: ReaderData): PhaseRow[] {
  const rows: PhaseRow[] = [];
  for (const sr of data.statuses) {
    if (!sr.present || sr.status === null) continue;
    const phase = sr.status.phase;
    if (typeof phase !== "string") continue;
    rows.push({ phase, project: sr.status.project ?? "", updatedAt: sr.status.updatedAt ?? "" });
  }
  return rows;
}

/** Count of projects currently at `phase=release`. */
export function shippedCount(data: ReaderData): number {
  return phaseRows(data).filter((r) => r.phase === "release").length;
}

/** Earliest project (by updatedAt) at or beyond `minRank`, or null. */
export function firstAtMinPhase(data: ReaderData, minRank: number): UnlockStamp | null {
  const rows = phaseRows(data)
    .filter((r) => phaseRank(r.phase) >= minRank)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const first = rows[0];
  if (!first) return null;
  return { project: first.project, date: first.updatedAt || undefined };
}

/** Count of projects at or beyond `minRank`. */
export function countAtMinPhase(data: ReaderData, minRank: number): number {
  return phaseRows(data).filter((r) => phaseRank(r.phase) >= minRank).length;
}

/** Count of projects currently at exactly `phase`. */
export function countAtPhase(data: ReaderData, phase: string): number {
  return phaseRows(data).filter((r) => r.phase === phase).length;
}

/** The N-th shipped project (1-based) by updatedAt, or null. */
export function nthShipped(data: ReaderData, n: number): UnlockStamp | null {
  const rows = phaseRows(data)
    .filter((r) => r.phase === "release")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const row = rows[n - 1];
  if (!row) return null;
  return { project: row.project, date: row.updatedAt || undefined };
}

/** Ideas count by status predicate. */
export function ideasWhere(data: ReaderData, pred: (status: string) => boolean): number {
  return data.ideas.filter((i) => pred(i.status)).length;
}

/** True when present statuses include BOTH deploy targets `a` and `b`. */
export function hasBothDeployTargets(data: ReaderData, a: string, b: string): boolean {
  const seen = new Set<string>();
  for (const sr of data.statuses) {
    if (sr.present && sr.status !== null && typeof sr.status.deployTarget === "string") {
      seen.add(sr.status.deployTarget);
    }
  }
  return seen.has(a) && seen.has(b);
}

/** True when any present status declares the given web target platform. */
export function hasTargetPlatform(data: ReaderData, platform: string): boolean {
  for (const sr of data.statuses) {
    if (sr.present && sr.status !== null && sr.status.targetPlatforms === platform) return true;
  }
  return false;
}

/** A provable representative project for a factory-wide count unlock (else "factory"). */
export function representativeProject(data: ReaderData): string {
  const ship = nthShipped(data, 1);
  if (ship) return ship.project;
  const firstRow = phaseRows(data)[0];
  if (firstRow?.project) return firstRow.project;
  const greenDone = signalsFor(data).firstGreenDone;
  return greenDone?.project ?? "factory";
}

/** A { project, date? } unlock stamp. */
export type UnlockStamp = { project: string; date?: string };

/** Turn a stamp (or null) into a UniqueResult. */
export function fromStamp(stamp: UnlockStamp | null): UniqueResult {
  if (stamp === null) return LOCKED;
  return { unlocked: true, project: stamp.project, ...(stamp.date ? { date: stamp.date } : {}) };
}

/**
 * Unlock when `condition` holds, stamped with a representative project (and optional date).
 * For cumulative-count trophies that have no single triggering timestamp.
 */
export function unlockWhen(data: ReaderData, condition: boolean, date?: string): UniqueResult {
  if (!condition) return LOCKED;
  return { unlocked: true, project: representativeProject(data), ...(date ? { date } : {}) };
}

/** Green-WO close events (`AgentDone result=green`) sorted ascending by `at`. */
function greenDoneSorted(data: ReaderData): Event[] {
  const events = data.eventsSnapshot?.events ?? [];
  return events
    .filter((ev) => ev.event === "AgentDone" && ev.result === "green")
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** True when ≥ `n` green WOs closed within any `hours`-hour window (marathon/sprint). */
export function hasBurst(data: ReaderData, n: number, hours: number): UnlockStamp | null {
  const evs = greenDoneSorted(data);
  if (evs.length < n) return null;
  const windowMs = hours * 3_600_000;
  for (let i = 0; i + n - 1 < evs.length; i++) {
    const first = evs[i];
    const last = evs[i + n - 1];
    if (!first || !last) continue;
    const t0 = new Date(first.at).getTime();
    const t1 = new Date(last.at).getTime();
    if (Number.isFinite(t0) && Number.isFinite(t1) && t1 - t0 <= windowMs) {
      return { project: first.project ?? representativeProject(data), date: first.at };
    }
  }
  return null;
}
