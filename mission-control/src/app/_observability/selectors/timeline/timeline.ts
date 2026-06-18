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
