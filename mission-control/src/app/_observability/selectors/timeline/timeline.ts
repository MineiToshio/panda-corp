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
 * The internal accumulator (`NodeAcc`) and folding helpers live in
 * `./accumulate` to keep each file within the file-size budget.
 *
 * Traceability:
 *   AC-12-003.1 → REQ-12-003 → IF-12-timeline → WO-12-004
 *   AC-12-007.1 → REQ-12-007 → IF-12-timeline → WO-12-004
 */

import type { Event } from "../../../../lib/events/events";
import {
  accumulateEvent,
  deriveWoRow,
  makeAcc,
  materialize,
  type NodeAcc,
  parseMs,
} from "./accumulate";
import type { TimelineRow } from "./types";

// ---------------------------------------------------------------------------
// Exported types — defined in ./types so timeline.ts and accumulate.ts can both
// reference TimelineRow without a circular import. Re-exported here so the public
// surface (@/.../timeline/timeline) is unchanged.
// ---------------------------------------------------------------------------

export type { TimelineRow } from "./types";

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
  const fold: TimelineFold = {
    woAccMap: new Map<string, NodeAcc>(), // key: workOrder id
    taskAccMap: new Map<string, NodeAcc>(), // key: `${workOrder}:${task}`
    // Action rows are individual events — each becomes its own row.
    actionRows: [],
    // Orphan action rows (no workOrder, no task) — top-level.
    orphanRows: [],
    counters: { wo: 0, task: 0, action: 0 },
  };

  for (const ev of events) {
    const parsed = parseValidEvent(ev);
    if (parsed === null) continue;
    foldEvent(parsed, fold);
  }

  // Materialise task rows first (needed for WO status propagation).
  const taskRows = Array.from(fold.taskAccMap.values()).map(materialize);

  // Build a per-WO index of child task rows for status propagation.
  const childTasksByWoId = indexTaskRowsByWo(taskRows);

  // Materialise WO rows using child task status propagation.
  const woRows = Array.from(fold.woAccMap.values()).map((woAcc) => {
    const children = childTasksByWoId.get(woAcc.id) ?? [];
    return deriveWoRow(woAcc, children);
  });

  // Assemble: WO rows → task rows → action rows → orphan rows.
  return [...woRows, ...taskRows, ...fold.actionRows, ...fold.orphanRows];
}

// ---------------------------------------------------------------------------
// Internal fold state + helpers
// ---------------------------------------------------------------------------

/** Mutable accumulator state threaded through the per-event fold. */
interface TimelineFold {
  woAccMap: Map<string, NodeAcc>;
  taskAccMap: Map<string, NodeAcc>;
  actionRows: TimelineRow[];
  orphanRows: TimelineRow[];
  counters: { wo: number; task: number; action: number };
}

/** A validated event with its parsed timestamp and normalised status. */
interface ParsedEvent {
  event: string;
  atMs: number;
  atStr: string;
  status: "ok" | "fail" | undefined;
  workOrder: string | null;
  task: string | null;
}

/**
 * Validate one raw event and parse its timestamp.
 * Returns null when the event is malformed or its timestamp is unparseable
 * (FREEZE-ON-RED + B1' guards — skip, never throw).
 */
function parseValidEvent(ev: Event): ParsedEvent | null {
  // FREEZE-ON-RED: guard against null/undefined elements in the array.
  if (ev === null || ev === undefined || typeof ev !== "object") return null;

  // Skip events missing required fields (event name or at timestamp).
  if (typeof ev.event !== "string" || typeof ev.at !== "string") return null;

  const atMs = parseMs(ev.at);
  // B1' guard: skip events with unparseable timestamps.
  if (!Number.isFinite(atMs)) return null;

  const hasWorkOrder = typeof ev.workOrder === "string" && ev.workOrder.length > 0;
  const hasTask = typeof ev.task === "string" && ev.task.length > 0;

  return {
    event: ev.event,
    atMs,
    atStr: ev.at,
    status: ev.status === "ok" || ev.status === "fail" ? ev.status : undefined,
    workOrder: hasWorkOrder ? (ev.workOrder as string) : null,
    task: hasTask ? (ev.task as string) : null,
  };
}

