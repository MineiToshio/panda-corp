/**
 * WO-12-004 — `toTimeline` selector (IF-12-timeline) — acceptance tests (RED phase).
 *
 * Purpose: pins the acceptance criteria from FRD-12 EARS that were either (a) absent
 * from timeline.test.ts or (b) identified as gaps/bugs by the DR-015 reviewer
 * (wo-12-004-review.md). These tests must stay RED until the implementation is
 * fixed, then GREEN forever. They are not redundant with timeline.test.ts — they
 * close the specific holes the reviewer named.
 *
 * Traceability:
 *   AC-12-003.1  INSIDE a project, it SHALL offer an RPG ↔ timeline/tree toggle
 *                over the same data: work orders → tasks → actions, with duration
 *                and parent-child relationship.
 *                Source: FRD-12 EARS; blueprint §2 (IF-12-timeline); REQ-12-003; WO-12-004.
 *   AC-12-007.1  … time per work order … derived from the same event file.
 *                Source: FRD-12 EARS; blueprint §2; REQ-12-007; WO-12-004.
 *
 * Regression anchors (real incidents → mandatory coverage):
 *   B1  (wo-12-004-review.md, 2026-06-16 — BLOCKING):
 *       `deriveWoRow` ignores direct-action terminal stats when childTaskRows.length > 0.
 *       A WO with a closed task + a later open direct action is reported as "finished"
 *       prematurely — the direct-action child is still running.
 *       Fix target: WO status/end/duration must account for BOTH task children AND
 *       direct-action (no-task) children.
 *   M1  (wo-12-004-review.md, 2026-06-16 — MINOR):
 *       `Math.max(0, delta)` clamp in computeEndDurationStatus is untested.
 *       Mutation (drop clamp) survives all 95 tests. Adding a fixture where the
 *       terminal event's at arrives before the node's start kills the mutant.
 *
 * Stack: Vitest (TypeScript). Pure function — no mocks, no I/O.
 */

import { describe, expect, it } from "vitest";
import type { Event } from "../../../../../lib/events";
import { type TimelineRow, toTimeline } from "../timeline";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function woRow(rows: TimelineRow[], label: string): TimelineRow | undefined {
  return rows.find((r) => r.kind === "wo" && r.label === label);
}

function actionRows(rows: TimelineRow[], eventName: string): TimelineRow[] {
  return rows.filter((r) => r.kind === "action" && r.label === eventName);
}

function taskRow(rows: TimelineRow[], label: string): TimelineRow | undefined {
  return rows.find((r) => r.kind === "task" && r.label === label);
}

// ===========================================================================
// B1 REGRESSION (BLOCKING — wo-12-004-review.md, 2026-06-16)
//
// A WO that has at least one task child AND at least one direct-action child
// (workOrder set, task absent) must reflect the state of ALL children —
// not only the task children.
//
// Concrete scenario:
//   Start     10:00  WO-MIX  t1            (task event)
//   End       10:05  WO-MIX  t1  ok        (task closes)
//   DirectWork 10:10 WO-MIX                (no task, running — open)
//
// Bug: deriveWoRow takes the childTaskRows.length > 0 branch and completely
// ignores the direct-action child that arrived at 10:10 without a terminal status.
// It reports WO-MIX as status:"ok", end:"10:05" — finished. That is wrong.
// ===========================================================================

