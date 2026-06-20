/**
 * WO-12-004 — internal accumulation helpers for the `toTimeline` selector.
 *
 * These are the building blocks of `timeline.ts`: the mutable `NodeAcc`
 * accumulator and the pure helpers that fold events into it and materialise
 * the final {@link TimelineRow} objects. Extracted from `timeline.ts` so each
 * file stays within the clean-code file-size budget; the public contract and
 * the `toTimeline` entry point remain in `timeline.ts`.
 *
 * Duration/status semantics, the B1'/B1/B2 regression anchors and the
 * FREEZE-ON-RED behaviour are documented inline with each helper and in
 * `timeline.ts`.
 */

import type { TimelineRow } from "./types";

// ---------------------------------------------------------------------------
// Internal accumulators
// ---------------------------------------------------------------------------

/**
 * Mutable accumulator for aggregating events into a single timeline node.
 *
 * For WO nodes:
 *   - `minMs`/`minAt` are updated for ALL events (both task-level and direct-action),
 *     so the WO start reflects the earliest event across all children.
 *   - `hasTerminal`, `anyFail`, `maxTerminalMs`, `maxTerminalAt`, and `hasDirectActions`
 *     are accumulated ONLY from direct-action events (workOrder set, no task field).
 *     `deriveWoRow` merges these with child task row stats to derive the WO verdict
 *     (B1 fix, 2026-06-16).
 *
 * For task and action nodes, all fields are populated from raw events.
 */
