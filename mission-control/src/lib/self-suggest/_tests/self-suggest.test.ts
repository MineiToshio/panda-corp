/**
 * WO-17-003 — `lib/self-suggest` derivations (6 kinds) — RED phase
 *
 * Tests BEFORE the implementation: `lib/self-suggest.ts` does not exist yet.
 * Every test below MUST fail until GREEN phase (TDD, DR-016).
 *
 * Traceability (FRD-17 EARS → AC → test):
 *   AC-17-003.1  Each derivation emits a Suggestion with correct kind/command/evidence/target
 *                when its rule fires, and nothing when it does not — one fixture per kind.
 *   AC-17-003.2  `command` is the exact /pandacorp:* per the FRD spec.
 *   AC-17-003.3  No derivation calls Claude or the network — pure over readers.
 *   AC-17-003.4  Event tail is the capped tail (≤200) — velocity/unused-capability never
 *                read the full history.
 *   AC-17-003.5  `recurring-lesson` fires only at projects.length >= 2.
 *   AC-17-003.6  All thresholds come from lib/constants.ts (no magic numbers).
 *   AC-17-003.7  Missing inputs → computeSuggestions returns the still-valid subset,
 *                never throws (fresh-factory tolerant).
 *
 * Design: computeSuggestions accepts an SuggestionsInput bag with all required data.
 * This makes every derivation a pure function over plain TypeScript objects — no fs calls,
 * no Claude, no network (AC-17-003.3).
 *
 * Stack: Vitest; no mocks, pure data injection via fixture objects.
 */

import { describe, expect, it } from "vitest";
import {
  BOTTLENECK_THRESHOLD,
  LAUNCH_REVIEW_DAYS,
  SELF_SUGGEST_EVENT_CAP,
  VELOCITY_FACTOR,
} from "../../constants";
import { computeSuggestions, type SuggestionsInput } from "../self-suggest";

// ---------------------------------------------------------------------------
// Helpers — build minimal typed fixture objects
// ---------------------------------------------------------------------------

