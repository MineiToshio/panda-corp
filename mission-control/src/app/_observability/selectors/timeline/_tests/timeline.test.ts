/**
 * WO-12-004 — `toTimeline` selector (IF-12-timeline) — RED phase.
 *
 * Tests are written BEFORE the implementation
 * (`app/_observability/selectors/timeline.ts` does not exist yet).
 * Every test must fail until the GREEN phase; that is the intent.
 *
 * Traceability:
 *   AC-12-003.1  INSIDE a project, it SHALL offer an RPG ↔ timeline/tree toggle
 *                over the same data: work orders → tasks → actions, with duration
 *                and parent-child relationship.
 *                Source: FRD-12 EARS criteria; blueprint §2 (IF-12-timeline);
 *                REQ-12-003; WO-12-004.
 *   AC-12-007.1  … time per work order … derived from the same event file.
 *                Source: FRD-12 EARS criteria; blueprint §2 (IF-12-timeline);
 *                REQ-12-007; WO-12-004 scope.
 *
 * Contract (from WO-12-004 + blueprint §2 IF-12-timeline):
 *   export function toTimeline(events: Event[]): TimelineRow[]
 *
 *   TimelineRow:
 *     {
 *       id: string;              // unique stable id for the row
 *       kind: "wo" | "task" | "action";
 *       label: string;           // workOrder id, task id, or event name
 *       start: string;           // ISO 8601 timestamp of the first event for this node
 *       end: string | null;      // ISO 8601 timestamp of last seen close event, null if in-progress
 *       duration: number | null; // milliseconds (end - start), null when end is null (in-progress)
 *       parentId: string | null; // id of parent row (null for top-level WO rows)
 *       status: "ok" | "fail" | "running"; // "running" when end is null
 *     }
 *
 *   Tree structure:
 *     - Level 0 (kind="wo"):     one row per distinct workOrder id; parentId=null.
 *     - Level 1 (kind="task"):   one row per distinct (workOrder, task) pair; parentId=wo.id.
 *     - Level 2 (kind="action"): one row per event that has no matching task grouping
 *                                 OR is a leaf action; parentId=task.id (or wo.id for orphan actions).
 *   Orphan actions (events with no workOrder and no task) are allowed; they must
 *   not cause a throw — they are placed as top-level rows with parentId=null.
 *   Malformed events (missing required fields) are silently skipped.
 *
 *   Duration semantics:
 *     - start: ISO string of the earliest event at/within this node.
 *     - end:   ISO string of the latest event at/within this node, IF the subtree
 *              has at least one event with status="ok" or status="fail".
 *              null when the node has only open/running events (no terminal status).
 *     - duration: Number.isFinite(Date.parse(end) - Date.parse(start)) ? that delta : null.
 *     - "running" status: when end is null.
 *
 *   Pure: no I/O, no env reads, no Claude calls. Never throws.
 *
 * Regression anchors from .pandacorp/comms/progress.md (real bugs → regression tests):
 *   B1' (WO-13-001, 2026-06-16): Date.parse("bad") === NaN — duration must never be NaN;
 *     guard with Number.isFinite before returning a duration value.
 *   I2  (WO-13-001, 2026-06-16): empty-object / vacuous-truth — toTimeline([]) must return
 *     [] not throw.
 *   I3  (WO-13-001, 2026-06-16): array-shaped values bypass scalar guards — status:"fail"
 *     must be exactly the string "fail", not an array or other truthy value.
 *   FREEZE-ON-RED (WO-02-004, 2026-06-16): per-event errors must not abort the whole fold —
 *     one malformed event must leave the rest of the tree intact.
 *   ISO offset lesson (factory/memory, 2026-06-16): ISO strings with non-UTC offsets (+02:00)
 *     compare wrong lexicographically — always use Date.parse() for computing durations/min/max
 *     of timestamps; only the raw string is kept for display.
 *
 * Property-based invariants (parametric — no external library needed):
 *   - parentId of every "wo" row is null.
 *   - parentId of every "task" row references an id of a "wo" row in the same output.
 *   - parentId of every "action" row references an id of a "task" or "wo" row in the same output
 *     (unless the action is a true orphan, in which case parentId may be null).
 *   - start ≤ end whenever end is not null (chronological invariant).
 *   - duration is null iff end is null.
 *   - No duplicate ids in the output.
 *   - status is "running" iff end is null.
 *
 * Stack: Vitest (TypeScript). Pure function — no mocks, no I/O.
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Type aliases — mirror the contract.  Kept here so the test file is
// self-contained during the RED phase when timeline.ts does not exist yet.
// ---------------------------------------------------------------------------

type Event = {
  event: string;
  at: string;
  agent?: string;
  status?: "ok" | "fail";
  workOrder?: string;
  task?: string;
  project?: string;
};

type TimelineRow = {
  id: string;
  kind: "wo" | "task" | "action";
  label: string;
  start: string;
  end: string | null;
  duration: number | null;
  parentId: string | null;
  status: "ok" | "fail" | "running";
};

// ---------------------------------------------------------------------------
// Module under test — GREEN phase (timeline.ts exists and is fully typed).
// ---------------------------------------------------------------------------

import { toTimeline } from "../timeline";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    event: "ToolCall",
    at: "2026-06-16T10:00:00Z",
    agent: "implementer",
    status: "ok",
    workOrder: "WO-12-001",
    task: "task-a",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper assertions
// ---------------------------------------------------------------------------

function findRow(
  rows: TimelineRow[],
  kind: TimelineRow["kind"],
  label: string,
): TimelineRow | undefined {
  return rows.find((r) => r.kind === kind && r.label === label);
}

function allIds(rows: TimelineRow[]): string[] {
  return rows.map((r) => r.id);
}

// ===========================================================================
// AC-12-003.1 — EMPTY INPUT
// toTimeline([]) must return [] without throwing.
// Regression: I2 (WO-13-001) — vacuous-truth / empty-check.
// ===========================================================================

describe("frd-12: toTimeline — AC-12-003.1 empty events → empty output", () => {
  it("frd-12: WHEN events is [] THEN toTimeline returns an empty array", () => {
    expect(toTimeline([])).toStrictEqual([]);
  });

  it("frd-12: WHEN events is [] THEN toTimeline does NOT throw", () => {
    expect(() => toTimeline([])).not.toThrow();
  });

  it("frd-12: WHEN events is [] THEN the return value is an array (not null, not undefined)", () => {
    const result = toTimeline([]);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ===========================================================================
// AC-12-003.1 — WO → TASK → ACTION NESTING (parent-child relationship)
// The fundamental tree invariant: work orders at the root, tasks under WOs,
// actions under tasks.
// ===========================================================================

describe("frd-12: toTimeline — AC-12-003.1 WO→task→action tree nesting", () => {
  // Minimal fixture: one WO, one task, one action.
  const events: Event[] = [
    makeEvent({
      at: "2026-06-16T10:00:00Z",
      workOrder: "WO-A",
      task: "task-1",
      event: "ToolCall",
      status: "ok",
    }),
  ];

  it("frd-12: WHEN one event has workOrder and task THEN output contains a wo row for that workOrder", () => {
    const rows = toTimeline(events);
    const woRow = findRow(rows, "wo", "WO-A");
    expect(woRow).toBeDefined();
  });

  it("frd-12: WHEN one event has workOrder and task THEN output contains a task row for that task", () => {
    const rows = toTimeline(events);
    const taskRow = findRow(rows, "task", "task-1");
    expect(taskRow).toBeDefined();
  });

  it("frd-12: WHEN one event has workOrder and task THEN the wo row has parentId=null", () => {
    const rows = toTimeline(events);
    const woRow = findRow(rows, "wo", "WO-A");
    expect(woRow?.parentId).toBeNull();
  });

  it("frd-12: WHEN one event has workOrder and task THEN the task row parentId points to the wo row id", () => {
    const rows = toTimeline(events);
    const woRow = findRow(rows, "wo", "WO-A");
    const taskRow = findRow(rows, "task", "task-1");
    expect(taskRow?.parentId).toBe(woRow?.id);
  });

  it("frd-12: WHEN one event with workOrder+task THEN an action row is created with parentId=task.id", () => {
    const rows = toTimeline(events);
    const taskRow = findRow(rows, "task", "task-1");
    const actionRow = rows.find((r) => r.kind === "action");
    expect(actionRow).toBeDefined();
    expect(actionRow?.parentId).toBe(taskRow?.id);
  });

  it("frd-12: WHEN two events share the same workOrder THEN only ONE wo row is emitted for that WO", () => {
    const two = [
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-A", task: "task-1" }),
      makeEvent({ at: "2026-06-16T10:01:00Z", workOrder: "WO-A", task: "task-2" }),
    ];
    const rows = toTimeline(two);
    const woRows = rows.filter((r) => r.kind === "wo" && r.label === "WO-A");
    expect(woRows).toHaveLength(1);
  });

  it("frd-12: WHEN two events share the same (workOrder, task) THEN only ONE task row is emitted", () => {
    const two = [
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-A", task: "task-1", event: "Start" }),
      makeEvent({
        at: "2026-06-16T10:01:00Z",
        workOrder: "WO-A",
        task: "task-1",
        event: "End",
        status: "ok",
      }),
    ];
    const rows = toTimeline(two);
    const taskRows = rows.filter((r) => r.kind === "task" && r.label === "task-1");
    expect(taskRows).toHaveLength(1);
  });
});

// ===========================================================================
// AC-12-003.1 — MULTI-WO FIXTURE
// Multiple work orders produce independent wo-level rows, each with their
// own task and action children.
// ===========================================================================

describe("frd-12: toTimeline — AC-12-003.1 multi-WO fixture nesting", () => {
  const events: Event[] = [
    makeEvent({
      at: "2026-06-16T10:00:00Z",
      workOrder: "WO-001",
      task: "task-a",
      event: "ToolCall",
      status: "ok",
    }),
    makeEvent({
      at: "2026-06-16T10:05:00Z",
      workOrder: "WO-001",
      task: "task-b",
      event: "ToolCall",
      status: "ok",
    }),
    makeEvent({
      at: "2026-06-16T10:10:00Z",
      workOrder: "WO-002",
      task: "task-c",
      event: "AgentWorking",
      status: "ok",
    }),
  ];

  it("frd-12: WHEN events span two workOrders THEN exactly two wo rows are emitted", () => {
    const rows = toTimeline(events);
    const woRows = rows.filter((r) => r.kind === "wo");
    expect(woRows).toHaveLength(2);
  });

  it("frd-12: WHEN events span two workOrders THEN wo rows have labels WO-001 and WO-002", () => {
    const rows = toTimeline(events);
    const woLabels = rows
      .filter((r) => r.kind === "wo")
      .map((r) => r.label)
      .sort();
    expect(woLabels).toStrictEqual(["WO-001", "WO-002"]);
  });

  it("frd-12: WHEN WO-001 has two tasks THEN WO-001 has exactly two task-row children", () => {
    const rows = toTimeline(events);
    const wo001 = findRow(rows, "wo", "WO-001");
    const children = rows.filter((r) => r.kind === "task" && r.parentId === wo001?.id);
    expect(children).toHaveLength(2);
  });

  it("frd-12: WHEN WO-002 has one task THEN WO-002 has exactly one task-row child", () => {
    const rows = toTimeline(events);
    const wo002 = findRow(rows, "wo", "WO-002");
    const children = rows.filter((r) => r.kind === "task" && r.parentId === wo002?.id);
    expect(children).toHaveLength(1);
  });

  it("frd-12: WHEN tasks belong to different WOs THEN their parentIds differ", () => {
    const rows = toTimeline(events);
    const wo001 = findRow(rows, "wo", "WO-001");
    const wo002 = findRow(rows, "wo", "WO-002");
    const taskA = findRow(rows, "task", "task-a");
    const taskC = findRow(rows, "task", "task-c");
    expect(taskA?.parentId).toBe(wo001?.id);
    expect(taskC?.parentId).toBe(wo002?.id);
  });
});

// ===========================================================================
// AC-12-007.1 — DURATION: paired start/end events
// Duration is computed as end - start in milliseconds.
// REQ-12-007: time per work order derived from the same event file.
// ===========================================================================

describe("frd-12: toTimeline — AC-12-007.1 durations computed from event timestamps", () => {
  it("frd-12: WHEN a WO has two events 5 min apart (start + ok end) THEN wo duration is 300000ms", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-X",
        task: "t1",
        event: "Start",
        status: "ok",
      }),
      makeEvent({
        at: "2026-06-16T10:05:00Z",
        workOrder: "WO-X",
        task: "t1",
        event: "End",
        status: "ok",
      }),
    ];
    const rows = toTimeline(events);
    const wo = findRow(rows, "wo", "WO-X");
    expect(wo?.duration).toBe(5 * 60 * 1000); // 300 000 ms
  });

  it("frd-12: WHEN a task has events 2 min apart THEN task duration is 120000ms", () => {
    const events: Event[] = [
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-X", task: "task-t", event: "Start" }),
      makeEvent({
        at: "2026-06-16T10:02:00Z",
        workOrder: "WO-X",
        task: "task-t",
        event: "End",
        status: "ok",
      }),
    ];
    const rows = toTimeline(events);
    const task = findRow(rows, "task", "task-t");
    expect(task?.duration).toBe(2 * 60 * 1000); // 120 000 ms
  });

  it("frd-12: WHEN a wo has only one event THEN duration is 0 (start === end)", () => {
    const events: Event[] = [
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-SINGLE", task: "t1", status: "ok" }),
    ];
    const rows = toTimeline(events);
    const wo = findRow(rows, "wo", "WO-SINGLE");
    expect(wo?.duration).toBe(0);
  });

  it("frd-12: WHEN multiple tasks span different ranges THEN WO duration covers the earliest start to latest end", () => {
    // task-a: 10:00 → 10:03; task-b: 10:05 → 10:10; WO span: 10:00 → 10:10 = 10 min
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-SPAN",
        task: "task-a",
        event: "Start",
      }),
      makeEvent({
        at: "2026-06-16T10:03:00Z",
        workOrder: "WO-SPAN",
        task: "task-a",
        event: "End",
        status: "ok",
      }),
      makeEvent({
        at: "2026-06-16T10:05:00Z",
        workOrder: "WO-SPAN",
        task: "task-b",
        event: "Start",
      }),
      makeEvent({
        at: "2026-06-16T10:10:00Z",
        workOrder: "WO-SPAN",
        task: "task-b",
        event: "End",
        status: "ok",
      }),
    ];
    const rows = toTimeline(events);
    const wo = findRow(rows, "wo", "WO-SPAN");
    expect(wo?.start).toBe("2026-06-16T10:00:00Z");
    expect(wo?.end).toBe("2026-06-16T10:10:00Z");
    expect(wo?.duration).toBe(10 * 60 * 1000); // 600 000 ms
  });

  it("frd-12: WHEN the task has a fail event as the terminal event THEN duration is still computed", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-FAIL",
        task: "t-fail",
        event: "Start",
      }),
      makeEvent({
        at: "2026-06-16T10:04:00Z",
        workOrder: "WO-FAIL",
        task: "t-fail",
        event: "Error",
        status: "fail",
      }),
    ];
    const rows = toTimeline(events);
    const task = findRow(rows, "task", "t-fail");
    expect(task?.duration).toBe(4 * 60 * 1000); // 240 000 ms
    expect(task?.status).toBe("fail");
  });

  it("frd-12: WHEN events arrive out-of-chronological order THEN start is the earliest and end is the latest", () => {
    // Events deliberately in reverse order
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:08:00Z",
        workOrder: "WO-REV",
        task: "t-rev",
        event: "End",
        status: "ok",
      }),
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-REV", task: "t-rev", event: "Start" }),
    ];
    const rows = toTimeline(events);
    const task = findRow(rows, "task", "t-rev");
    expect(task?.start).toBe("2026-06-16T10:00:00Z");
    expect(task?.end).toBe("2026-06-16T10:08:00Z");
    expect(task?.duration).toBe(8 * 60 * 1000);
  });
});

// ===========================================================================
// AC-12-003.1 — IN-PROGRESS (OPEN) DURATIONS
// An unfinished item (no terminal ok/fail event) has end=null, duration=null,
// status="running".
// WO scope: "Tolerate missing end (in-progress) → open duration"
// ===========================================================================

describe("frd-12: toTimeline — AC-12-003.1 in-progress items have null end and duration", () => {
  it("frd-12: WHEN a WO has events with no ok/fail status THEN wo end is null (in-progress)", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-OPEN",
        task: "t-open",
        event: "ToolCall",
        status: undefined,
      }),
    ];
    const rows = toTimeline(events);
    const wo = findRow(rows, "wo", "WO-OPEN");
    expect(wo?.end).toBeNull();
  });

  it("frd-12: WHEN a WO is in-progress THEN wo duration is null", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-OPEN",
        task: "t-open",
        event: "ToolCall",
        status: undefined,
      }),
    ];
    const rows = toTimeline(events);
    const wo = findRow(rows, "wo", "WO-OPEN");
    expect(wo?.duration).toBeNull();
  });

  it("frd-12: WHEN a WO is in-progress THEN wo status is 'running'", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-OPEN",
        task: "t-open",
        event: "AgentWorking",
        status: undefined,
      }),
    ];
    const rows = toTimeline(events);
    const wo = findRow(rows, "wo", "WO-OPEN");
    expect(wo?.status).toBe("running");
  });

  it("frd-12: WHEN a task has no terminal event THEN task end is null, duration is null, status is 'running'", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-X",
        task: "task-running",
        event: "AgentWorking",
        status: undefined,
      }),
    ];
    const rows = toTimeline(events);
    const task = findRow(rows, "task", "task-running");
    expect(task?.end).toBeNull();
    expect(task?.duration).toBeNull();
    expect(task?.status).toBe("running");
  });

  it("frd-12: WHEN one task finishes and another is running THEN each has independent end/status", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-MIX",
        task: "task-done",
        event: "Start",
      }),
      makeEvent({
        at: "2026-06-16T10:02:00Z",
        workOrder: "WO-MIX",
        task: "task-done",
        event: "End",
        status: "ok",
      }),
      makeEvent({
        at: "2026-06-16T10:05:00Z",
        workOrder: "WO-MIX",
        task: "task-open",
        event: "AgentWorking",
        status: undefined,
      }),
    ];
    const rows = toTimeline(events);
    const done = findRow(rows, "task", "task-done");
    const open = findRow(rows, "task", "task-open");
    expect(done?.status).toBe("ok");
    expect(done?.duration).toBe(2 * 60 * 1000);
    expect(open?.status).toBe("running");
    expect(open?.duration).toBeNull();
  });

  it("frd-12: WHEN a WO has mixed finished+running tasks THEN the WO is still 'running' (not fully closed)", () => {
    // A WO is only closed when all its subtree is closed — one open task keeps the WO running.
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-PART",
        task: "task-done",
        event: "End",
        status: "ok",
      }),
      makeEvent({
        at: "2026-06-16T10:05:00Z",
        workOrder: "WO-PART",
        task: "task-open",
        event: "AgentWorking",
        status: undefined,
      }),
    ];
    const rows = toTimeline(events);
    const wo = findRow(rows, "wo", "WO-PART");
    expect(wo?.status).toBe("running");
  });
});

// ===========================================================================
// AC-12-003.1 — ORPHAN ACTIONS (events with no workOrder, or no task)
// WO scope: "Tolerate orphan actions (no task) gracefully."
// Orphan events must not cause a throw; they are surfaced as top-level rows
// or attached to their workOrder when task is absent.
// ===========================================================================

describe("frd-12: toTimeline — AC-12-003.1 orphan events are handled gracefully", () => {
  it("frd-12: WHEN an event has no workOrder and no task THEN toTimeline does NOT throw", () => {
    const events: Event[] = [
      { event: "SomeEvent", at: "2026-06-16T10:00:00Z", agent: "bot", status: "ok" },
    ];
    expect(() => toTimeline(events)).not.toThrow();
  });

  it("frd-12: WHEN an event has no workOrder and no task THEN the orphan row appears in the output", () => {
    const events: Event[] = [
      { event: "SomeEvent", at: "2026-06-16T10:00:00Z", agent: "bot", status: "ok" },
    ];
    const rows = toTimeline(events);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("frd-12: WHEN an orphan event has no workOrder THEN its row's parentId is null", () => {
    const events: Event[] = [
      { event: "GlobalEvent", at: "2026-06-16T10:00:00Z", agent: "bot", status: "ok" },
    ];
    const rows = toTimeline(events);
    const orphan = rows[0];
    expect(orphan?.parentId).toBeNull();
  });

  it("frd-12: WHEN an event has a workOrder but no task THEN it is attached under the WO (not orphaned)", () => {
    const events: Event[] = [
      { event: "DirectAction", at: "2026-06-16T10:00:00Z", workOrder: "WO-NT", status: "ok" },
    ];
    const rows = toTimeline(events);
    const wo = findRow(rows, "wo", "WO-NT");
    const action = rows.find((r) => r.parentId === wo?.id);
    expect(wo).toBeDefined();
    expect(action).toBeDefined();
  });

  it("frd-12: WHEN orphan and normal events are mixed THEN normal tree structure is preserved", () => {
    const events: Event[] = [
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-A", task: "t1", status: "ok" }),
      { event: "Orphan", at: "2026-06-16T10:01:00Z", agent: "bot" }, // no workOrder, no task
    ];
    const rows = toTimeline(events);
    const wo = findRow(rows, "wo", "WO-A");
    expect(wo).toBeDefined();
    expect(wo?.parentId).toBeNull();
  });

  it("frd-12: WHEN many orphan events exist THEN toTimeline does NOT throw and returns an array", () => {
    const events: Event[] = Array.from({ length: 50 }, (_, i) => ({
      event: `Evt-${i}`,
      at: "2026-06-16T10:00:00Z",
    }));
    expect(() => toTimeline(events)).not.toThrow();
    expect(Array.isArray(toTimeline(events))).toBe(true);
  });
});

// ===========================================================================
// AC-12-003.1 — MALFORMED / INCOMPLETE EVENTS
// Events missing required fields (event or at) must be skipped silently.
// Regression: FREEZE-ON-RED (WO-02-004, 2026-06-16).
// ===========================================================================

describe("frd-12: toTimeline — FREEZE-ON-RED regression: malformed events skipped silently", () => {
  it("frd-12: WHEN one event has no at field THEN toTimeline does NOT throw", () => {
    const events = [
      { event: "NoAt" } as unknown as Event,
      makeEvent({ at: "2026-06-16T10:01:00Z", workOrder: "WO-GOOD", task: "t1", status: "ok" }),
    ];
    expect(() => toTimeline(events)).not.toThrow();
  });

  it("frd-12: WHEN one event has no at field THEN the valid event is still processed", () => {
    const events = [
      { event: "NoAt" } as unknown as Event,
      makeEvent({ at: "2026-06-16T10:01:00Z", workOrder: "WO-GOOD", task: "t1", status: "ok" }),
    ];
    const rows = toTimeline(events);
    expect(findRow(rows, "wo", "WO-GOOD")).toBeDefined();
  });

  it("frd-12: WHEN one event has no event field THEN toTimeline does NOT throw", () => {
    const events = [
      { at: "2026-06-16T10:00:00Z" } as unknown as Event,
      makeEvent({ workOrder: "WO-GOOD", task: "t1", status: "ok" }),
    ];
    expect(() => toTimeline(events)).not.toThrow();
  });

  it("frd-12: WHEN the events array contains null-like entries THEN toTimeline does NOT throw", () => {
    // Defensive: the capped tail from lib/events is typed but real-world data may slip through.
    const events = [
      null,
      undefined,
      makeEvent({ workOrder: "WO-SAFE", task: "t1" }),
    ] as unknown as Event[];
    expect(() => toTimeline(events)).not.toThrow();
  });

  it("frd-12: WHEN all events are malformed THEN toTimeline returns [] (not undefined, not throw)", () => {
    const events = [
      { event: "NoAt" } as unknown as Event,
      { at: "2026-06-16T10:00:00Z" } as unknown as Event,
    ];
    const result = toTimeline(events);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ===========================================================================
// B1' REGRESSION — duration must NEVER be NaN
// (WO-13-001, 2026-06-16): Date.parse("bad") === NaN; any arithmetic with NaN
// produces NaN, which would produce a corrupted duration in the row.
// ===========================================================================

describe("frd-12: toTimeline — regression B1': duration is never NaN", () => {
  it("frd-12: WHEN events have valid timestamps THEN all durations are either null or finite numbers", () => {
    const events: Event[] = [
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-A", task: "task-1", status: "ok" }),
      makeEvent({ at: "2026-06-16T10:05:00Z", workOrder: "WO-A", task: "task-1", status: "ok" }),
    ];
    const rows = toTimeline(events);
    for (const row of rows) {
      if (row.duration !== null) {
        expect(Number.isFinite(row.duration)).toBe(true);
      }
    }
  });

  it("frd-12: WHEN an event has an unparseable at value THEN no row has a NaN duration", () => {
    const events: Event[] = [
      { event: "Bad", at: "NOT-A-DATE", workOrder: "WO-BAD", task: "t-bad" } as Event,
      makeEvent({ at: "2026-06-16T10:05:00Z", workOrder: "WO-BAD", task: "t-bad", status: "ok" }),
    ];
    expect(() => toTimeline(events)).not.toThrow();
    const rows = toTimeline(events);
    for (const row of rows) {
      if (row.duration !== null) {
        expect(Number.isFinite(row.duration)).toBe(true);
      }
    }
  });

  it("frd-12: WHEN all events have the same timestamp THEN duration is 0 (not NaN, not negative)", () => {
    const ts = "2026-06-16T10:00:00Z";
    const events: Event[] = [
      makeEvent({ at: ts, workOrder: "WO-SAME", task: "t-same", event: "A", status: "ok" }),
      makeEvent({ at: ts, workOrder: "WO-SAME", task: "t-same", event: "B", status: "ok" }),
    ];
    const rows = toTimeline(events);
    for (const row of rows) {
      if (row.duration !== null) {
        expect(row.duration).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(row.duration)).toBe(true);
      }
    }
  });
});

// ===========================================================================
// I3 REGRESSION — status:"fail" must be the string "fail", not an array or other
// truthy. status="running" iff end is null.
// (WO-13-001, 2026-06-16)
// ===========================================================================

describe("frd-12: toTimeline — regression I3: status values are exactly the string literals", () => {
  it("frd-12: WHEN all events have status='ok' THEN every row's status is the string 'ok' or 'running'", () => {
    const events: Event[] = [
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-OK", task: "t-ok", status: "ok" }),
    ];
    const rows = toTimeline(events);
    for (const row of rows) {
      expect(["ok", "fail", "running"]).toContain(row.status);
    }
  });

  it("frd-12: WHEN a terminal event has status='fail' THEN the row's status is exactly the string 'fail'", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-F",
        task: "t-f",
        event: "Error",
        status: "fail",
      }),
    ];
    const rows = toTimeline(events);
    const wo = findRow(rows, "wo", "WO-F");
    expect(wo?.status).toBe("fail");
  });

  it("frd-12: WHEN end is null THEN status is exactly the string 'running'", () => {
    const events: Event[] = [
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-R", task: "t-r" }),
    ];
    const rows = toTimeline(events);
    const openRows = rows.filter((r) => r.end === null);
    for (const row of openRows) {
      expect(row.status).toBe("running");
    }
  });

  it("frd-12: WHEN end is not null THEN status is NOT 'running'", () => {
    const events: Event[] = [
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-D", task: "t-d", event: "A" }),
      makeEvent({
        at: "2026-06-16T10:01:00Z",
        workOrder: "WO-D",
        task: "t-d",
        event: "B",
        status: "ok",
      }),
    ];
    const rows = toTimeline(events);
    const closedRows = rows.filter((r) => r.end !== null);
    for (const row of closedRows) {
      expect(row.status).not.toBe("running");
    }
  });
});

// ===========================================================================
// ROW SHAPE INVARIANTS — parametric, kills structural mutants
// Every row must have exactly the required fields, with the correct types.
// Kills "return null" / "omit duration" / "forget parentId" mutants.
// ===========================================================================

describe("frd-12: toTimeline — row shape invariants (structural, parametric)", () => {
  const fixtures: Array<{ label: string; events: Event[] }> = [
    {
      label: "single event",
      events: [makeEvent({ workOrder: "WO-A", task: "t-a", status: "ok" })],
    },
    {
      label: "multi-task wo",
      events: [
        makeEvent({
          at: "2026-06-16T10:00:00Z",
          workOrder: "WO-B",
          task: "t-1",
          event: "A",
          status: "ok",
        }),
        makeEvent({
          at: "2026-06-16T10:02:00Z",
          workOrder: "WO-B",
          task: "t-2",
          event: "B",
          status: "ok",
        }),
      ],
    },
    {
      label: "in-progress wo",
      events: [makeEvent({ workOrder: "WO-C", task: "t-c" })],
    },
    {
      label: "orphan action",
      events: [{ event: "Orphan", at: "2026-06-16T10:00:00Z" }],
    },
  ];

  for (const { label, events } of fixtures) {
    describe(`frd-12: fixture "${label}"`, () => {
      it("frd-12: every row has an id field (non-empty string)", () => {
        const rows = toTimeline(events);
        for (const row of rows) {
          expect(typeof row.id).toBe("string");
          expect(row.id.length).toBeGreaterThan(0);
        }
      });

      it("frd-12: every row has a kind field ('wo', 'task', or 'action')", () => {
        const rows = toTimeline(events);
        for (const row of rows) {
          expect(["wo", "task", "action"]).toContain(row.kind);
        }
      });

      it("frd-12: every row has a label field (non-empty string)", () => {
        const rows = toTimeline(events);
        for (const row of rows) {
          expect(typeof row.label).toBe("string");
          expect(row.label.length).toBeGreaterThan(0);
        }
      });

      it("frd-12: every row has a start field (non-empty string)", () => {
        const rows = toTimeline(events);
        for (const row of rows) {
          expect(typeof row.start).toBe("string");
          expect(row.start.length).toBeGreaterThan(0);
        }
      });

      it("frd-12: every row has an end field (string or null, never undefined)", () => {
        const rows = toTimeline(events);
        for (const row of rows) {
          expect(row.end === null || typeof row.end === "string").toBe(true);
        }
      });

      it("frd-12: every row has a duration field (finite number or null, never undefined, never NaN)", () => {
        const rows = toTimeline(events);
        for (const row of rows) {
          const isValid =
            row.duration === null ||
            (typeof row.duration === "number" && Number.isFinite(row.duration));
          expect(isValid).toBe(true);
        }
      });

      it("frd-12: every row has a parentId field (string or null, never undefined)", () => {
        const rows = toTimeline(events);
        for (const row of rows) {
          expect(row.parentId === null || typeof row.parentId === "string").toBe(true);
        }
      });

      it("frd-12: every row has a status field ('ok', 'fail', or 'running')", () => {
        const rows = toTimeline(events);
        for (const row of rows) {
          expect(["ok", "fail", "running"]).toContain(row.status);
        }
      });
    });
  }
});

// ===========================================================================
// TREE LINK INVARIANT — parentId always resolves to a real id in the output
// Kills the "dangling parentId" mutant that emits a parentId pointing to a
// non-existent row (which would break the UI tree renderer).
// ===========================================================================

describe("frd-12: toTimeline — tree link invariant: parentId always resolves to an existing id", () => {
  it("frd-12: WHEN events have wo+task THEN every non-null parentId points to an id that exists in the output", () => {
    const events: Event[] = [
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-LINK", task: "t-1", status: "ok" }),
      makeEvent({ at: "2026-06-16T10:02:00Z", workOrder: "WO-LINK", task: "t-2", status: "ok" }),
    ];
    const rows = toTimeline(events);
    const ids = new Set(allIds(rows));
    for (const row of rows) {
      if (row.parentId !== null) {
        expect(ids.has(row.parentId)).toBe(true);
      }
    }
  });
});

// ===========================================================================
// UNIQUE IDS INVARIANT — no duplicate ids in a single toTimeline call output
// Kills the "reuse same id across rows" mutant which breaks React key uniqueness.
// ===========================================================================

describe("frd-12: toTimeline — unique ids invariant", () => {
  it("frd-12: WHEN events span two WOs each with two tasks THEN all row ids are unique", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-1",
        task: "t-a",
        event: "A",
        status: "ok",
      }),
      makeEvent({
        at: "2026-06-16T10:01:00Z",
        workOrder: "WO-1",
        task: "t-b",
        event: "B",
        status: "ok",
      }),
      makeEvent({
        at: "2026-06-16T10:02:00Z",
        workOrder: "WO-2",
        task: "t-c",
        event: "C",
        status: "ok",
      }),
      makeEvent({
        at: "2026-06-16T10:03:00Z",
        workOrder: "WO-2",
        task: "t-d",
        event: "D",
        status: "ok",
      }),
    ];
    const rows = toTimeline(events);
    const ids = allIds(rows);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ===========================================================================
// CHRONOLOGICAL INVARIANT — start ≤ end whenever end is not null
// Kills the "swap start/end" mutant. duration ≥ 0 when not null.
// ISO offset lesson (factory/memory 2026-06-16): comparison via Date.parse.
// ===========================================================================

describe("frd-12: toTimeline — chronological invariant: start ≤ end, duration ≥ 0", () => {
  it("frd-12: WHEN end is not null THEN Date.parse(end) >= Date.parse(start) for every row", () => {
    const events: Event[] = [
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-CHR", task: "t-chr", event: "Start" }),
      makeEvent({
        at: "2026-06-16T10:05:00Z",
        workOrder: "WO-CHR",
        task: "t-chr",
        event: "End",
        status: "ok",
      }),
    ];
    const rows = toTimeline(events);
    for (const row of rows) {
      if (row.end !== null) {
        expect(Date.parse(row.end)).toBeGreaterThanOrEqual(Date.parse(row.start));
      }
    }
  });

  it("frd-12: WHEN duration is not null THEN duration is >= 0", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-CHR",
        task: "t-chr",
        event: "Start",
        status: "ok",
      }),
      makeEvent({
        at: "2026-06-16T10:03:00Z",
        workOrder: "WO-CHR",
        task: "t-chr",
        event: "End",
        status: "ok",
      }),
    ];
    const rows = toTimeline(events);
    for (const row of rows) {
      if (row.duration !== null) {
        expect(row.duration).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ===========================================================================
// DURATION ↔ END CONSISTENCY INVARIANT
// duration is null iff end is null. Kills "forget to set duration when end is null"
// or "set duration to 0 when end is null" mutants.
// ===========================================================================

describe("frd-12: toTimeline — duration null iff end null invariant", () => {
  it("frd-12: WHEN end is null THEN duration is null (not 0, not NaN)", () => {
    const events: Event[] = [
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-NULL", task: "t-null" }),
    ];
    const rows = toTimeline(events);
    for (const row of rows.filter((r) => r.end === null)) {
      expect(row.duration).toBeNull();
    }
  });

  it("frd-12: WHEN end is a string THEN duration is a finite number (not null)", () => {
    const events: Event[] = [
      makeEvent({ at: "2026-06-16T10:00:00Z", workOrder: "WO-CLOSE", task: "t-close", event: "A" }),
      makeEvent({
        at: "2026-06-16T10:02:00Z",
        workOrder: "WO-CLOSE",
        task: "t-close",
        event: "B",
        status: "ok",
      }),
    ];
    const rows = toTimeline(events);
    for (const row of rows.filter((r) => r.end !== null)) {
      expect(row.duration).not.toBeNull();
      expect(typeof row.duration).toBe("number");
      expect(Number.isFinite(row.duration)).toBe(true);
    }
  });
});

// ===========================================================================
// WO-LEVEL STATUS PROPAGATION
// The status of a WO row is derived from its children:
//   - Any running child → WO is "running"
//   - All children done, any fail → WO is "fail"
//   - All children ok → WO is "ok"
// Kills the "WO always ok" / "WO always running" mutant.
// ===========================================================================

describe("frd-12: toTimeline — WO status propagation from children", () => {
  it("frd-12: WHEN all tasks finish ok THEN WO status is 'ok'", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-ALLOK",
        task: "t-1",
        event: "A",
        status: "ok",
      }),
      makeEvent({
        at: "2026-06-16T10:01:00Z",
        workOrder: "WO-ALLOK",
        task: "t-2",
        event: "B",
        status: "ok",
      }),
    ];
    const rows = toTimeline(events);
    const wo = findRow(rows, "wo", "WO-ALLOK");
    expect(wo?.status).toBe("ok");
  });

  it("frd-12: WHEN at least one task finishes with fail THEN WO status is 'fail'", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-SOMEFAIL",
        task: "t-1",
        event: "A",
        status: "ok",
      }),
      makeEvent({
        at: "2026-06-16T10:02:00Z",
        workOrder: "WO-SOMEFAIL",
        task: "t-2",
        event: "B",
        status: "fail",
      }),
    ];
    const rows = toTimeline(events);
    const wo = findRow(rows, "wo", "WO-SOMEFAIL");
    expect(wo?.status).toBe("fail");
  });

  it("frd-12: WHEN at least one task is still running THEN WO status is 'running' regardless of other tasks", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-RUNNING",
        task: "t-done",
        event: "A",
        status: "ok",
      }),
      makeEvent({
        at: "2026-06-16T10:05:00Z",
        workOrder: "WO-RUNNING",
        task: "t-open",
        event: "B",
        status: undefined,
      }),
    ];
    const rows = toTimeline(events);
    const wo = findRow(rows, "wo", "WO-RUNNING");
    expect(wo?.status).toBe("running");
  });
});

// ===========================================================================
// NEVER THROWS — exhaustive no-throw check across diverse inputs
// Pure functions in the selector layer must never throw under any input.
// ===========================================================================

describe("frd-12: toTimeline — never throws under any input", () => {
  const edgeCases: Array<{ label: string; events: unknown[] }> = [
    { label: "empty array", events: [] },
    { label: "one minimal valid event", events: [makeEvent()] },
    {
      label: "100 events same timestamp",
      events: Array.from({ length: 100 }, (_, i) => makeEvent({ event: `Evt-${i}` })),
    },
    {
      label: "events with no workOrder or task",
      events: [{ event: "X", at: "2026-06-16T10:00:00Z" }],
    },
    {
      label: "events with empty string workOrder",
      events: [makeEvent({ workOrder: "", task: "t" })],
    },
    {
      label: "events with empty string task",
      events: [makeEvent({ workOrder: "WO-1", task: "" })],
    },
    {
      label: "events with invalid at",
      events: [{ event: "Bad", at: "NOT-ISO", workOrder: "WO-1", task: "t" }],
    },
    {
      label: "200 events across 10 WOs",
      events: Array.from({ length: 200 }, (_, i) =>
        makeEvent({
          at: new Date(2026, 5, 16, 10, i % 60).toISOString(),
          workOrder: `WO-${i % 10}`,
          task: `task-${i % 5}`,
          status: i % 3 === 0 ? "ok" : i % 3 === 1 ? "fail" : undefined,
        }),
      ),
    },
  ];

  for (const { label, events } of edgeCases) {
    it(`frd-12: WHEN ${label} THEN toTimeline does NOT throw`, () => {
      expect(() => toTimeline(events as Event[])).not.toThrow();
    });
  }
});

// ===========================================================================
// IDEMPOTENCY — calling toTimeline twice with the same input yields the same
// output shape. Pure function: no hidden mutable state.
// ===========================================================================

describe("frd-12: toTimeline — idempotency (pure, no hidden state)", () => {
  it("frd-12: WHEN called twice with the same events THEN both calls produce equal results", () => {
    const events: Event[] = [
      makeEvent({
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-IDEM",
        task: "t-i",
        event: "A",
        status: "ok",
      }),
      makeEvent({
        at: "2026-06-16T10:05:00Z",
        workOrder: "WO-IDEM",
        task: "t-i",
        event: "B",
        status: "ok",
      }),
    ];
    const first = toTimeline(events);
    const second = toTimeline(events);
    expect(first).toStrictEqual(second);
  });
});
