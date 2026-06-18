/**
 * WO-12-004 — `toTimeline` ADVERSARIAL review tests (DR-015).
 *
 * Reviewer-authored (Opus 4.8, different model family from the sonnet/haiku
 * implementers). These are edge cases / abuse cases the implementer did NOT
 * cover in timeline.test.ts, derived from the EARS criteria, the contract in
 * timeline.ts, and real bugs in .pandacorp/comms/progress.md.
 *
 * Focus areas (gaps found by reading the implementation):
 *   A. Mixed children under one WO: a closed task + a *direct action* (no task)
 *      that is later/running. deriveWoRow() ignores direct-action terminal stats
 *      whenever childTaskRows.length > 0 — does the WO still reflect the open
 *      direct action, and does the chronological invariant hold?
 *   B. Same task label reused across two different work orders must not collapse
 *      into one task row (task key is `${wo}:${task}`).
 *   C. ISO offset lesson: non-UTC offsets must be compared numerically, not
 *      lexicographically, for start/end/duration of WO and task rows.
 *   D. status:"fail" propagation when a fail and an ok terminal coexist.
 *   E. Out-of-order arrival (events not pre-sorted by `at`).
 *   F. B1' / I3 abuse: status as array, at as number, workOrder as number.
 *   G. parentId resolution for direct-action children of a WO (parent is the WO).
 */

import { describe, expect, it } from "vitest";
import type { Event } from "../../../../../lib/events";
import { type TimelineRow, toTimeline } from "../timeline";

function woRow(rows: TimelineRow[], label: string): TimelineRow | undefined {
  return rows.find((r) => r.kind === "wo" && r.label === label);
}
function taskRows(rows: TimelineRow[], label: string): TimelineRow[] {
  return rows.filter((r) => r.kind === "task" && r.label === label);
}

// ===========================================================================
// A. MIXED CHILDREN — closed task + open direct action under same WO
// ===========================================================================

