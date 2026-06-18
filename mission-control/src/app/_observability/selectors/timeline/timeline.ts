/**
 * WO-12-004 — `toTimeline` selector (IF-12-timeline).
 *
 * Pure selector: folds the capped event tail into a flat tree of
 * TimelineRow objects arranged as work-order → task → action nodes,
 * each carrying start/end/duration and parentId for the UI tree renderer.
 *
 * Contract:
 *   toTimeline(events: Event[]): TimelineRow[]
 *   - Level 0 (kind="wo"):     one row per distinct workOrder id; parentId=null.
 *   - Level 1 (kind="task"):   one row per distinct (workOrder, task) pair; parentId=wo.id.
 *   - Level 2 (kind="action"): one row per individual event (leaf); parentId=task.id or wo.id.
 *   - Orphan events (no workOrder and no task): surfaced as top-level action rows (parentId=null).
 *   - Events with a workOrder but no task: attached directly to the WO row as action children.
 *   - Malformed events (missing `event` or `at`): silently skipped (FREEZE-ON-RED).
 *   - Pure: no I/O, no env reads, no Claude calls. Never throws.
 *
 * Duration semantics (AC-12-007.1, blueprint §2 IF-12-timeline):
 *   - start: ISO string of the earliest event `at` within the node's subtree.
 *   - end:   ISO string of the latest event `at` within the node's subtree,
 *             BUT only when the subtree contains at least one event with
 *             status "ok" or "fail" (a terminal event). null otherwise.
 *   - duration: null when end is null; otherwise (Date.parse(end) - Date.parse(start)).
 *               Guarded with Number.isFinite (B1' anchor: Date.parse("bad") === NaN).
 *   - status: "running" when end is null; "fail" when any terminal child is "fail";
 *             "ok" when all terminals are "ok".
 *
 * Regression anchors:
 *   B1' (2026-06-16): Date.parse("bad") === NaN — duration is never NaN;
 *     guard every arithmetic result with Number.isFinite before use.
 *   I2  (2026-06-16): toTimeline([]) must return [] without throwing.
 *   I3  (2026-06-16): status "fail"/"ok" must be exact string literals, not truthy casts.
 *   FREEZE-ON-RED: per-event errors must not abort the whole fold.
 *   ISO offset lesson: use Date.parse() numerically for min/max timestamp comparisons,
 *     not raw string comparison (non-UTC offsets compare wrong lexicographically).
 *
 * Traceability:
 *   AC-12-003.1 → REQ-12-003 → IF-12-timeline → WO-12-004
 *   AC-12-007.1 → REQ-12-007 → IF-12-timeline → WO-12-004
 */

import type { Event } from "../../../../lib/events/events";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/**
 * A single row in the flattened timeline tree.
 * The tree is: WO → Task → Action (3 levels max).
 */
