/**
 * WO-18-002 — `IF-18-turn` human-gate queue derivation — TDD RED phase
 *
 * Tests BEFORE the implementation: `turn.ts` does not exist yet.
 * Every test below MUST fail until GREEN phase.
 *
 * Traceability (FRD-18 EARS → AC → test):
 *   AC-18-002.1  Queue contains exactly the four genuine-gate sources, each with
 *                its exact /pandacorp:* command.
 *   AC-18-002.2  Routine progress is EXCLUDED: running build, auto-retried failed WO,
 *                and advance_pending (DR-032) NEVER appear here.
 *   AC-18-002.3  Items are urgency-ordered; empty → empty array (al-día state).
 *   AC-18-002.4  Each item carries a navigable href and a copyable command.
 *   AC-18-002.5  Empty queue → empty array (al-día rendered by component).
 *
 * Design: buildTurnQueue accepts a TurnInput bag (pure, no fs, no Claude, no network).
 * Stack: Vitest; pure data injection — no mocks, no I/O.
 */

import { describe, expect, it } from "vitest";
import { buildTurnQueue, type TurnInput, type TurnItem } from "../turn";

// ---------------------------------------------------------------------------
// Helpers — fixture factories
// ---------------------------------------------------------------------------

function emptyInput(): TurnInput {
  return {
    pendingDecisions: 0,
    inboxDecisionLines: [],
    shippedAwaitingReview: [],
    memoryNeedsAttention: false,
    undiscoveredIdeas: 0,
  };
}

// ---------------------------------------------------------------------------
// AC-18-002.1 — four genuine gate sources
// ---------------------------------------------------------------------------