/** Route one parsed event to the correct accumulation branch. */
function foldEvent(ev: ParsedEvent, fold: TimelineFold): void {
  if (ev.workOrder === null) {
    foldOrphan(ev, fold);
    return;
  }

  const woAcc = ensureWoAcc(ev.workOrder, fold);
  // Always update minMs/minAt so the WO start reflects the earliest event across
  // ALL children (task and direct-action alike). WO status/end/duration are derived
  // in deriveWoRow by merging child task rows with woAcc direct-action stats.
  if (ev.atMs < woAcc.minMs) {
    woAcc.minMs = ev.atMs;
    woAcc.minAt = ev.atStr;
  }

  if (ev.task === null) {
    foldDirectAction(ev, woAcc, fold);
  } else {
    foldTaskAction(ev, ev.task, woAcc, fold);
  }
}

/** Get or create the WO accumulator for a workOrder key. */
function ensureWoAcc(woKey: string, fold: TimelineFold): NodeAcc {
  const existing = fold.woAccMap.get(woKey);
  if (existing !== undefined) return existing;
  fold.counters.wo++;
  const woAcc = makeAcc(`wo:${fold.counters.wo}:${woKey}`, "wo", woKey, null);
  fold.woAccMap.set(woKey, woAcc);
  return woAcc;
}

/** Emit a standalone top-level action row for an event with no workOrder. */
function foldOrphan(ev: ParsedEvent, fold: TimelineFold): void {
  fold.counters.action++;
  const orphanAcc = makeAcc(`orphan:${fold.counters.action}`, "action", ev.event, null);
  accumulateEvent(orphanAcc, ev.atMs, ev.atStr, ev.status);
  fold.orphanRows.push(materialize(orphanAcc));
}

/**
 * Event with a workOrder but no task — attach directly as an action child of the WO.
 * Accumulate into woAcc for WO-level terminal stats (B1 fix: also used when task
 * children exist, so deriveWoRow can merge direct-action stats with task stats).
 */
function foldDirectAction(ev: ParsedEvent, woAcc: NodeAcc, fold: TimelineFold): void {
  woAcc.hasDirectActions = true;
  // Track the latest direct-action timestamp for B2 detection (see deriveWoRow).
  if (ev.atMs > woAcc.maxDirectActionMs) {
    woAcc.maxDirectActionMs = ev.atMs;
  }
  accumulateEvent(woAcc, ev.atMs, ev.atStr, ev.status);

  fold.counters.action++;
  const actionAcc = makeAcc(`action:${fold.counters.action}`, "action", ev.event, woAcc.id);
  accumulateEvent(actionAcc, ev.atMs, ev.atStr, ev.status);
  fold.actionRows.push(materialize(actionAcc));
}

/** Full event: workOrder + task — update the task accumulator and emit a leaf action row. */
function foldTaskAction(ev: ParsedEvent, task: string, woAcc: NodeAcc, fold: TimelineFold): void {
  const taskKey = `${woAcc.label}:${task}`;
  let taskAcc = fold.taskAccMap.get(taskKey);
  if (taskAcc === undefined) {
    fold.counters.task++;
    taskAcc = makeAcc(`task:${fold.counters.task}:${task}`, "task", task, woAcc.id);
    fold.taskAccMap.set(taskKey, taskAcc);
  }
  accumulateEvent(taskAcc, ev.atMs, ev.atStr, ev.status);

  fold.counters.action++;
  const actionAcc = makeAcc(`action:${fold.counters.action}`, "action", ev.event, taskAcc.id);
  accumulateEvent(actionAcc, ev.atMs, ev.atStr, ev.status);
  fold.actionRows.push(materialize(actionAcc));
}

/** Index materialised task rows by their parent WO id for status propagation. */
function indexTaskRowsByWo(taskRows: TimelineRow[]): Map<string, TimelineRow[]> {
  const childTasksByWoId = new Map<string, TimelineRow[]>();
  for (const taskRow of taskRows) {
    if (taskRow.parentId !== null) {
      const list = childTasksByWoId.get(taskRow.parentId);
      if (list === undefined) {
        childTasksByWoId.set(taskRow.parentId, [taskRow]);
      } else {
        list.push(taskRow);
      }
    }
  }
  return childTasksByWoId;
}
