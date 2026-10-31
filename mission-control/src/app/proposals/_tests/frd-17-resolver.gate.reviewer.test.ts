/**
 * FRD-17 — REVIEWER boundary tests of the owner-actions resolver and segment grammar (DR-015).
 * Each `it` is a limit or an edge the implementer's resolver suite does not pin.
 */

import { describe, expect, it } from "vitest";
import type { BacklogItem } from "@/lib/backlog/backlog";
import type { Lesson } from "@/lib/memory/memory";
import type { ProposalsData } from "@/lib/proposals/data";
import { resolveOwnerActions } from "@/lib/proposals/ownerActions";
import { validProposalsSegments } from "@/lib/proposals/routeSelection";
import { groupSignals } from "@/lib/proposals/signals";
import type { Suggestion } from "@/lib/self-suggest/self-suggest";

const NOW = new Date("2026-10-30T12:00:00.000Z");
const DAY = 86_400_000;
function lesson(id: string, patch: Partial<Lesson> = {}): Lesson {
  return {
    id,
    context: "A lesson",
    type: "pattern",
    domain: "quality",
    trigger: "",
    status: "active",
    promotion: "none",
    source: "",
    links: [],
    projects: [],
    appliedIn: [],
    body: "Evidence",
    evalGate: "corroborated",
    ...patch,
  };
}
function item(id: string, patch: Partial<BacklogItem> = {}): BacklogItem {
  return {
    id,
    title: id,
    type: "bug",
    area: "hooks",
    status: "open",
    severity: "p1",
    source: "",
    closes: "",
    links: [],
    opened: "",
    closed: null,
    body: "",
    ...patch,
  };
}
function data(
  patch: Partial<ProposalsData> = {},
  sweep: string | null = NOW.toISOString(),
): ProposalsData {
  return {
    lessons: [],
    health: {
      rawNotes: 0,
      candidates: 0,
      lastMemoryRunAt: null,
      staleDays: null,
      lastSweepAt: sweep,
      harvestOrphans: [],
    },
    memoryError: null,
    suggestions: [],
    backlog: { items: [], errors: [] },
    discoveredIdeas: 0,
    skillCount: 10,
    ...patch,
  };
}
const unused = (count: number): Suggestion[] =>
  Array.from({ length: count }, (_, i) => ({
    kind: "unused-capability",
    title: `s${i}`,
    evidence: "e",
    command: `/pandacorp:s${i}`,
    target: `s${i}`,
    severity: "info",
  }));

describe("upkeep limit (MEMORY_UNREVIEWED_DAYS)", () => {
  it("exactly two days is current; one millisecond more is stale and adds the action", () => {
    const at = (ms: number): string => new Date(NOW.getTime() - ms).toISOString();
    expect(resolveOwnerActions(data({}, at(2 * DAY)), NOW).upkeep.kind).toBe("current");
    const stale = resolveOwnerActions(data({}, at(2 * DAY + 1)), NOW);
    expect(stale.upkeep).toMatchObject({ kind: "stale", days: 2 });
    expect(stale.actions.map((x) => x.kind)).toEqual(["memoryStale"]);
    expect(stale.badgeCount).toBe(1);
  });

  it("a future stamp never reads as current and invents no elapsed age", () => {
    const future = resolveOwnerActions(data({}, new Date(NOW.getTime() + DAY).toISOString()), NOW);
    expect(future.upkeep).toMatchObject({ kind: "stale", days: null });
    expect(future.actions).toEqual([]);
  });
});