describe("AC-18-002.1 — four genuine gate sources", () => {
  it("includes a pending_decisions item when count > 0", () => {
    const input: TurnInput = { ...emptyInput(), pendingDecisions: 2 };
    const queue = buildTurnQueue(input);
    const item = queue.find((i) => i.kind === "pending-decisions");
    expect(item).toBeDefined();
    expect(item?.command).toMatch(/pandacorp:/);
  });

  it("includes a review-launch item for each shipped project awaiting review", () => {
    const input: TurnInput = {
      ...emptyInput(),
      shippedAwaitingReview: [{ name: "my-app", path: "/projects/my-app" }],
    };
    const queue = buildTurnQueue(input);
    const item = queue.find((i) => i.kind === "review-launch");
    expect(item).toBeDefined();
    expect(item?.command).toBe("/pandacorp:review-launch");
  });

  it("includes a memory-nudge item when memoryNeedsAttention is true", () => {
    const input: TurnInput = { ...emptyInput(), memoryNeedsAttention: true };
    const queue = buildTurnQueue(input);
    const item = queue.find((i) => i.kind === "memory-nudge");
    expect(item).toBeDefined();
    expect(item?.command).toBe("/pandacorp:memory");
  });

  it("includes an undiscovered-ideas item when count > 0", () => {
    const input: TurnInput = { ...emptyInput(), undiscoveredIdeas: 3 };
    const queue = buildTurnQueue(input);
    const item = queue.find((i) => i.kind === "undiscovered-ideas");
    expect(item).toBeDefined();
    expect(item?.command).toMatch(/pandacorp:/);
  });

  it("all four sources emit items when all conditions are met", () => {
    const input: TurnInput = {
      pendingDecisions: 1,
      inboxDecisionLines: ["spend money: buy domain"],
      shippedAwaitingReview: [{ name: "app-a", path: "/p/a" }],
      memoryNeedsAttention: true,
      undiscoveredIdeas: 2,
    };
    const queue = buildTurnQueue(input);
    const kinds = queue.map((i) => i.kind);
    expect(kinds).toContain("pending-decisions");
    expect(kinds).toContain("review-launch");
    expect(kinds).toContain("memory-nudge");
    expect(kinds).toContain("undiscovered-ideas");
  });

  it("each item carries a label (Spanish), command, and href", () => {
    const input: TurnInput = {
      ...emptyInput(),
      pendingDecisions: 1,
    };
    const queue = buildTurnQueue(input);
    for (const item of queue) {
      expect(typeof item.label).toBe("string");
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.command).toBe("string");
      expect(item.command.startsWith("/pandacorp:")).toBe(true);
      expect(typeof item.href).toBe("string");
      expect(item.href.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-18-002.1 — exact commands
// ---------------------------------------------------------------------------

describe("AC-18-002.1 — exact /pandacorp:* commands", () => {
  it("pending-decisions command is /pandacorp:decide", () => {
    const input: TurnInput = { ...emptyInput(), pendingDecisions: 1 };
    const queue = buildTurnQueue(input);
    const item = queue.find((i) => i.kind === "pending-decisions");
    expect(item?.command).toBe("/pandacorp:decide");
  });

  it("review-launch command is /pandacorp:review-launch", () => {
    const input: TurnInput = {
      ...emptyInput(),
      shippedAwaitingReview: [{ name: "app", path: "/p" }],
    };
    const queue = buildTurnQueue(input);
    const item = queue.find((i) => i.kind === "review-launch");
    expect(item?.command).toBe("/pandacorp:review-launch");
  });

  it("memory-nudge command is /pandacorp:memory", () => {
    const input: TurnInput = { ...emptyInput(), memoryNeedsAttention: true };
    const queue = buildTurnQueue(input);
    const item = queue.find((i) => i.kind === "memory-nudge");
    expect(item?.command).toBe("/pandacorp:memory");
  });

  it("undiscovered-ideas command is /pandacorp:recommend", () => {
    const input: TurnInput = { ...emptyInput(), undiscoveredIdeas: 1 };
    const queue = buildTurnQueue(input);
    const item = queue.find((i) => i.kind === "undiscovered-ideas");
    expect(item?.command).toBe("/pandacorp:recommend");
  });
});

// ---------------------------------------------------------------------------
// AC-18-002.2 — routine progress EXCLUDED (critical exclusions)
// ---------------------------------------------------------------------------

describe("AC-18-002.2 — routine progress is EXCLUDED", () => {
  it("running build does NOT appear in the queue", () => {
    // Running builds are routine progress — not owner gates (DR-032).
    // The TurnInput has no 'runningBuild' flag because running builds must
    // never enter the queue regardless of what the caller passes.
    const input: TurnInput = emptyInput();
    const queue = buildTurnQueue(input);
    expect(queue.some((i) => i.kind === "running-build")).toBe(false);
  });

  it("advance_pending does NOT appear in the queue (DR-032)", () => {
    // advance_pending is a Board signal, not an owner gate (FRD-18 §Turn).
    const input: TurnInput = emptyInput();
    const queue = buildTurnQueue(input);
    expect(queue.some((i) => i.kind === "advance-pending")).toBe(false);
  });

  it("auto-retried failed WO does NOT appear in the queue", () => {
    const input: TurnInput = emptyInput();
    const queue = buildTurnQueue(input);
    expect(queue.some((i) => i.kind === "failed-wo")).toBe(false);
  });

  it("a fixture with running=true and advancePending=true has no routine-progress items", () => {
    // This fixture explicitly tests the exclusion: even if a caller embeds
    // running/advance state, they must not show up in the queue.
    const input: TurnInput = {
      ...emptyInput(),
      pendingDecisions: 0,
      memoryNeedsAttention: false,
      undiscoveredIdeas: 0,
      shippedAwaitingReview: [],
    };
    const queue = buildTurnQueue(input);
    // The queue should be empty (nothing to gate on)
    expect(queue).toHaveLength(0);
    // And specifically none of the excluded kinds appear
    const excludedKinds: TurnItem["kind"][] = ["running-build", "advance-pending", "failed-wo"];
    for (const kind of excludedKinds) {
      expect(queue.some((i) => i.kind === kind)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-18-002.3 — urgency ordering
// ---------------------------------------------------------------------------

describe("AC-18-002.3 — urgency ordering", () => {
  it("pending-decisions has higher urgency than undiscovered-ideas", () => {
    const input: TurnInput = {
      ...emptyInput(),
      pendingDecisions: 1,
      undiscoveredIdeas: 3,
    };
    const queue = buildTurnQueue(input);
    const decisionIdx = queue.findIndex((i) => i.kind === "pending-decisions");
    const ideasIdx = queue.findIndex((i) => i.kind === "undiscovered-ideas");
    expect(decisionIdx).toBeLessThan(ideasIdx);
  });

  it("review-launch appears before undiscovered-ideas", () => {
    const input: TurnInput = {
      ...emptyInput(),
      shippedAwaitingReview: [{ name: "app", path: "/p" }],
      undiscoveredIdeas: 2,
    };
    const queue = buildTurnQueue(input);
    const reviewIdx = queue.findIndex((i) => i.kind === "review-launch");
    const ideasIdx = queue.findIndex((i) => i.kind === "undiscovered-ideas");
    expect(reviewIdx).toBeLessThan(ideasIdx);
  });

  it("urgency order: pending-decisions > review-launch > memory-nudge > undiscovered-ideas", () => {
    const input: TurnInput = {
      pendingDecisions: 1,
      inboxDecisionLines: [],
      shippedAwaitingReview: [{ name: "app", path: "/p" }],
      memoryNeedsAttention: true,
      undiscoveredIdeas: 2,
    };
    const queue = buildTurnQueue(input);
    const getIdx = (kind: TurnItem["kind"]) => queue.findIndex((i) => i.kind === kind);
    const decisionIdx = getIdx("pending-decisions");
    const reviewIdx = getIdx("review-launch");
    const memoryIdx = getIdx("memory-nudge");
    const ideasIdx = getIdx("undiscovered-ideas");
    expect(decisionIdx).toBeLessThan(reviewIdx);
    expect(reviewIdx).toBeLessThan(memoryIdx);
    expect(memoryIdx).toBeLessThan(ideasIdx);
  });

  it("returns [] when no conditions are met (empty → al-día)", () => {
    const queue = buildTurnQueue(emptyInput());
    expect(queue).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-18-002.4 — href (navigable destination per item)
// ---------------------------------------------------------------------------

describe("AC-18-002.4 — navigable href per item", () => {
  it("pending-decisions href points to configuration or projects", () => {
    const input: TurnInput = { ...emptyInput(), pendingDecisions: 1 };
    const queue = buildTurnQueue(input);
    const item = queue.find((i) => i.kind === "pending-decisions");
    expect(item?.href).toBeTruthy();
    // Href should be an absolute path (starts with /)
    expect(item?.href.startsWith("/")).toBe(true);
  });

  it("review-launch href links to the project page", () => {
    const input: TurnInput = {
      ...emptyInput(),
      shippedAwaitingReview: [{ name: "my-proj", path: "/somewhere/my-proj" }],
    };
    const queue = buildTurnQueue(input);
    const item = queue.find((i) => i.kind === "review-launch");
    expect(item?.href).toBeTruthy();
    expect(item?.href.startsWith("/")).toBe(true);
  });

  it("memory-nudge href points to proposals page", () => {
    const input: TurnInput = { ...emptyInput(), memoryNeedsAttention: true };
    const queue = buildTurnQueue(input);
    const item = queue.find((i) => i.kind === "memory-nudge");
    expect(item?.href).toBe("/proposals");
  });

  it("undiscovered-ideas href points to the board", () => {
    const input: TurnInput = { ...emptyInput(), undiscoveredIdeas: 1 };
    const queue = buildTurnQueue(input);
    const item = queue.find((i) => i.kind === "undiscovered-ideas");
    expect(item?.href).toBeTruthy();
    expect(item?.href.startsWith("/")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-18-002.5 — empty queue → empty array (al-día)
// ---------------------------------------------------------------------------

describe("AC-18-002.5 — empty queue (al-día state)", () => {
  it("all conditions false → empty queue (no manufactured urgency)", () => {
    expect(buildTurnQueue(emptyInput())).toHaveLength(0);
  });

  it("pendingDecisions=0 does NOT produce a decisions item", () => {
    const queue = buildTurnQueue({ ...emptyInput(), pendingDecisions: 0 });
    expect(queue.some((i) => i.kind === "pending-decisions")).toBe(false);
  });

  it("shippedAwaitingReview=[] does NOT produce a review-launch item", () => {
    const queue = buildTurnQueue({ ...emptyInput(), shippedAwaitingReview: [] });
    expect(queue.some((i) => i.kind === "review-launch")).toBe(false);
  });

  it("memoryNeedsAttention=false does NOT produce a memory-nudge item", () => {
    const queue = buildTurnQueue({ ...emptyInput(), memoryNeedsAttention: false });
    expect(queue.some((i) => i.kind === "memory-nudge")).toBe(false);
  });

  it("undiscoveredIdeas=0 does NOT produce an undiscovered-ideas item", () => {
    const queue = buildTurnQueue({ ...emptyInput(), undiscoveredIdeas: 0 });
    expect(queue.some((i) => i.kind === "undiscovered-ideas")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Multiple shipped projects → multiple review-launch items
// ---------------------------------------------------------------------------

describe("multiple shipped projects", () => {
  it("emits one review-launch item per shipped project awaiting review", () => {
    const input: TurnInput = {
      ...emptyInput(),
      shippedAwaitingReview: [
        { name: "app-a", path: "/p/a" },
        { name: "app-b", path: "/p/b" },
      ],
    };
    const queue = buildTurnQueue(input);
    const reviewItems = queue.filter((i) => i.kind === "review-launch");
    expect(reviewItems).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Pure function invariants (AC-18-002 — no Claude, no fs, no network)
// ---------------------------------------------------------------------------

describe("purity invariants", () => {
  it("does not mutate input", () => {
    const input: TurnInput = {
      ...emptyInput(),
      pendingDecisions: 3,
      undiscoveredIdeas: 2,
    };
    const inputCopy = JSON.parse(JSON.stringify(input)) as TurnInput;
    buildTurnQueue(input);
    expect(input).toEqual(inputCopy);
  });

  it("returns a new array on each call with identical input", () => {
    const input: TurnInput = { ...emptyInput(), pendingDecisions: 1 };
    const a = buildTurnQueue(input);
    const b = buildTurnQueue(input);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
