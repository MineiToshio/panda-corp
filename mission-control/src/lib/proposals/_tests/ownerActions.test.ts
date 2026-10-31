import { describe, expect, it } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import type { ProposalsData } from "../data";
import { MEMORY_UNREVIEWED_DAYS, resolveOwnerActions } from "../ownerActions";
import { groupSignals } from "../signals";

function lesson(id: string, patch: Partial<Lesson> = {}): Lesson {
  return {
    id,
    context: "A lesson",
    type: "pattern",
    domain: "quality",
    trigger: "",
    status: "candidate",
    promotion: "none",
    source: "",
    links: [],
    projects: [],
    appliedIn: [],
    body: "## Proof\nReal evidence",
    evalGate: "awaiting-2nd",
    ...patch,
  };
}
function data(patch: Partial<ProposalsData> = {}): ProposalsData {
  return {
    lessons: [],
    health: {
      rawNotes: 0,
      candidates: 0,
      lastMemoryRunAt: null,
      staleDays: null,
      lastSweepAt: "2026-10-30T00:00:00Z",
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
const now = new Date("2026-10-30T12:00:00Z");
describe("owner actions", () => {
  it("AC-17-011.1 AC-17-011.2 resolves four actions from 42 signals, 16 promotions and 24 candidates", () => {
    const lessons = [
      ...Array.from({ length: 16 }, (_, i) => lesson(`LESSON-${i}`, { promotion: "proposed" })),
      ...Array.from({ length: 24 }, (_, i) => lesson(`LESSON-${100 + i}`)),
    ];
    const suggestions = Array.from({ length: 42 }, (_, i) => ({
      kind: "unused-capability" as const,
      title: `Skill ${i}`,
      evidence: "unused",
      command: "/pandacorp:learn",
      severity: "info" as const,
    }));
    const items = (["p0", "p1"] as const).map((severity, i) => ({
      id: `BL-${i}`,
      title: "Broken tool",
      type: "bug" as const,
      area: "hooks",
      status: "open" as const,
      severity,
      source: "",
      closes: "",
      links: [],
      opened: "",
      closed: null,
      body: "",
    }));
    const result = resolveOwnerActions(
      data({ lessons, suggestions, discoveredIdeas: 4, backlog: { items, errors: [] } }),
      now,
    );
    expect(result.actions.map((x) => x.kind)).toEqual(["urgent", "decide", "important", "ideas"]);
    expect(result.badgeCount).toBe(4);
    expect(result.facts.waiting).toBe(16);
    expect(result.actions[0]?.command).toBe("/pandacorp:implement-backlog BL-0");
  });
  it("AC-17-011.2 counts recurring lessons once, skips decided lessons and omits zero actions", () => {
    const lessons = [
      lesson("LESSON-1", { promotion: "proposed", projects: ["a", "b"] }),
      lesson("LESSON-2", { projects: ["a", "b"] }),
      lesson("LESSON-3", { promotion: "approved", projects: ["a", "b"] }),
    ];
    const suggestions = lessons.map((x) => ({
      kind: "recurring-lesson" as const,
      target: x.id,
      title: x.context,
      evidence: "2 projects",
      command: "/pandacorp:learn",
      severity: "nudge" as const,
    }));
    const result = resolveOwnerActions(data({ lessons, suggestions }), now);
    expect(result.facts.waiting).toBe(2);
    expect(result.badgeCount).toBe(1);
    expect(resolveOwnerActions(data(), now).actions).toEqual([]);
  });
  it("AC-17-011.1 uses the real daily sweep at the staleness boundary", () => {
    const fresh = new Date(now.getTime() - MEMORY_UNREVIEWED_DAYS * 86400000).toISOString();
    expect(
      resolveOwnerActions(data({ health: { ...data().health, lastSweepAt: fresh } }), now).upkeep
        .kind,
    ).toBe("current");
    const stale = new Date(Date.parse(fresh) - 1).toISOString();
    expect(
      resolveOwnerActions(
        data({ health: { ...data().health, lastSweepAt: stale } }),
        now,
      ).actions.at(-1)?.kind,
    ).toBe("memoryStale");
    expect(
      resolveOwnerActions(data({ health: { ...data().health, lastSweepAt: null } }), now).upkeep
        .kind,
    ).toBe("stale");
  });
  it("does not invent a review age for absent, malformed or future sweep evidence", () => {
    for (const lastSweepAt of [null, "malformed", "2099-01-01T00:00:00Z"]) {
      const result = resolveOwnerActions(data({ health: { ...data().health, lastSweepAt } }), now);
      expect(result.upkeep.kind).toBe("stale");
      expect(result.actions.some((action) => action.kind === "memoryStale")).toBe(false);
    }
  });
  it("keeps unreadable stores as errors rather than all-clear zero facts", () => {
    const result = resolveOwnerActions(
      data({
        memoryError: "unreadable memory",
        backlog: {
          items: [],
          errors: [{ file: "backlog", reason: "backlog directory could not be read" }],
        },
      }),
      now,
    );
    expect(result.facts.backlog).toBeNull();
    expect(result.facts.activeRules).toBeNull();
    expect(result.errors).toHaveLength(2);
  });
  it("keeps parsed backlog counts when a sibling file is malformed", () => {
    const backlog = {
      items: [
        {
          id: "BL-42",
          title: "Valid",
          type: "bug" as const,
          area: "hooks",
          status: "open" as const,
          severity: "p0" as const,
          source: "",
          closes: "",
          links: [],
          opened: "",
          closed: null,
          body: "",
        },
      ],
      errors: [{ file: "BL-43.md", reason: "malformed YAML frontmatter" }],
    };
    const result = resolveOwnerActions(data({ backlog }), now);
    expect(result.facts.backlog).toMatchObject({ p0: 1, actionable: 1 });
    expect(result.errors).toHaveLength(1);
  });
  it("keeps a proposed deprecated lesson in the durable waiting queue", () => {
    const proposed = lesson("LESSON-42", { status: "deprecated", promotion: "proposed" });
    const result = resolveOwnerActions(data({ lessons: [proposed] }), now);
    expect(result.waitingLessons).toEqual([proposed]);
    expect(result.facts.waiting).toBe(1);
    expect(result.actions[0]).toMatchObject({ kind: "decide", count: 1 });
  });
  it("AC-17-011.3 groups signals and marks unused-skills at the 0.6 boundary", () => {
    const suggestions = Array.from({ length: 6 }, (_, i) => ({
      kind: "unused-capability" as const,
      title: `Unused ${i}`,
      target: `skill-${i}`,
      evidence: "tail",
      command: "/pandacorp:learn",
      severity: "info" as const,
    }));
    expect(groupSignals(suggestions.slice(0, 5), 10)[0]?.unreliable).toBe(false);
    expect(groupSignals(suggestions, 10)[0]?.unreliable).toBe(true);
    expect(groupSignals([], 0)).toEqual([]);
  });
});