describe("the worked example and the action order (AC-17-011.1, AC-17-011.2)", () => {
  it("42 signals, 16 promotions and 24 candidates group into 4 actions, in order", () => {
    const lessons = [
      ...Array.from({ length: 16 }, (_, i) => lesson(`LESSON-${i}`, { promotion: "proposed" })),
      ...Array.from({ length: 24 }, (_, i) => lesson(`LESSON-${100 + i}`, { status: "candidate" })),
    ];
    const result = resolveOwnerActions(
      data({
        lessons,
        suggestions: unused(42),
        discoveredIdeas: 5,
        backlog: { items: [item("BL-1", { severity: "p0" }), item("BL-2")], errors: [] },
      }),
      NOW,
    );
    expect(result.actions.map((x) => x.kind)).toEqual(["urgent", "decide", "important", "ideas"]);
    expect(result.badgeCount).toBe(4);
  });

  it("an in-progress P0 is not an owner action but counts as actionable", () => {
    const result = resolveOwnerActions(
      data({ backlog: { items: [item("BL-1", { severity: "p0", status: "doing" })], errors: [] } }),
      NOW,
    );
    expect(result.actions).toEqual([]);
    expect(result.facts.backlog).toMatchObject({ p0: 0, doing: 1, actionable: 1 });
  });
});

describe("the queue is the proposed set (REQ-17-021, blueprint IF-17-actions)", () => {
  it("every promotion: proposed lesson waits, also one already deprecated", () => {
    const result = resolveOwnerActions(
      data({ lessons: [lesson("LESSON-1", { status: "deprecated", promotion: "proposed" })] }),
      NOW,
    );
    expect(result.waitingLessons.map((x) => x.id)).toEqual(["LESSON-1"]);
    expect(result.facts.waiting).toBe(1);
  });
});

describe("a partly readable backlog stays counted (AC-22-002.3, AC-22-004.2)", () => {
  it("one malformed file keeps the parsed counts and reports the error", () => {
    const result = resolveOwnerActions(
      data({
        backlog: {
          items: [item("BL-1", { severity: "p0" }), item("BL-2")],
          errors: [{ file: "BL-3.md", reason: "bad yaml" }],
        },
      }),
      NOW,
    );
    expect(result.errors.map((x) => x.source)).toEqual(["backlog"]);
    expect(result.facts.backlog).toMatchObject({ p0: 1, p1: 1, actionable: 2 });
  });

  it("an unreadable directory is no count at all, never zero", () => {
    const result = resolveOwnerActions(
      data({
        backlog: {
          items: [],
          errors: [{ file: "/x", reason: "backlog directory could not be read" }],
        },
      }),
      NOW,
    );
    expect(result.facts.backlog).toBeNull();
  });
});

describe("unreliable threshold (UNRELIABLE_SIGNAL_RATIO)", () => {
  it("is inclusive at 0.6 and off just below it, and no skills means not unreliable", () => {
    expect(groupSignals(unused(6), 10)[0]?.unreliable).toBe(true);
    expect(groupSignals(unused(5), 10)[0]?.unreliable).toBe(false);
    expect(groupSignals(unused(3), 0)[0]?.unreliable).toBe(false);
  });
});

describe("segment grammar (CMP-17-routes)", () => {
  const bundle = data({
    lessons: [
      lesson("LESSON-1", { promotion: "proposed" }),
      lesson("LESSON-2", { status: "candidate" }),
      lesson("LESSON-3", { status: "deprecated" }),
    ],
    backlog: { items: [item("BL-1", { status: "done" })], errors: [] },
  });
  it.each([
    [["resumen"], true],
    [["memory", "promotions"], true],
    [["memory", "promotions", "LESSON-1"], true],
    [["memory", "candidate-lesson", "LESSON-2"], true],
    [["memory", "prune", "LESSON-3"], true],
    [["backlog", "BL-1"], true],
    [[], false],
    [["memoria"], false],
    [["resumen", "x"], false],
    [["memory", "promotions", "LESSON-2"], false],
    [["memory", "prune", "LESSON-1"], false],
    [["memory", "candidate-lesson", "LESSON-3"], false],
    [["memory", "promotions", "LESSON-1", "x"], false],
    [["backlog", "BL-2"], false],
    [["backlog", "BL-1", "x"], false],
    [["memory", "x".repeat(201)], false],
  ])("%j -> %s", (segments, expected) => {
    expect(validProposalsSegments(segments, bundle)).toBe(expected);
  });
});