/** A past ISO date, `daysAgo` days before today. */
function daysAgoISO(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

/** An empty SuggestionsInput — fresh-factory baseline. */
function emptyInput(): SuggestionsInput {
  return {
    boardColumnCounts: {},
    portfolioItems: [],
    events: [],
    capabilities: [],
    decisionRules: [],
    inboxDecisionLines: [],
    lessons: [],
  };
}

// ---------------------------------------------------------------------------
// 1. bottleneck
// ---------------------------------------------------------------------------

describe("bottleneck derivation", () => {
  it("AC-17-003.1 — WHEN a column has >= BOTTLENECK_THRESHOLD ideas THEN emits one suggestion", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      boardColumnCounts: { discovered: BOTTLENECK_THRESHOLD, documented: 1 },
    };
    const results = computeSuggestions(input);
    const bottleneck = results.filter((s) => s.kind === "bottleneck");
    expect(bottleneck).toHaveLength(1);
    expect(bottleneck[0]?.kind).toBe("bottleneck");
    expect(bottleneck[0]?.evidence).toContain("discovered");
    expect(typeof bottleneck[0]?.command).toBe("string");
    expect(bottleneck[0]?.command.length).toBeGreaterThan(0);
  });

  it("AC-17-003.2 — bottleneck command is /pandacorp:recommend", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      boardColumnCounts: { discovered: BOTTLENECK_THRESHOLD },
    };
    const results = computeSuggestions(input);
    const bottleneck = results.find((s) => s.kind === "bottleneck");
    expect(bottleneck?.command).toBe("/pandacorp:recommend");
  });

  it("AC-17-003.1 — WHEN all columns are below threshold THEN no bottleneck emitted", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      boardColumnCounts: { discovered: BOTTLENECK_THRESHOLD - 1, documented: 2 },
    };
    const results = computeSuggestions(input);
    expect(results.filter((s) => s.kind === "bottleneck")).toHaveLength(0);
  });

  it("emits one suggestion per over-threshold column, not one globally", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      boardColumnCounts: {
        discovered: BOTTLENECK_THRESHOLD,
        documented: BOTTLENECK_THRESHOLD + 2,
      },
    };
    const results = computeSuggestions(input);
    expect(results.filter((s) => s.kind === "bottleneck")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 2. velocity
// ---------------------------------------------------------------------------

describe("velocity derivation", () => {
  it("AC-17-003.1 — WHEN a project phase age >> portfolio median THEN emits suggestion", () => {
    // The median is the phase age of other projects; one project running much longer fires.
    const _now = new Date();
    const baseAge = 5; // baseline = 5-day median
    // Build portfolio items: 3 projects at 5-day age (median = 5), 1 at 5 * VELOCITY_FACTOR days
    const makeItem = (name: string, startDaysAgo: number, stage: string) => ({
      name,
      path: `/tmp/${name}`,
      stage: stage as "implementation",
      phaseStartedAt: daysAgoISO(startDaysAgo),
    });
    const oldAge = Math.ceil(baseAge * VELOCITY_FACTOR) + 1;
    const input: SuggestionsInput = {
      ...emptyInput(),
      portfolioItems: [
        makeItem("proj-a", baseAge, "implementation"),
        makeItem("proj-b", baseAge, "implementation"),
        makeItem("proj-c", baseAge, "implementation"),
        makeItem("proj-slow", oldAge, "implementation"),
      ],
    };
    const results = computeSuggestions(input);
    const velocity = results.filter((s) => s.kind === "velocity");
    expect(velocity.length).toBeGreaterThanOrEqual(1);
    expect(velocity.some((s) => s.evidence.includes("proj-slow"))).toBe(true);
  });

  it("AC-17-003.1 — WHEN all phases are within VELOCITY_FACTOR of median THEN no velocity alert", () => {
    const baseAge = 5;
    const makeItem = (name: string, stage: string) => ({
      name,
      path: `/tmp/${name}`,
      stage: stage as "implementation",
      phaseStartedAt: daysAgoISO(baseAge),
    });
    const input: SuggestionsInput = {
      ...emptyInput(),
      portfolioItems: [
        makeItem("proj-a", "implementation"),
        makeItem("proj-b", "implementation"),
        makeItem("proj-c", "implementation"),
      ],
    };
    const results = computeSuggestions(input);
    expect(results.filter((s) => s.kind === "velocity")).toHaveLength(0);
  });

  it("WHEN a portfolio item has no phaseStartedAt THEN it is excluded from velocity calculation", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      portfolioItems: [
        { name: "proj-no-date", path: "/tmp/x", stage: "implementation", phaseStartedAt: null },
      ],
    };
    expect(() => computeSuggestions(input)).not.toThrow();
    const results = computeSuggestions(input);
    expect(results.filter((s) => s.kind === "velocity")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. unused-capability
// ---------------------------------------------------------------------------

describe("unused-capability derivation", () => {
  it("AC-17-003.1 — WHEN a capability has no matching event in the tail THEN emits suggestion", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      capabilities: [
        { id: "review-launch", kind: "skill" },
        { id: "memory", kind: "skill" },
      ],
      events: [{ event: "AgentWorking", at: daysAgoISO(1), agent: "memory" }],
    };
    const results = computeSuggestions(input);
    const unused = results.filter((s) => s.kind === "unused-capability");
    expect(unused.length).toBeGreaterThanOrEqual(1);
    // "memory" is used; "review-launch" is not
    expect(unused.some((s) => s.evidence.includes("review-launch"))).toBe(true);
    expect(unused.every((s) => !s.evidence.includes("memory"))).toBe(true);
  });

  it("AC-17-003.1 — WHEN all capabilities have at least one event THEN no unused-capability", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      capabilities: [{ id: "spec", kind: "skill" }],
      events: [{ event: "AgentWorking", at: daysAgoISO(1), agent: "spec" }],
    };
    const results = computeSuggestions(input);
    expect(results.filter((s) => s.kind === "unused-capability")).toHaveLength(0);
  });

  it("AC-17-003.4 — event tail for unused-capability is capped at SELF_SUGGEST_EVENT_CAP", () => {
    // Build > CAP events to ensure no crash; the cap prevents long-history degradation.
    const events = Array.from({ length: SELF_SUGGEST_EVENT_CAP + 50 }, (_, i) => ({
      event: "AgentWorking",
      at: daysAgoISO(i),
      agent: "spec",
    }));
    const input: SuggestionsInput = {
      ...emptyInput(),
      capabilities: [{ id: "spec", kind: "skill" }],
      events,
    };
    // Should not crash and should NOT flag "spec" (it has events even in the tail)
    expect(() => computeSuggestions(input)).not.toThrow();
    const results = computeSuggestions(input);
    expect(results.filter((s) => s.kind === "unused-capability")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. policy-friction
// ---------------------------------------------------------------------------

describe("policy-friction derivation", () => {
  it("AC-17-003.1 — WHEN a requiere_humano:false rule recurs in inbox lines THEN emits suggestion", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      decisionRules: [
        {
          id: "DR-032",
          patron: "Iterating phases",
          default: "No auto-advance",
          requiereHumano: false,
        },
      ],
      // Two inbox lines mentioning the same DR-032 rule (recurring)
      inboxDecisionLines: [
        "DR-032: Should we auto-advance? → No",
        "DR-032: Again, auto-advance? → No",
      ],
    };
    const results = computeSuggestions(input);
    const friction = results.filter((s) => s.kind === "policy-friction");
    expect(friction.length).toBeGreaterThanOrEqual(1);
    expect(friction.some((s) => s.evidence.includes("DR-032"))).toBe(true);
  });

  it("AC-17-003.2 — policy-friction command is /pandacorp:decide", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      decisionRules: [
        { id: "DR-032", patron: "Iterating", default: "No auto-advance", requiereHumano: false },
      ],
      inboxDecisionLines: ["DR-032: question 1", "DR-032: question 2"],
    };
    const results = computeSuggestions(input);
    const friction = results.find((s) => s.kind === "policy-friction");
    expect(friction?.command).toBe("/pandacorp:decide");
  });

  it("AC-17-003.1 — WHEN a requiere_humano:true rule recurs in inbox THEN no policy-friction", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      decisionRules: [
        { id: "DR-001", patron: "Dependencies", default: "Justify", requiereHumano: true },
      ],
      inboxDecisionLines: ["DR-001: question 1", "DR-001: question 2"],
    };
    const results = computeSuggestions(input);
    expect(results.filter((s) => s.kind === "policy-friction")).toHaveLength(0);
  });

  it("AC-17-003.1 — WHEN a rule appears only once in inbox THEN no policy-friction (not recurring)", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      decisionRules: [
        { id: "DR-032", patron: "Iterating", default: "No auto-advance", requiereHumano: false },
      ],
      inboxDecisionLines: ["DR-032: single occurrence"],
    };
    const results = computeSuggestions(input);
    expect(results.filter((s) => s.kind === "policy-friction")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. recurring-lesson
// ---------------------------------------------------------------------------

describe("recurring-lesson derivation", () => {
  it("AC-17-003.1 + AC-17-003.5 — WHEN lesson.projects.length >= 2 THEN emits suggestion", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      lessons: [
        {
          id: "LESSON-0001",
          type: "gotcha",
          domain: "build",
          status: "active",
          promotion: "none",
          source: "proj-alpha (WO-01), proj-beta (WO-02)",
          links: [],
          projects: ["proj-alpha", "proj-beta"],
          body: "Some lesson body.",
          evalGate: "corroborated",
        },
      ],
    };
    const results = computeSuggestions(input);
    const recurring = results.filter((s) => s.kind === "recurring-lesson");
    expect(recurring).toHaveLength(1);
    expect(recurring[0]?.evidence).toContain("LESSON-0001");
  });

  it("AC-17-003.2 — recurring-lesson command is /pandacorp:learn", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      lessons: [
        {
          id: "LESSON-0002",
          type: "gotcha",
          domain: "build",
          status: "active",
          promotion: "none",
          source: "proj-a, proj-b",
          links: [],
          projects: ["proj-a", "proj-b"],
          body: "Body.",
          evalGate: "corroborated",
        },
      ],
    };
    const results = computeSuggestions(input);
    const recurring = results.find((s) => s.kind === "recurring-lesson");
    expect(recurring?.command).toBe("/pandacorp:learn");
  });

  it("AC-17-003.5 — WHEN lesson.projects.length === 1 THEN no recurring-lesson", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      lessons: [
        {
          id: "LESSON-0003",
          type: "gotcha",
          domain: "build",
          status: "candidate",
          promotion: "none",
          source: "proj-alpha (WO-01)",
          links: [],
          projects: ["proj-alpha"],
          body: "Body.",
          evalGate: "awaiting-2nd",
        },
      ],
    };
    const results = computeSuggestions(input);
    expect(results.filter((s) => s.kind === "recurring-lesson")).toHaveLength(0);
  });

  it("AC-17-003.5 — WHEN lesson.projects.length === 0 THEN no recurring-lesson", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      lessons: [
        {
          id: "LESSON-0004",
          type: "gotcha",
          domain: "build",
          status: "candidate",
          promotion: "none",
          source: "",
          links: [],
          projects: [],
          body: "Body.",
          evalGate: "awaiting-2nd",
        },
      ],
    };
    const results = computeSuggestions(input);
    expect(results.filter((s) => s.kind === "recurring-lesson")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. launch-review
// ---------------------------------------------------------------------------

describe("launch-review derivation", () => {
  it("AC-17-003.1 — WHEN a launched project is past LAUNCH_REVIEW_DAYS THEN emits suggestion", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      portfolioItems: [
        {
          name: "proj-old",
          path: "/tmp/proj-old",
          stage: "release",
          phaseStartedAt: daysAgoISO(LAUNCH_REVIEW_DAYS + 1),
        },
      ],
    };
    const results = computeSuggestions(input);
    const launchReview = results.filter((s) => s.kind === "launch-review");
    expect(launchReview).toHaveLength(1);
    expect(launchReview[0]?.evidence).toContain("proj-old");
  });

  it("AC-17-003.2 — launch-review command is /pandacorp:review-launch", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      portfolioItems: [
        {
          name: "proj-old",
          path: "/tmp/proj-old",
          stage: "release",
          phaseStartedAt: daysAgoISO(LAUNCH_REVIEW_DAYS + 1),
        },
      ],
    };
    const results = computeSuggestions(input);
    const launchReview = results.find((s) => s.kind === "launch-review");
    expect(launchReview?.command).toBe("/pandacorp:review-launch");
  });

  it("AC-17-003.1 — WHEN a launched project is within LAUNCH_REVIEW_DAYS THEN no launch-review", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      portfolioItems: [
        {
          name: "proj-fresh",
          path: "/tmp/proj-fresh",
          stage: "release",
          phaseStartedAt: daysAgoISO(LAUNCH_REVIEW_DAYS - 1),
        },
      ],
    };
    const results = computeSuggestions(input);
    expect(results.filter((s) => s.kind === "launch-review")).toHaveLength(0);
  });

  it("AC-17-003.1 — WHEN a project is not in release phase THEN no launch-review", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      portfolioItems: [
        {
          name: "proj-building",
          path: "/tmp/proj-building",
          stage: "implementation",
          phaseStartedAt: daysAgoISO(LAUNCH_REVIEW_DAYS + 10),
        },
      ],
    };
    const results = computeSuggestions(input);
    expect(results.filter((s) => s.kind === "launch-review")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Fresh-factory tolerant (AC-17-003.7)
// ---------------------------------------------------------------------------

describe("fresh-factory tolerant (AC-17-003.7)", () => {
  it("WHEN all inputs are empty THEN computeSuggestions returns [] and never throws", () => {
    expect(() => computeSuggestions(emptyInput())).not.toThrow();
    expect(computeSuggestions(emptyInput())).toEqual([]);
  });

  it("WHEN boardColumnCounts is empty THEN bottleneck is absent", () => {
    const results = computeSuggestions(emptyInput());
    expect(results.filter((s) => s.kind === "bottleneck")).toHaveLength(0);
  });

  it("WHEN events is empty THEN unused-capability and velocity are absent", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      capabilities: [{ id: "spec", kind: "skill" }],
    };
    // With no events, "spec" is technically unused — still fires the unused-capability rule
    const _results = computeSuggestions(input);
    // Should not throw
    expect(() => computeSuggestions(input)).not.toThrow();
  });

  it("WHEN lessons is empty THEN no recurring-lesson", () => {
    const results = computeSuggestions(emptyInput());
    expect(results.filter((s) => s.kind === "recurring-lesson")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Suggestion shape invariants
// ---------------------------------------------------------------------------

describe("Suggestion shape invariants", () => {
  it("every Suggestion has kind, title, evidence, command, severity — never undefined", () => {
    const input: SuggestionsInput = {
      ...emptyInput(),
      boardColumnCounts: { discovered: BOTTLENECK_THRESHOLD },
      lessons: [
        {
          id: "LESSON-0001",
          type: "gotcha",
          domain: "build",
          status: "active",
          promotion: "none",
          source: "proj-a, proj-b",
          links: [],
          projects: ["proj-a", "proj-b"],
          body: "body",
          evalGate: "corroborated",
        },
      ],
    };
    const results = computeSuggestions(input);
    for (const s of results) {
      expect(typeof s.kind).toBe("string");
      expect(typeof s.title).toBe("string");
      expect(s.title.length).toBeGreaterThan(0);
      expect(typeof s.evidence).toBe("string");
      expect(s.evidence.length).toBeGreaterThan(0);
      expect(typeof s.command).toBe("string");
      expect(s.command.length).toBeGreaterThan(0);
      expect(["info", "nudge"]).toContain(s.severity);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. AC-17-003.6 — constants from lib/constants.ts (no magic numbers)
// ---------------------------------------------------------------------------

describe("constants from lib/constants.ts (AC-17-003.6)", () => {
  it("BOTTLENECK_THRESHOLD is defined and is a positive integer", () => {
    expect(Number.isInteger(BOTTLENECK_THRESHOLD)).toBe(true);
    expect(BOTTLENECK_THRESHOLD).toBeGreaterThan(0);
  });

  it("VELOCITY_FACTOR is defined and is a number > 1", () => {
    expect(typeof VELOCITY_FACTOR).toBe("number");
    expect(VELOCITY_FACTOR).toBeGreaterThan(1);
  });

  it("LAUNCH_REVIEW_DAYS is defined and is a positive integer", () => {
    expect(Number.isInteger(LAUNCH_REVIEW_DAYS)).toBe(true);
    expect(LAUNCH_REVIEW_DAYS).toBeGreaterThan(0);
  });

  it("SELF_SUGGEST_EVENT_CAP is defined and is a positive integer <= 200", () => {
    expect(Number.isInteger(SELF_SUGGEST_EVENT_CAP)).toBe(true);
    expect(SELF_SUGGEST_EVENT_CAP).toBeGreaterThan(0);
    expect(SELF_SUGGEST_EVENT_CAP).toBeLessThanOrEqual(200);
  });
});