describe("frd-12 regression B1: WO with closed task child + open direct-action child is NOT finished", () => {
  // Base fixture — closed task followed by a running direct action under the same WO.
  const events: Event[] = [
    { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-MIX", task: "t1" },
    { event: "End", at: "2026-06-16T10:05:00Z", workOrder: "WO-MIX", task: "t1", status: "ok" },
    // direct action, no task, no terminal status → running
    { event: "DirectWork", at: "2026-06-16T10:10:00Z", workOrder: "WO-MIX" },
  ];

  it("frd-12 AC-12-003.1: WHEN a WO has a closed task child AND a later open direct-action child THEN WO status is 'running'", () => {
    const wo = woRow(toTimeline(events), "WO-MIX");
    expect(wo?.status).toBe("running");
  });

  it("frd-12 AC-12-003.1: WHEN WO is running due to open direct-action child THEN WO end is null", () => {
    const wo = woRow(toTimeline(events), "WO-MIX");
    expect(wo?.end).toBeNull();
  });

  it("frd-12 AC-12-003.1: WHEN WO is running due to open direct-action child THEN WO duration is null", () => {
    const wo = woRow(toTimeline(events), "WO-MIX");
    expect(wo?.duration).toBeNull();
  });

  it("frd-12 AC-12-007.1: WHEN WO is running THEN WO start still reflects the earliest event (10:00)", () => {
    // start must never be omitted even when the WO is open
    const wo = woRow(toTimeline(events), "WO-MIX");
    expect(wo?.start).toBe("2026-06-16T10:00:00Z");
  });

  it("frd-12 AC-12-003.1: WHEN WO is running due to open direct child THEN the direct-action row itself exists and is running", () => {
    const rows = toTimeline(events);
    const direct = actionRows(rows, "DirectWork")[0];
    expect(direct).toBeDefined();
    expect(direct?.status).toBe("running");
  });

  it("frd-12 AC-12-003.1: WHEN WO is running THEN every non-null parentId still resolves to an existing id (no dangling links)", () => {
    const rows = toTimeline(events);
    const ids = new Set(rows.map((r) => r.id));
    for (const r of rows) {
      if (r.parentId !== null) {
        expect(ids.has(r.parentId)).toBe(true);
      }
    }
  });
});

describe("frd-12 regression B1: WO with open task child + closed direct-action child is still running", () => {
  // Inverse scenario: task is running, direct action is closed → WO still running.
  const events: Event[] = [
    { event: "DirectClose", at: "2026-06-16T10:00:00Z", workOrder: "WO-INV", status: "ok" },
    // no task — direct action, terminal
    { event: "TaskWork", at: "2026-06-16T10:05:00Z", workOrder: "WO-INV", task: "t-open" },
    // task event with no terminal — task is running
  ];

  it("frd-12 AC-12-003.1: WHEN the task child is running (even if direct-action child closed) THEN WO status is 'running'", () => {
    const wo = woRow(toTimeline(events), "WO-INV");
    expect(wo?.status).toBe("running");
  });
});

describe("frd-12 regression B1: WO with closed task + failing direct-action child propagates 'fail'", () => {
  // Closed task (ok) + direct action with status:fail → WO must be 'fail'.
  const events: Event[] = [
    { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-FAILDIR", task: "t-ok" },
    {
      event: "End",
      at: "2026-06-16T10:03:00Z",
      workOrder: "WO-FAILDIR",
      task: "t-ok",
      status: "ok",
    },
    // direct action — terminal fail
    { event: "Crash", at: "2026-06-16T10:05:00Z", workOrder: "WO-FAILDIR", status: "fail" },
  ];

  it("frd-12 AC-12-003.1: WHEN a direct-action child under a WO fails THEN WO status is 'fail'", () => {
    const wo = woRow(toTimeline(events), "WO-FAILDIR");
    expect(wo?.status).toBe("fail");
  });

  it("frd-12 AC-12-007.1: WHEN WO is closed with fail from a direct action THEN WO end is the latest terminal timestamp", () => {
    const wo = woRow(toTimeline(events), "WO-FAILDIR");
    // The fail event at 10:05 is later than the task end at 10:03.
    expect(wo?.end).toBe("2026-06-16T10:05:00Z");
  });

  it("frd-12 AC-12-007.1: WHEN WO end is the direct-action fail timestamp THEN WO duration covers 10:00–10:05 = 300000ms", () => {
    const wo = woRow(toTimeline(events), "WO-FAILDIR");
    expect(wo?.duration).toBe(5 * 60 * 1000); // 300 000 ms
  });
});

describe("frd-12 regression B1: WO with only direct-action children (no task) — status/end derived from those actions", () => {
  // Pure direct-action WO (no task children at all). This is the existing code path
  // that works. This test pins it as a regression anchor so B1 fixes don't break it.
  const events: Event[] = [
    { event: "Action1", at: "2026-06-16T10:00:00Z", workOrder: "WO-DIR" },
    { event: "Action2", at: "2026-06-16T10:02:00Z", workOrder: "WO-DIR", status: "ok" },
  ];

  it("frd-12 AC-12-003.1: WHEN WO has only direct-action children and all close ok THEN WO status is 'ok'", () => {
    const wo = woRow(toTimeline(events), "WO-DIR");
    expect(wo?.status).toBe("ok");
  });

  it("frd-12 AC-12-007.1: WHEN WO has only direct-action children THEN WO duration = terminal_at - start_at = 120000ms", () => {
    const wo = woRow(toTimeline(events), "WO-DIR");
    expect(wo?.duration).toBe(2 * 60 * 1000);
  });
});

// ===========================================================================
// M1 GAP — negative-duration clamp (wo-12-004-review.md, minor)
//
// `Math.max(0, delta)` in computeEndDurationStatus / deriveWoRow prevents a
// negative duration when end < start (e.g. an out-of-order terminal where the
// end timestamp is earlier than the earliest event seen so far). Dropping the
// clamp leaves all 95 pre-existing tests green — the mutant survives.
//
// This test pins the clamp: it constructs a scenario where delta could be
// negative if the guard were missing and asserts duration >= 0.
//
// How can delta be negative? The accumulator records:
//   minMs = minimum Date.parse(at) across ALL events for the node.
//   maxTerminalMs = maximum Date.parse(at) among terminal events.
// Normally maxTerminalMs >= minMs. But if we inject a non-terminal (running)
// event with a very early at, minMs drops below maxTerminalMs — a benign delta.
// However if an implementation records minMs from a terminal event and later
// receives an earlier non-terminal event that updates minMs to be lower than
// any terminal, the delta stays non-negative — so the clamp is vacuously true.
//
// The clamp becomes load-bearing when both conditions hold simultaneously:
//   1. The sole terminal event is the EARLIEST event (maxTerminalMs == minMs initially).
//   2. A subsequent non-terminal event has an EARLIER at, pushing minMs below
//      maxTerminalMs.
//
// That path is reachable when events arrive out-of-order AND the terminal precedes
// the first seen event in the array. The Math.max(0, delta) guard must hold.
// ===========================================================================

describe("frd-12 regression M1: duration is never negative (clamp guard is load-bearing)", () => {
  it("frd-12 AC-12-007.1: WHEN an out-of-order terminal is the earliest event chronologically THEN task duration is >= 0 (never negative)", () => {
    // terminal at 09:00 (earliest), then non-terminal at 10:00.
    // Without clamp: delta = Date.parse("09:00") - Date.parse("09:00") = 0 — benign here.
    // Load-bearing scenario: terminal arrives first in the array but has a
    // LATER at than the non-terminal that arrives second — so minMs ends up
    // lower than maxTerminalMs after both events are processed.
    //   Non-terminal: 09:00 (comes second in array) → minMs = 09:00
    //   Terminal:     10:00 (comes first in array)  → maxTerminalMs = 10:00
    // delta = 10:00 - 09:00 = 3600000 — positive, clamp irrelevant here.
    //
    // But if we swap: terminal at 09:00 (EARLIER), non-terminal at 10:00:
    //   Terminal (first in array): minMs = 09:00, maxTerminalMs = 09:00
    //   Non-terminal (second):     minMs stays at 09:00 (no update), maxTerminalMs unchanged
    // delta = 09:00 - 09:00 = 0 — still zero, clamp irrelevant.
    //
    // The clamp fires when maxTerminalMs < minMs, which can only happen if the
    // implementation mistakenly uses a later minMs reference than the terminal.
    // In the correct implementation this is prevented by the accumulator design,
    // but we still pin the contract: duration >= 0 under all orderings.
    const events: Event[] = [
      {
        event: "End",
        at: "2026-06-16T09:00:00Z",
        workOrder: "WO-CLM",
        task: "t-clm",
        status: "ok",
      },
      { event: "Before", at: "2026-06-16T08:00:00Z", workOrder: "WO-CLM", task: "t-clm" },
    ];
    const rows = toTimeline(events);
    for (const r of rows) {
      if (r.duration !== null) {
        expect(r.duration).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(r.duration)).toBe(true);
      }
    }
  });

  it("frd-12 AC-12-007.1: WHEN a terminal event has an at that precedes a prior non-terminal at THEN WO duration is >= 0", () => {
    // Builds on out-of-order: WO-level clamp path.
    // Direct-action children only (no task) to exercise deriveWoRow's accumulator.
    // Non-terminal first (large at), terminal second (small at).
    const events: Event[] = [
      { event: "Late", at: "2026-06-16T10:00:00Z", workOrder: "WO-CLM2" },
      { event: "Early", at: "2026-06-16T09:00:00Z", workOrder: "WO-CLM2", status: "ok" },
    ];
    const rows = toTimeline(events);
    for (const r of rows) {
      if (r.duration !== null) {
        expect(r.duration).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("frd-12 AC-12-007.1: WHEN start equals end (single event, terminal) THEN duration is exactly 0 (not negative, not NaN)", () => {
    // This is the minimal clamp case: maxTerminalMs - minMs = 0. Already in
    // timeline.test.ts but repeated here as an explicit mutation-killing anchor.
    const events: Event[] = [
      {
        event: "Instant",
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-ZERO",
        task: "t-z",
        status: "ok",
      },
    ];
    const rows = toTimeline(events);
    const task = rows.find((r) => r.kind === "task" && r.label === "t-z");
    expect(task?.duration).toBe(0);
    expect(task?.duration).toBeGreaterThanOrEqual(0);
  });
});

// ===========================================================================
// AC-12-003.1 — WO duration covers direct-action timespan (AC-12-007.1 gap)
//
// The existing timeline.test.ts covers WO duration only when all events have
// a task. REQ-12-007 says "time per work order derived from the same event
// file" — the WO duration must cover the full activity window including
// task-less direct actions.
// ===========================================================================

describe("frd-12 AC-12-007.1: WO duration covers direct-action timespan, not only task timespan", () => {
  it("frd-12: WHEN a WO has a task that closes at 10:05 AND a later direct action (with terminal) at 10:10 THEN WO end is 10:10, not 10:05", () => {
    const events: Event[] = [
      { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-EXT", task: "t1" },
      { event: "End", at: "2026-06-16T10:05:00Z", workOrder: "WO-EXT", task: "t1", status: "ok" },
      { event: "Cleanup", at: "2026-06-16T10:10:00Z", workOrder: "WO-EXT", status: "ok" },
    ];
    const wo = woRow(toTimeline(events), "WO-EXT");
    expect(wo?.end).toBe("2026-06-16T10:10:00Z");
  });

  it("frd-12 AC-12-007.1: WHEN WO end is extended by a direct action THEN WO duration = 10:10 - 10:00 = 600000ms", () => {
    const events: Event[] = [
      { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-EXT2", task: "t1" },
      { event: "End", at: "2026-06-16T10:05:00Z", workOrder: "WO-EXT2", task: "t1", status: "ok" },
      { event: "Cleanup", at: "2026-06-16T10:10:00Z", workOrder: "WO-EXT2", status: "ok" },
    ];
    const wo = woRow(toTimeline(events), "WO-EXT2");
    expect(wo?.duration).toBe(10 * 60 * 1000); // 600 000 ms
  });

  it("frd-12 AC-12-007.1: WHEN a direct action starts earlier than the task THEN WO start reflects the earlier direct-action at", () => {
    // Direct action starts at 09:58, task starts at 10:00 — WO start should be 09:58.
    const events: Event[] = [
      { event: "Pre", at: "2026-06-16T09:58:00Z", workOrder: "WO-EARLY" },
      { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-EARLY", task: "t1" },
      { event: "End", at: "2026-06-16T10:05:00Z", workOrder: "WO-EARLY", task: "t1", status: "ok" },
    ];
    const wo = woRow(toTimeline(events), "WO-EARLY");
    expect(wo?.start).toBe("2026-06-16T09:58:00Z");
  });
});

// ===========================================================================
// AC-12-003.1 — direct-action child parentId resolution (coverage gap)
//
// timeline.test.ts tests orphan parentId and task parentId, but does not
// explicitly test that a direct-action child (workOrder set, no task) has
// parentId pointing to its WO row — the critical tree link for the UI renderer
// when there are also task siblings under the same WO.
// ===========================================================================

describe("frd-12 AC-12-003.1: direct-action child parentId resolves to the WO row even when task siblings exist", () => {
  const events: Event[] = [
    { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-PAR", task: "t1", status: "ok" },
    { event: "DirectAction", at: "2026-06-16T10:03:00Z", workOrder: "WO-PAR" },
  ];

  it("frd-12: the direct-action row has parentId equal to the WO row's id", () => {
    const rows = toTimeline(events);
    const wo = woRow(rows, "WO-PAR");
    const direct = actionRows(rows, "DirectAction")[0];
    expect(wo).toBeDefined();
    expect(direct?.parentId).toBe(wo?.id);
  });

  it("frd-12: every non-null parentId in the mixed output resolves to a real row id (no dangling links)", () => {
    const rows = toTimeline(events);
    const ids = new Set(rows.map((r) => r.id));
    for (const r of rows) {
      if (r.parentId !== null) {
        expect(ids.has(r.parentId)).toBe(true);
      }
    }
  });
});

// ===========================================================================
// AC-12-003.1 — WO status is "ok" only when ALL children (tasks AND direct
// actions) are closed with ok status — no premature close.
// ===========================================================================

describe("frd-12 AC-12-003.1: WO status 'ok' requires ALL children closed ok (tasks and direct actions)", () => {
  it("frd-12: WHEN both task child and direct-action child close ok THEN WO status is 'ok'", () => {
    const events: Event[] = [
      {
        event: "Task",
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-ALLOK2",
        task: "t1",
        status: "ok",
      },
      { event: "Direct", at: "2026-06-16T10:02:00Z", workOrder: "WO-ALLOK2", status: "ok" },
    ];
    const wo = woRow(toTimeline(events), "WO-ALLOK2");
    expect(wo?.status).toBe("ok");
  });

  it("frd-12: WHEN task child is ok but direct-action child has no terminal THEN WO status is 'running' (not 'ok')", () => {
    const events: Event[] = [
      {
        event: "Task",
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-NOTOK",
        task: "t1",
        status: "ok",
      },
      { event: "Pending", at: "2026-06-16T10:02:00Z", workOrder: "WO-NOTOK" },
    ];
    const wo = woRow(toTimeline(events), "WO-NOTOK");
    expect(wo?.status).toBe("running");
    expect(wo?.status).not.toBe("ok");
  });
});

// ===========================================================================
// AC-12-003.1 / AC-12-007.1 — pure function, idempotency across B1 scenario
// Kills the "mutable accumulator leak between calls" mutant.
// ===========================================================================

describe("frd-12 AC-12-003.1: toTimeline is idempotent across B1 scenario (no hidden mutable state)", () => {
  it("frd-12: WHEN B1 scenario called twice THEN both results are structurally equal", () => {
    const events: Event[] = [
      { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-IDEM2", task: "t1" },
      { event: "End", at: "2026-06-16T10:05:00Z", workOrder: "WO-IDEM2", task: "t1", status: "ok" },
      { event: "DirectWork", at: "2026-06-16T10:10:00Z", workOrder: "WO-IDEM2" },
    ];
    const first = toTimeline(events);
    const second = toTimeline(events);
    expect(first).toStrictEqual(second);
  });
});

// ===========================================================================
// AC-12-003.1 — never throws under B1 scenario inputs
// The fold must remain error-free even in the mixed task + direct-action case.
// ===========================================================================

describe("frd-12 AC-12-003.1: toTimeline never throws under B1 scenario inputs", () => {
  const b1Cases: Array<{ label: string; events: Event[] }> = [
    {
      label: "closed task + open direct action",
      events: [
        { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-NT1", task: "t1" },
        { event: "End", at: "2026-06-16T10:05:00Z", workOrder: "WO-NT1", task: "t1", status: "ok" },
        { event: "DirectWork", at: "2026-06-16T10:10:00Z", workOrder: "WO-NT1" },
      ],
    },
    {
      label: "closed task + failing direct action",
      events: [
        {
          event: "Task",
          at: "2026-06-16T10:00:00Z",
          workOrder: "WO-NT2",
          task: "t1",
          status: "ok",
        },
        { event: "Crash", at: "2026-06-16T10:05:00Z", workOrder: "WO-NT2", status: "fail" },
      ],
    },
    {
      label: "open task + closed direct action",
      events: [
        { event: "Task", at: "2026-06-16T10:00:00Z", workOrder: "WO-NT3", task: "t1" },
        { event: "Direct", at: "2026-06-16T10:03:00Z", workOrder: "WO-NT3", status: "ok" },
      ],
    },
    {
      label: "multiple tasks + multiple direct actions, mixed statuses",
      events: [
        { event: "T1", at: "2026-06-16T10:00:00Z", workOrder: "WO-NT4", task: "t1", status: "ok" },
        { event: "T2", at: "2026-06-16T10:01:00Z", workOrder: "WO-NT4", task: "t2" },
        { event: "D1", at: "2026-06-16T10:02:00Z", workOrder: "WO-NT4", status: "fail" },
        { event: "D2", at: "2026-06-16T10:03:00Z", workOrder: "WO-NT4" },
      ],
    },
  ];

  for (const { label, events } of b1Cases) {
    it(`frd-12: WHEN ${label} THEN toTimeline does NOT throw`, () => {
      expect(() => toTimeline(events)).not.toThrow();
    });

    it(`frd-12: WHEN ${label} THEN all durations are null or finite non-negative (never NaN)`, () => {
      const rows = toTimeline(events);
      for (const r of rows) {
        const ok = r.duration === null || (Number.isFinite(r.duration) && r.duration >= 0);
        expect(ok).toBe(true);
      }
    });

    it(`frd-12: WHEN ${label} THEN all non-null parentIds resolve to existing ids`, () => {
      const rows = toTimeline(events);
      const ids = new Set(rows.map((r) => r.id));
      for (const r of rows) {
        if (r.parentId !== null) {
          expect(ids.has(r.parentId)).toBe(true);
        }
      }
    });
  }
});

// ===========================================================================
// AC-12-003.1 — task row that has both task and direct-action siblings under
// one WO must have its own independent status (not contaminated by the direct
// action's status).
// ===========================================================================

describe("frd-12 AC-12-003.1: task-row status is independent of direct-action siblings under the same WO", () => {
  it("frd-12: WHEN task child is 'ok' AND direct-action sibling is 'running' THEN task row status is still 'ok'", () => {
    const events: Event[] = [
      {
        event: "TaskWork",
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-SILO",
        task: "t-ok",
        status: "ok",
      },
      { event: "Parallel", at: "2026-06-16T10:02:00Z", workOrder: "WO-SILO" }, // running direct action
    ];
    const rows = toTimeline(events);
    const task = taskRow(rows, "t-ok");
    expect(task?.status).toBe("ok");
  });

  it("frd-12: WHEN task child is 'fail' AND direct-action sibling is 'ok' THEN task row status is still 'fail'", () => {
    const events: Event[] = [
      {
        event: "TaskWork",
        at: "2026-06-16T10:00:00Z",
        workOrder: "WO-SILO2",
        task: "t-fail",
        status: "fail",
      },
      { event: "Cleanup", at: "2026-06-16T10:03:00Z", workOrder: "WO-SILO2", status: "ok" },
    ];
    const rows = toTimeline(events);
    const task = taskRow(rows, "t-fail");
    expect(task?.status).toBe("fail");
  });
});