describe("adversarial: WO with a closed task AND a later open direct action", () => {
  // A WO that has one finished task, plus a direct action (no task) that is
  // still running and happens AFTER the task closed. The WO is NOT actually
  // finished — work is still in flight under it.
  const events: Event[] = [
    { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-MIX", task: "t1" },
    { event: "End", at: "2026-06-16T10:05:00Z", workOrder: "WO-MIX", task: "t1", status: "ok" },
    // direct action under the WO, no task, no terminal status → running
    { event: "DirectWork", at: "2026-06-16T10:10:00Z", workOrder: "WO-MIX" },
  ];

  it("the WO start reflects the earliest event across all children", () => {
    const wo = woRow(toTimeline(events), "WO-MIX");
    expect(wo?.start).toBe("2026-06-16T10:00:00Z");
  });

  it("chronological invariant: if WO.end is set it must be >= WO.start and >= every reported activity it covers", () => {
    const wo = woRow(toTimeline(events), "WO-MIX");
    expect(wo).toBeDefined();
    if (wo?.end !== null && wo?.end !== undefined) {
      // end must not silently predate the latest known activity under the WO
      // (the open direct action at 10:10). If the impl reports the WO as
      // closed at the task end (10:05) while a direct action ran at 10:10,
      // that is a misleading "finished" timeline for in-flight work.
      expect(Date.parse(wo.end)).toBeGreaterThanOrEqual(Date.parse("2026-06-16T10:10:00Z"));
    }
  });
});

// ===========================================================================
// B. SAME TASK LABEL ACROSS TWO DIFFERENT WORK ORDERS
// ===========================================================================

describe("adversarial: identical task label under two different work orders", () => {
  const events: Event[] = [
    { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-A", task: "build" },
    { event: "Done", at: "2026-06-16T10:01:00Z", workOrder: "WO-A", task: "build", status: "ok" },
    { event: "Start", at: "2026-06-16T10:02:00Z", workOrder: "WO-B", task: "build" },
    { event: "Done", at: "2026-06-16T10:03:00Z", workOrder: "WO-B", task: "build", status: "ok" },
  ];

  it("emits TWO distinct task rows (one per WO) even though the label collides", () => {
    expect(taskRows(toTimeline(events), "build")).toHaveLength(2);
  });

  it("each 'build' task row points to the correct parent WO", () => {
    const rows = toTimeline(events);
    const a = woRow(rows, "WO-A");
    const b = woRow(rows, "WO-B");
    const parents = new Set(taskRows(rows, "build").map((t) => t.parentId));
    expect(parents.has(a?.id ?? "")).toBe(true);
    expect(parents.has(b?.id ?? "")).toBe(true);
  });
});

// ===========================================================================
// C. ISO OFFSET LESSON — non-UTC offsets compared numerically
// ===========================================================================

describe("adversarial: non-UTC offsets must compare by instant, not lexicographically", () => {
  // 10:00:00+02:00 == 08:00:00Z (earlier instant) ; 09:00:00Z is later.
  // Lexicographically "10:00:00+02:00" > "09:00:00Z", which is the WRONG order.
  const events: Event[] = [
    { event: "Start", at: "2026-06-16T10:00:00+02:00", workOrder: "WO-TZ", task: "t" },
    { event: "End", at: "2026-06-16T09:00:00Z", workOrder: "WO-TZ", task: "t", status: "ok" },
  ];

  it("task start is the EARLIER instant (the +02:00 = 08:00Z one)", () => {
    const t = taskRows(toTimeline(events), "t")[0];
    expect(t?.start).toBe("2026-06-16T10:00:00+02:00");
  });

  it("task duration is the true instant delta (3600000 ms = 1h), never negative, never NaN", () => {
    const t = taskRows(toTimeline(events), "t")[0];
    expect(t?.duration).toBe(60 * 60 * 1000);
  });
});

// ===========================================================================
// D. FAIL + OK TERMINALS COEXIST — fail must win at task and WO level
// ===========================================================================

describe("adversarial: a failing terminal among ok terminals propagates 'fail'", () => {
  const events: Event[] = [
    { event: "Try", at: "2026-06-16T10:00:00Z", workOrder: "WO-F", task: "t", status: "ok" },
    { event: "Try", at: "2026-06-16T10:01:00Z", workOrder: "WO-F", task: "t", status: "fail" },
  ];

  it("task status is exactly 'fail' (string literal, not truthy cast — I3)", () => {
    const t = taskRows(toTimeline(events), "t")[0];
    expect(t?.status).toBe("fail");
  });

  it("WO status propagates to 'fail'", () => {
    expect(woRow(toTimeline(events), "WO-F")?.status).toBe("fail");
  });
});

// ===========================================================================
// E. OUT-OF-ORDER ARRIVAL — events not pre-sorted by `at`
// ===========================================================================

describe("adversarial: events arriving out of chronological order", () => {
  const events: Event[] = [
    { event: "End", at: "2026-06-16T10:05:00Z", workOrder: "WO-O", task: "t", status: "ok" },
    { event: "Start", at: "2026-06-16T10:00:00Z", workOrder: "WO-O", task: "t" },
  ];

  it("start is the min instant regardless of array order", () => {
    expect(taskRows(toTimeline(events), "t")[0]?.start).toBe("2026-06-16T10:00:00Z");
  });

  it("duration is computed end - start = 300000 ms, never negative", () => {
    const d = taskRows(toTimeline(events), "t")[0]?.duration;
    expect(d).toBe(5 * 60 * 1000);
    expect(d).toBeGreaterThanOrEqual(0);
  });
});

// ===========================================================================
// F. ABUSE / I3 / B1' — non-string scalars where strings are expected
// ===========================================================================

describe("adversarial: abusive field types must not corrupt the fold", () => {
  it("status as an array is treated as non-terminal (never coerced to 'fail')", () => {
    const events = [
      { event: "X", at: "2026-06-16T10:00:00Z", workOrder: "WO-Z", task: "t", status: ["fail"] },
    ] as unknown as Event[];
    const rows = toTimeline(events);
    const t = taskRows(rows, "t")[0];
    // No terminal status → running, end null, duration null.
    expect(t?.status).toBe("running");
    expect(t?.end).toBeNull();
    expect(t?.duration).toBeNull();
  });

  it("workOrder as a number does NOT create a WO node (string-typed key required)", () => {
    const events = [
      { event: "X", at: "2026-06-16T10:00:00Z", workOrder: 123, task: "t", status: "ok" },
    ] as unknown as Event[];
    const rows = toTimeline(events);
    expect(rows.find((r) => r.kind === "wo")).toBeUndefined();
  });

  it("at as a number is rejected (skipped) — no NaN duration leaks", () => {
    const events = [
      { event: "X", at: 1718532000000, workOrder: "WO-N", task: "t", status: "ok" },
    ] as unknown as Event[];
    const rows = toTimeline(events);
    for (const r of rows) {
      expect(r.duration === null || Number.isFinite(r.duration)).toBe(true);
    }
  });
});

// ===========================================================================
// G. DIRECT-ACTION CHILD OF A WO — parentId must resolve to the WO row
// ===========================================================================

describe("adversarial: direct action (workOrder, no task) parents to the WO row", () => {
  const events: Event[] = [
    { event: "DirectAction", at: "2026-06-16T10:00:00Z", workOrder: "WO-D", status: "ok" },
  ];

  it("the action row's parentId resolves to an emitted WO row id", () => {
    const rows = toTimeline(events);
    const wo = woRow(rows, "WO-D");
    const action = rows.find((r) => r.kind === "action");
    expect(action?.parentId).toBe(wo?.id);
  });

  it("every parentId in the output resolves to an existing id or is null (no dangling links)", () => {
    const rows = toTimeline(events);
    const ids = new Set(rows.map((r) => r.id));
    for (const r of rows) {
      if (r.parentId !== null) expect(ids.has(r.parentId)).toBe(true);
    }
  });
});