export type NodeAcc = {
  id: string;
  kind: "wo" | "task" | "action";
  label: string;
  parentId: string | null;
  /** Earliest Date.parse() value seen (Infinity until first valid event). */
  minMs: number;
  /** ISO string corresponding to minMs. */
  minAt: string;
  /** Latest Date.parse() value among terminal (ok/fail) events (-Infinity until first terminal). */
  maxTerminalMs: number;
  /** ISO string corresponding to maxTerminalMs. */
  maxTerminalAt: string;
  /** Whether any terminal event has status === "fail". */
  anyFail: boolean;
  /** Whether any terminal (ok/fail) event has been seen. */
  hasTerminal: boolean;
  /**
   * For WO accumulators only: true when at least one direct-action event
   * (workOrder set, task absent) has been processed. Used by deriveWoRow to
   * determine whether to merge woAcc terminal stats into the WO verdict (B1 fix).
   */
  hasDirectActions: boolean;
  /**
   * For WO accumulators only: the latest timestamp (ms) among ALL direct-action events.
   * Used in the no-task-children branch: if this exceeds maxTerminalMs, the latest direct
   * action has no terminal status (still open), keeping the WO running (B2 fix, 2026-06-16).
   * Initialized to -Infinity (no events seen yet).
   */
  maxDirectActionMs: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse the `at` field of an event and return its numeric millisecond value.
 * Returns NaN when the string is missing or unparseable (B1' guard).
 */
export function parseMs(at: string | undefined): number {
  if (typeof at !== "string" || at.trim() === "") return Number.NaN;
  return Date.parse(at);
}

/**
 * Update a node accumulator with one event's timing and status.
 *
 * @param acc    - The node to update (mutated in place).
 * @param atMs   - The numeric ms from Date.parse(event.at) — already validated finite.
 * @param atStr  - The raw ISO string from event.at (kept for display).
 * @param status - The event's status field (may be undefined for in-progress events).
 */
export function accumulateEvent(
  acc: NodeAcc,
  atMs: number,
  atStr: string,
  status: "ok" | "fail" | undefined,
): void {
  // Update minimum timestamp (the "start" of the node).
  if (atMs < acc.minMs) {
    acc.minMs = atMs;
    acc.minAt = atStr;
  }

  // Update maximum terminal timestamp ("end" of the node) only for ok/fail events.
  if (status === "ok" || status === "fail") {
    acc.hasTerminal = true;
    if (atMs > acc.maxTerminalMs) {
      acc.maxTerminalMs = atMs;
      acc.maxTerminalAt = atStr;
    }
    if (status === "fail") {
      acc.anyFail = true;
    }
  }
}

/**
 * Compute the end/duration/status fields from accumulated terminal stats.
 * B1' guard: Number.isFinite before arithmetic.
 */
function computeEndDurationStatus(acc: {
  minMs: number;
  hasTerminal: boolean;
  maxTerminalMs: number;
  maxTerminalAt: string;
  anyFail: boolean;
}): { end: string | null; duration: number | null; status: "ok" | "fail" | "running" } {
  const end = acc.hasTerminal ? acc.maxTerminalAt : null;

  let duration: number | null = null;
  if (end !== null) {
    const delta = acc.maxTerminalMs - acc.minMs;
    duration = Number.isFinite(delta) ? Math.max(0, delta) : null;
  }

  let status: "ok" | "fail" | "running";
  if (!acc.hasTerminal) {
    status = "running";
  } else if (acc.anyFail) {
    status = "fail";
  } else {
    status = "ok";
  }

  return { end, duration, status };
}

/**
 * Materialise a NodeAcc (for task and action rows) into a final TimelineRow.
 * WO rows use `deriveWoRow` instead.
 */
export function materialize(acc: NodeAcc): TimelineRow {
  const { end, duration, status } = computeEndDurationStatus(acc);
  return {
    id: acc.id,
    kind: acc.kind,
    label: acc.label,
    start: acc.minAt,
    end,
    duration,
    parentId: acc.parentId,
    status,
  };
}

/**
 * Derive a WO-level TimelineRow from:
 *   - `woAcc` — carries `id`, `label`, `minMs`/`minAt` (WO start) from raw events,
 *               AND terminal stats for direct-action children (no task field).
 *   - `childTaskRows` — materialized child task rows used to derive WO status.
 *
 * WO status semantics (propagation from ALL children — tasks AND direct actions):
 *   - Any running child (task or direct-action) → WO is "running".
 *   - No running children, any "fail" child → WO is "fail".
 *   - All children closed with "ok" → WO is "ok".
 *
 * WO end is the max terminal timestamp across BOTH child task ends AND direct-action
 * terminal events accumulated in woAcc. If any child is running, WO end is null.
 *
 * For WOs with no task children (only direct action children or no events at
 * all after filtering), fall back to accumulator-based computation.
 *
 * B1 fix (2026-06-16): the previous implementation ignored woAcc terminal stats
 * whenever childTaskRows.length > 0. A WO with a closed task + a later running
 * direct action was incorrectly reported as finished. Fix: merge woAcc direct-action
 * stats with task stats for the final WO verdict.
 */
export function deriveWoRow(woAcc: NodeAcc, childTaskRows: TimelineRow[]): TimelineRow {
  if (childTaskRows.length === 0) {
    return deriveWoRowNoTasks(woAcc);
  }

  // Derive WO status by merging task child stats with woAcc's direct-action stats.
  const verdict = mergeWoStats(woAcc, childTaskRows);
  return finalizeWoRow(woAcc, verdict);
}

/** Mutable accumulation of child verdict stats while merging task + direct-action children. */
type WoVerdict = {
  anyRunning: boolean;
  anyFail: boolean;
  maxEndMs: number;
  maxEndAt: string;
};

/**
 * Derive a WO row when it has no task children — status comes from the direct
 * action events accumulated into woAcc.
 *
 * B2 fix (2026-06-16): `materialize(woAcc)` uses `hasTerminal` (true if ANY
 * direct action has a terminal status). When multiple direct actions exist and
 * the LATEST one has no terminal status, the WO must stay "running".
 *
 * Semantic: a direct-action-only WO is "running" when its latest event (by timestamp)
 * has no terminal status — i.e., maxDirectActionMs > maxTerminalMs (the latest event
 * came after the last terminal event).
 *
 * This correctly handles:
 *   - B2 case: A(ok)@10:00, B(open)@10:05 → maxDA=10:05 > maxTerminal=10:00 → running ✓
 *   - B1 regression: Action1(open)@10:00, Action2(ok)@10:02 → maxDA=10:02 = maxTerminal=10:02 → ok ✓
 *   - Single terminal: Action(ok)@10:00 → maxDA=maxTerminal=10:00 → ok ✓
 *   - No terminals: Action(open)@10:00 → hasTerminal=false → materialize returns running ✓
 */
function deriveWoRowNoTasks(woAcc: NodeAcc): TimelineRow {
  const hasOpenLatestDirectAction =
    woAcc.hasDirectActions &&
    Number.isFinite(woAcc.maxDirectActionMs) &&
    woAcc.maxDirectActionMs > woAcc.maxTerminalMs;
  if (hasOpenLatestDirectAction) {
    return {
      id: woAcc.id,
      kind: "wo",
      label: woAcc.label,
      start: woAcc.minAt,
      end: null,
      duration: null,
      parentId: null,
      status: "running",
    };
  }
  return materialize(woAcc);
}

/**
 * Merge child task row stats with woAcc's direct-action stats into a WoVerdict
 * (B1 fix: direct-action stats are merged even when task children exist).
 */
function mergeWoStats(woAcc: NodeAcc, childTaskRows: TimelineRow[]): WoVerdict {
  const verdict: WoVerdict = {
    anyRunning: false,
    anyFail: false,
    maxEndMs: -Infinity,
    maxEndAt: "",
  };

  for (const taskRow of childTaskRows) {
    accumulateTaskRow(verdict, taskRow);
  }

  mergeDirectActionStats(verdict, woAcc);
  return verdict;
}

/** Fold one materialised task row's status/end into the running verdict. */
function accumulateTaskRow(verdict: WoVerdict, taskRow: TimelineRow): void {
  if (taskRow.status === "running") {
    verdict.anyRunning = true;
  } else if (taskRow.status === "fail") {
    verdict.anyFail = true;
  }
  // Accumulate end timestamps (only for closed tasks).
  if (taskRow.end !== null) {
    const endMs = Date.parse(taskRow.end);
    if (Number.isFinite(endMs) && endMs > verdict.maxEndMs) {
      verdict.maxEndMs = endMs;
      verdict.maxEndAt = taskRow.end;
    }
  }
}

/**
 * Merge woAcc's direct-action stats into the verdict.
 * woAcc.hasDirectActions is true only when at least one direct-action event
 * (workOrder set, no task) was seen. Without this guard we would incorrectly
 * interpret a WO that only has task children as having an open direct action.
 */
function mergeDirectActionStats(verdict: WoVerdict, woAcc: NodeAcc): void {
  if (!woAcc.hasDirectActions) return;
  if (!woAcc.hasTerminal) {
    // At least one direct-action event has no terminal status → running.
    verdict.anyRunning = true;
    return;
  }
  // woAcc has terminal direct-action events — merge their stats.
  if (woAcc.anyFail) {
    verdict.anyFail = true;
  }
  if (Number.isFinite(woAcc.maxTerminalMs) && woAcc.maxTerminalMs > verdict.maxEndMs) {
    verdict.maxEndMs = woAcc.maxTerminalMs;
    verdict.maxEndAt = woAcc.maxTerminalAt;
  }
}

/** Build the final WO TimelineRow from the merged verdict. */
function finalizeWoRow(woAcc: NodeAcc, verdict: WoVerdict): TimelineRow {
  let woStatus: "ok" | "fail" | "running";
  let woEnd: string | null;
  let woDuration: number | null;

  if (verdict.anyRunning) {
    // At least one child is still running → WO is running.
    woStatus = "running";
    woEnd = null;
    woDuration = null;
  } else {
    woStatus = verdict.anyFail ? "fail" : "ok";
    woEnd = verdict.maxEndMs > -Infinity ? verdict.maxEndAt : null;
    if (woEnd !== null) {
      const delta = verdict.maxEndMs - woAcc.minMs;
      woDuration = Number.isFinite(delta) ? Math.max(0, delta) : null;
    } else {
      woDuration = null;
    }
  }

  return {
    id: woAcc.id,
    kind: "wo",
    label: woAcc.label,
    start: woAcc.minAt,
    end: woEnd,
    duration: woDuration,
    parentId: null,
    status: woStatus,
  };
}

/** Create a fresh NodeAcc with sentinel values. */
export function makeAcc(
  id: string,
  kind: "wo" | "task" | "action",
  label: string,
  parentId: string | null,
): NodeAcc {
  return {
    id,
    kind,
    label,
    parentId,
    minMs: Infinity,
    minAt: "",
    maxTerminalMs: -Infinity,
    maxTerminalAt: "",
    anyFail: false,
    hasTerminal: false,
    hasDirectActions: false,
    maxDirectActionMs: -Infinity,
  };
}