export type TimelineRow = {
  /** Stable unique id for this row in the output of one toTimeline call. */
  id: string;
  /** "wo" for work-order rows, "task" for task rows, "action" for leaf events. */
  kind: "wo" | "task" | "action";
  /** workOrder id, task id, or event name for action rows. */
  label: string;
  /** ISO 8601 timestamp of the earliest event within this node's subtree. */
  start: string;
  /**
   * ISO 8601 timestamp of the latest event within this node's subtree that has
   * a terminal status (ok or fail). null when the node is still in-progress.
   */
  end: string | null;
  /**
   * Duration in milliseconds (Date.parse(end) - Date.parse(start)).
   * null when end is null (in-progress).
   * Always null or a finite non-negative number (never NaN, never negative).
   */
  duration: number | null;
  /** Id of the parent row; null for top-level rows (WO rows and true orphans). */
  parentId: string | null;
  /** "running" when end is null; "fail" when any terminal child is "fail"; "ok" otherwise. */
  status: "ok" | "fail" | "running";
};

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
type NodeAcc = {
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
function parseMs(at: string | undefined): number {
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
function accumulateEvent(
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
function materialize(acc: NodeAcc): TimelineRow {
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
function deriveWoRow(woAcc: NodeAcc, childTaskRows: TimelineRow[]): TimelineRow {
  if (childTaskRows.length === 0) {
    // No task children — WO status is determined from direct action events
    // already accumulated into woAcc (actions without a task field).
    //
    // B2 fix (2026-06-16): `materialize(woAcc)` uses `hasTerminal` (true if ANY
    // direct action has a terminal status). When multiple direct actions exist and
    // the LATEST one has no terminal status, the WO must stay "running".
    //
    // Semantic: a direct-action-only WO is "running" when its latest event (by timestamp)
    // has no terminal status — i.e., maxDirectActionMs > maxTerminalMs (the latest event
    // came after the last terminal event).
    //
    // This correctly handles:
    //   - B2 case: A(ok)@10:00, B(open)@10:05 → maxDA=10:05 > maxTerminal=10:00 → running ✓
    //   - B1 regression: Action1(open)@10:00, Action2(ok)@10:02 → maxDA=10:02 = maxTerminal=10:02 → ok ✓
    //   - Single terminal: Action(ok)@10:00 → maxDA=maxTerminal=10:00 → ok ✓
    //   - No terminals: Action(open)@10:00 → hasTerminal=false → materialize returns running ✓
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

  // Derive WO status by merging task child stats with woAcc's direct-action stats.
  let anyRunning = false;
  let anyFail = false;
  let maxEndMs = -Infinity;
  let maxEndAt = "";

  // --- task children ---
  for (const taskRow of childTaskRows) {
    if (taskRow.status === "running") {
      anyRunning = true;
    } else if (taskRow.status === "fail") {
      anyFail = true;
    }
    // Accumulate end timestamps (only for closed tasks).
    if (taskRow.end !== null) {
      const endMs = Date.parse(taskRow.end);
      if (Number.isFinite(endMs) && endMs > maxEndMs) {
        maxEndMs = endMs;
        maxEndAt = taskRow.end;
      }
    }
  }

  // --- direct-action children (accumulated in woAcc, B1 fix) ---
  // woAcc.hasDirectActions is true only when at least one direct-action event
  // (workOrder set, no task) was seen. Without this guard we would incorrectly
  // interpret a WO that only has task children as having an open direct action.
  if (woAcc.hasDirectActions) {
    if (!woAcc.hasTerminal) {
      // At least one direct-action event has no terminal status → running.
      anyRunning = true;
    } else {
      // woAcc has terminal direct-action events — merge their stats.
      if (woAcc.anyFail) {
        anyFail = true;
      }
      if (Number.isFinite(woAcc.maxTerminalMs) && woAcc.maxTerminalMs > maxEndMs) {
        maxEndMs = woAcc.maxTerminalMs;
        maxEndAt = woAcc.maxTerminalAt;
      }
    }
  }

  let woStatus: "ok" | "fail" | "running";
  let woEnd: string | null;
  let woDuration: number | null;

  if (anyRunning) {
    // At least one child is still running → WO is running.
    woStatus = "running";
    woEnd = null;
    woDuration = null;
  } else if (anyFail) {
    woStatus = "fail";
    woEnd = maxEndMs > -Infinity ? maxEndAt : null;
    if (woEnd !== null) {
      const delta = maxEndMs - woAcc.minMs;
      woDuration = Number.isFinite(delta) ? Math.max(0, delta) : null;
    } else {
      woDuration = null;
    }
  } else {
    // All children ok.
    woStatus = "ok";
    woEnd = maxEndMs > -Infinity ? maxEndAt : null;
    if (woEnd !== null) {
      const delta = maxEndMs - woAcc.minMs;
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
function makeAcc(
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

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Fold the capped event tail into a flat list of TimelineRow objects,
 * arranged as a work-order → task → action tree (WO scope: IF-12-timeline).
 *
 * @param events - Already-parsed, capped `Event[]` from `lib/events`.
 *                 All items must have `event: string` and `at: string` fields.
 * @returns A flat array of `TimelineRow`s. The tree is navigable via `parentId`.
 *          Never throws. Never returns undefined or null.
 */
export function toTimeline(events: Event[]): TimelineRow[] {
  // Ordered maps preserve insertion order, which determines output ordering.
  const woAccMap = new Map<string, NodeAcc>(); // key: workOrder id
  const taskAccMap = new Map<string, NodeAcc>(); // key: `${workOrder}:${task}`
  // Action rows are individual events — each becomes its own row.
  const actionRows: TimelineRow[] = [];
  // Orphan action rows (no workOrder, no task) — top-level.
  const orphanRows: TimelineRow[] = [];

  let woCounter = 0;
  let taskCounter = 0;
  let actionCounter = 0;

  for (const ev of events) {
    // FREEZE-ON-RED: guard against null/undefined elements in the array.
    if (ev === null || ev === undefined || typeof ev !== "object") continue;

    // Skip events missing required fields (event name or at timestamp).
    if (typeof ev.event !== "string" || typeof ev.at !== "string") continue;

    const atMs = parseMs(ev.at);

    // B1' guard: skip events with unparseable timestamps — they cannot contribute
    // any meaningful timing information.
    if (!Number.isFinite(atMs)) continue;

    const atStr = ev.at;
    const status = ev.status === "ok" || ev.status === "fail" ? ev.status : undefined;

    const hasWorkOrder = typeof ev.workOrder === "string" && ev.workOrder.length > 0;
    const hasTask = typeof ev.task === "string" && ev.task.length > 0;

    if (!hasWorkOrder) {
      // True orphan — no workOrder (task is irrelevant without a workOrder).
      // Produce a standalone action row at the top level (parentId=null).
      actionCounter++;
      const orphanId = `orphan:${actionCounter}`;
      const orphanAcc = makeAcc(orphanId, "action", ev.event, null);
      accumulateEvent(orphanAcc, atMs, atStr, status);
      orphanRows.push(materialize(orphanAcc));
      continue;
    }

    // We have a workOrder — ensure the WO accumulator exists.
    const woKey = ev.workOrder as string;
    if (!woAccMap.has(woKey)) {
      woCounter++;
      const woId = `wo:${woCounter}:${woKey}`;
      woAccMap.set(woKey, makeAcc(woId, "wo", woKey, null));
    }
    const woAcc = woAccMap.get(woKey) as NodeAcc;
    // Always update minMs/minAt so the WO start reflects the earliest event across
    // ALL children (task and direct-action alike). WO status/end/duration are derived
    // in deriveWoRow by merging child task rows with woAcc direct-action stats.
    if (atMs < woAcc.minMs) {
      woAcc.minMs = atMs;
      woAcc.minAt = atStr;
    }

    if (!hasTask) {
      // Event has a workOrder but no task — attach directly as an action child of the WO.
      // Accumulate into woAcc for WO-level terminal stats (B1 fix: also used when task
      // children exist, so deriveWoRow can merge direct-action stats with task stats).
      woAcc.hasDirectActions = true;
      // Track the latest direct-action timestamp for B2 detection (see deriveWoRow).
      if (atMs > woAcc.maxDirectActionMs) {
        woAcc.maxDirectActionMs = atMs;
      }
      accumulateEvent(woAcc, atMs, atStr, status);

      actionCounter++;
      const actionId = `action:${actionCounter}`;
      const actionAcc = makeAcc(actionId, "action", ev.event, woAcc.id);
      accumulateEvent(actionAcc, atMs, atStr, status);
      actionRows.push(materialize(actionAcc));
      continue;
    }

    // Full event: workOrder + task — create/update the task accumulator.
    const taskKey = `${woKey}:${ev.task}`;
    if (!taskAccMap.has(taskKey)) {
      taskCounter++;
      const taskId = `task:${taskCounter}:${ev.task}`;
      taskAccMap.set(taskKey, makeAcc(taskId, "task", ev.task as string, woAcc.id));
    }
    const taskAcc = taskAccMap.get(taskKey) as NodeAcc;
    accumulateEvent(taskAcc, atMs, atStr, status);

    // Create an action row for this individual event (leaf node).
    actionCounter++;
    const actionId = `action:${actionCounter}`;
    const actionAcc = makeAcc(actionId, "action", ev.event, taskAcc.id);
    accumulateEvent(actionAcc, atMs, atStr, status);
    actionRows.push(materialize(actionAcc));
  }

  // Materialise task rows first (needed for WO status propagation).
  const taskRows = Array.from(taskAccMap.values()).map(materialize);

  // Build a per-WO index of child task rows for status propagation.
  // Key: woAcc.id → child task TimelineRow[].
  const childTasksByWoId = new Map<string, TimelineRow[]>();
  for (const taskRow of taskRows) {
    if (taskRow.parentId !== null) {
      if (!childTasksByWoId.has(taskRow.parentId)) {
        childTasksByWoId.set(taskRow.parentId, []);
      }
      (childTasksByWoId.get(taskRow.parentId) as TimelineRow[]).push(taskRow);
    }
  }

  // Materialise WO rows using child task status propagation.
  const woRows = Array.from(woAccMap.values()).map((woAcc) => {
    const children = childTasksByWoId.get(woAcc.id) ?? [];
    return deriveWoRow(woAcc, children);
  });

  // Assemble: WO rows → task rows → action rows → orphan rows.
  return [...woRows, ...taskRows, ...actionRows, ...orphanRows];
}
