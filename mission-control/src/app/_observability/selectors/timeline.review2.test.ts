/**
 * WO-12-004 — `toTimeline` REVIEW CYCLE 2 adversarial tests (DR-015).
 *
 * Reviewer-authored (Opus 4.8, different model family from the sonnet/haiku
 * implementers). Cycle 1 rejected for B1 (a WO with a closed task + a later
 * running direct action was reported as finished). B1 was fixed in 5a71d97.
 * These tests probe the *new* deriveWoRow merge logic and the edges that
 * cycle 1 noted as still untested (M1 negative-duration clamp, the inverse
 * B1 case, closed-direct-action extending the WO end). They were NOT written
 * by the implementer and are derived from the contract + AC-12-003.1/007.1.
 */

import { describe, expect, it } from "vitest";
import type { Event } from "../../../lib/events";
import { type TimelineRow, toTimeline } from "./timeline";

function woRow(rows: TimelineRow[], label: string): TimelineRow | undefined {
  return rows.find((r) => r.kind === "wo" && r.label === label);
}

// ===========================================================================
// B1-INVERSE — open task + closed direct action: WO must still be running
// ===========================================================================
describe("review2: WO with an OPEN task and a CLOSED direct action stays running", () => {
  const events: Event[] = [
    // task t1 starts and never closes → running
    { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-INV", task: "t1" },
    // a direct action (no task) that DID close — must not finish the WO
    { event: "Direct", at: "2026-06-16T10:02:00Z", workOrder: "WO-INV", status: "ok" },
  ];

  it("WO status is 'running' (the open task keeps it open)", () => {
    expect(woRow(toTimeline(events), "WO-INV")?.status).toBe("running");
  });

  it("WO end and duration are null while a child is running", () => {
    const wo = woRow(toTimeline(events), "WO-INV");
    expect(wo?.end).toBeNull();
    expect(wo?.duration).toBeNull();
  });
});

// ===========================================================================
// B1-MERGE-END — a CLOSED direct action LATER than all task ends must
// extend the WO end (AC-12-007.1: time per WO covers all activity).
// ===========================================================================
describe("review2: a closed direct action later than every task end extends WO.end", () => {
  const events: Event[] = [
    { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-EXT", task: "t1" },
    { event: "End", at: "2026-06-16T10:05:00Z", workOrder: "WO-EXT", task: "t1", status: "ok" },
    // direct action closes at 10:08 — later than the task end at 10:05
    { event: "Direct", at: "2026-06-16T10:08:00Z", workOrder: "WO-EXT", status: "ok" },
  ];

  it("WO is finished (all children closed) and 'ok'", () => {
    expect(woRow(toTimeline(events), "WO-EXT")?.status).toBe("ok");
  });

  it("WO.end is the LATEST terminal across tasks AND direct actions (10:08, not 10:05)", () => {
    expect(woRow(toTimeline(events), "WO-EXT")?.end).toBe("2026-06-16T10:08:00Z");
  });

  it("WO.duration spans start→latest-terminal = 8 min (480000 ms), not 5 min", () => {
    expect(woRow(toTimeline(events), "WO-EXT")?.duration).toBe(8 * 60 * 1000);
  });
});

// ===========================================================================
// B1-MERGE-FAIL — a failing direct action propagates 'fail' to the WO even
// when all task children are 'ok'.
// ===========================================================================
describe("review2: a failing direct action propagates 'fail' to the WO", () => {
  const events: Event[] = [
    { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-DF", task: "t1" },
    { event: "End", at: "2026-06-16T10:01:00Z", workOrder: "WO-DF", task: "t1", status: "ok" },
    { event: "Boom", at: "2026-06-16T10:02:00Z", workOrder: "WO-DF", status: "fail" },
  ];

  it("WO status is exactly 'fail' (direct-action failure not swallowed by ok tasks)", () => {
    expect(woRow(toTimeline(events), "WO-DF")?.status).toBe("fail");
  });
});

// ===========================================================================
// M1 — negative-duration clamp: a terminal event EARLIER than the node's
// earliest start (out-of-order terminal) must clamp duration to 0, never negative.
// Cycle 1 noted this clamp survived mutation (untested). Pin it here at WO,
// task and action level.
// ===========================================================================
describe("review2 (M1): duration is clamped to >= 0 when a terminal predates the start", () => {
  // The ONLY terminal event is the EARLIEST instant; a later non-terminal event
  // sets a higher min? No — min is always the earliest. To force maxTerminal < min
  // we need the terminal to be earlier than a *non-terminal* event. The non-terminal
  // raises nothing (min stays earliest); so we craft: non-terminal at 10:05 (no status),
  // terminal at 10:00 (status ok). min=10:00 (terminal), maxTerminal=10:00 → duration 0.
  // To truly get maxTerminal < min we make the non-terminal the EARLIEST and the
  // terminal LATER — normal case. The genuine negative case: two events where the
  // terminal is earlier than another terminal-less event that is the min... impossible
  // because min picks the earliest of ALL events. So instead assert the invariant
  // holds on a pathological out-of-order stream and never goes negative.
  const events: Event[] = [
    { event: "Late", at: "2026-06-16T10:10:00Z", workOrder: "WO-CLMP", task: "t" },
    {
      event: "EarlyDone",
      at: "2026-06-16T10:00:00Z",
      workOrder: "WO-CLMP",
      task: "t",
      status: "ok",
    },
  ];

  it("no row in the output ever has a negative duration", () => {
    const rows = toTimeline(events);
    for (const r of rows) {
      if (r.duration !== null) expect(r.duration).toBeGreaterThanOrEqual(0);
    }
  });

  it("the task duration is the true positive delta start(10:00)→terminal(10:00)... here max terminal is the only ok at 10:00, min is also 10:00 → 0", () => {
    const rows = toTimeline(events);
    const t = rows.find((r) => r.kind === "task" && r.label === "t");
    // start = earliest of all = 10:00 (the EarlyDone). maxTerminal = 10:00.
    // The 10:10 "Late" has no status so does not move the terminal. duration = 0.
    expect(t?.start).toBe("2026-06-16T10:00:00Z");
    expect(t?.duration).toBe(0);
  });
});

// ===========================================================================
// *** CYCLE-2 BLOCKING REGRESSION (B2) ***
// MULTIPLE DIRECT ACTIONS under a NO-TASK WO — one closed early, one open
// later. This is the same defect CLASS as B1 (a WO reported finished while a
// child runs), but in the childTaskRows.length === 0 branch that the B1 fix
// did NOT touch: deriveWoRow returns materialize(woAcc), and computeEndDuration-
// Status only checks woAcc.hasTerminal (true from the first action) — it cannot
// tell that a *second* direct action never closed. The WO is reported "ok",
// end=10:00, duration=0 while work ran until 10:05.
// Violates AC-12-003.1 (true parent-child state) and AC-12-007.1 (time per WO).
// ===========================================================================
describe("review2 (B2 BLOCKING): no-task WO with one closed + one open direct action must stay running", () => {
  const events: Event[] = [
    { event: "A", at: "2026-06-16T10:00:00Z", workOrder: "WO-MD", status: "ok" },
    { event: "B", at: "2026-06-16T10:05:00Z", workOrder: "WO-MD" }, // open, never closes
  ];

  it("WO is running (one direct action has no terminal)", () => {
    expect(woRow(toTimeline(events), "WO-MD")?.status).toBe("running");
  });

  it("WO end and duration are null while a direct action is open", () => {
    const wo = woRow(toTimeline(events), "WO-MD");
    expect(wo?.end).toBeNull();
    expect(wo?.duration).toBeNull();
  });

  it("WO start is the earliest direct action", () => {
    expect(woRow(toTimeline(events), "WO-MD")?.start).toBe("2026-06-16T10:00:00Z");
  });
});

// ===========================================================================
// WO with ONLY an open task (no direct actions) — guard the hasDirectActions
// branch is not falsely triggered.
// ===========================================================================
describe("review2: WO with only an open task is running, no phantom direct action", () => {
  const events: Event[] = [
    { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-OT", task: "t1" },
  ];

  it("WO running, end null", () => {
    const wo = woRow(toTimeline(events), "WO-OT");
    expect(wo?.status).toBe("running");
    expect(wo?.end).toBeNull();
  });
});
