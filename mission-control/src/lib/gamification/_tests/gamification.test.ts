/**
 * WO-09-005 — classifyCelebration tests
 * WO-09-002 — computeAgentLevel tests
 *
 * Traceability (WO-09-005):
 *   AC-09-005.1 — classifyCelebration returns the correct tier for each outcome
 *   AC-09-005.2 — non-result events classify as "none" (negative AC)
 *   AC-09-005.3 — pure, fixture-tested; ambiguous/unknown → "none" (never default celebration)
 *
 * Traceability (WO-09-002):
 *   AC-09-002.1 — computeAgentLevel returns { level, title, xp, next, pctToNext } with title from Apprentice→Engineer→Senior→Architect
 *   AC-09-002.2 — XP accrues ONLY from that agent's completed WOs (agent + work_order + status:ok); non-WO events → 0 XP (negative AC)
 *   AC-09-002.3 — agent with no closed WOs returns honest zero state, no fake fill (negative AC)
 *   AC-09-002.4 — pure function; unknown agentId returns zero state, not throw
 *
 * FRD-09 blueprint:
 *   IF-09-celebration — classifyCelebration(event): "toast"|"phase"|"release"|"levelup"|"none"
 *   IF-09-agent-xp   — computeAgentLevel(agentId, events): { level, title, xp, next, pctToNext }
 */

import { describe, expect, it } from "vitest";
import type { Event } from "../../events/events";
import {
  AGENT_RANKS,
  AGENT_XP_THRESHOLDS,
  type AgentLevelResult,
  type CelebrationTier,
  classifyCelebration,
  computeAgentLevel,
} from "../gamification";

// ─── helpers ──────────────────────────────────────────────────────────────────

function mkEvent(overrides: Partial<Event>): Event {
  return {
    event: "read",
    at: "2026-06-17T12:00:00Z",
    ...overrides,
  };
}

// ─── AC-09-005.1: outcome events map to their celebration tier ────────────────

describe("classifyCelebration — AC-09-005.1 — outcome events", () => {
  // Work order closed → toast
  it("WHEN event is 'achievement' with a workOrder THEN returns 'toast'", () => {
    const ev = mkEvent({ event: "achievement", workOrder: "WO-01-001", status: "ok" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("toast");
  });

  it("WHEN event is 'achievement' with a workOrder (no status) THEN returns 'toast'", () => {
    const ev = mkEvent({ event: "achievement", workOrder: "WO-03-002" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("toast");
  });

  // Phase completed → phase
  it("WHEN event is 'achievement' scoped to phase (no workOrder) AND status ok THEN returns 'phase'", () => {
    const ev = mkEvent({ event: "achievement", task: "phase:design", status: "ok" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("phase");
  });

  it("WHEN event is 'end' with task containing 'phase' THEN returns 'phase'", () => {
    const ev = mkEvent({ event: "end", task: "phase:architecture" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("phase");
  });

  // Release → release
  it("WHEN event is 'achievement' scoped to 'release' (task='release') THEN returns 'release'", () => {
    const ev = mkEvent({ event: "achievement", task: "release", status: "ok" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("release");
  });

  it("WHEN event is 'end' with task='release' THEN returns 'release'", () => {
    const ev = mkEvent({ event: "end", task: "release" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("release");
  });

  // Level-up → levelup
  it("WHEN event is 'achievement' with task='levelup' THEN returns 'levelup'", () => {
    const ev = mkEvent({ event: "achievement", task: "levelup" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("levelup");
  });

  it("WHEN event is 'achievement' with task='level-up' THEN returns 'levelup'", () => {
    const ev = mkEvent({ event: "achievement", task: "level-up" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("levelup");
  });

  // test_ok (green tests) → toast
  it("WHEN event is 'test_ok' with a workOrder THEN returns 'toast'", () => {
    const ev = mkEvent({ event: "test_ok", workOrder: "WO-09-005", status: "ok" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("toast");
  });

  // handoff (phase transfer) → phase
  it("WHEN event is 'handoff' scoped to a phase task THEN returns 'phase'", () => {
    const ev = mkEvent({ event: "handoff", task: "phase:implementation" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("phase");
  });
});

// ─── AC-09-005.2: non-result (activity) events → "none" (negative ACs) ────────

describe("classifyCelebration — AC-09-005.2 — activity events classify as 'none'", () => {
  it("WHEN event is 'read' THEN returns 'none'", () => {
    expect(classifyCelebration(mkEvent({ event: "read" }))).toBe<CelebrationTier>("none");
  });

  it("WHEN event is 'write' THEN returns 'none'", () => {
    expect(classifyCelebration(mkEvent({ event: "write" }))).toBe<CelebrationTier>("none");
  });

  it("WHEN event is 'edit' THEN returns 'none'", () => {
    expect(classifyCelebration(mkEvent({ event: "edit" }))).toBe<CelebrationTier>("none");
  });

  it("WHEN event is 'message' THEN returns 'none'", () => {
    expect(classifyCelebration(mkEvent({ event: "message" }))).toBe<CelebrationTier>("none");
  });

  it("WHEN event is 'start' THEN returns 'none'", () => {
    expect(classifyCelebration(mkEvent({ event: "start" }))).toBe<CelebrationTier>("none");
  });

  it("WHEN event is 'review' THEN returns 'none'", () => {
    expect(classifyCelebration(mkEvent({ event: "review" }))).toBe<CelebrationTier>("none");
  });

  it("WHEN event is 'blocked' THEN returns 'none'", () => {
    expect(classifyCelebration(mkEvent({ event: "blocked" }))).toBe<CelebrationTier>("none");
  });

  it("WHEN event is 'test_fail' THEN returns 'none' (failure is not a celebration)", () => {
    expect(classifyCelebration(mkEvent({ event: "test_fail" }))).toBe<CelebrationTier>("none");
  });

  it("WHEN event is 'end' with no workOrder or phase task THEN returns 'none'", () => {
    expect(classifyCelebration(mkEvent({ event: "end" }))).toBe<CelebrationTier>("none");
  });

  // XP for activity is FORBIDDEN (FRD-09 ethical constraint)
  it("WHEN event is 'read' even with workOrder THEN returns 'none' (no XP for file access)", () => {
    const ev = mkEvent({ event: "read", workOrder: "WO-01-001" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("none");
  });

  it("WHEN event is 'write' even with workOrder THEN returns 'none' (no XP for file writes)", () => {
    const ev = mkEvent({ event: "write", workOrder: "WO-01-001" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("none");
  });
});

// ─── AC-09-005.3: ambiguous / unknown events → "none" (never a default celebration) ──

describe("classifyCelebration — AC-09-005.3 — unknown/ambiguous events → 'none'", () => {
  it("WHEN event string is empty THEN returns 'none'", () => {
    expect(classifyCelebration(mkEvent({ event: "" }))).toBe<CelebrationTier>("none");
  });

  it("WHEN event string is unknown/arbitrary THEN returns 'none'", () => {
    expect(classifyCelebration(mkEvent({ event: "navigation" }))).toBe<CelebrationTier>("none");
  });

  it("WHEN event string is 'app-open' THEN returns 'none' (app opens never celebrate)", () => {
    expect(classifyCelebration(mkEvent({ event: "app-open" }))).toBe<CelebrationTier>("none");
  });

  it("WHEN event is 'achievement' but status is 'fail' THEN returns 'none' (no celebration for failure)", () => {
    const ev = mkEvent({ event: "achievement", workOrder: "WO-01-001", status: "fail" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("none");
  });

  it("WHEN event is 'test_ok' but has no workOrder or task THEN returns 'none' (ambiguous origin)", () => {
    const ev = mkEvent({ event: "test_ok" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("none");
  });

  it("WHEN event is 'handoff' with no phase task THEN returns 'none' (handoff alone is not a result)", () => {
    const ev = mkEvent({ event: "handoff" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("none");
  });

  it("WHEN event is 'end' with workOrder only (no phase) THEN returns 'none' (end-of-stream, not a result)", () => {
    const ev = mkEvent({ event: "end", workOrder: "WO-01-001" });
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("none");
  });

  // Purity: same input always same output
  it("WHEN called multiple times with the same event THEN always returns the same tier (pure function)", () => {
    const ev = mkEvent({ event: "achievement", workOrder: "WO-09-005", status: "ok" });
    const results = Array.from({ length: 5 }, () => classifyCelebration(ev));
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe<CelebrationTier>("toast");
  });

  it("WHEN called with a frozen event object THEN does not throw (pure, no mutation)", () => {
    const ev = Object.freeze(
      mkEvent({ event: "achievement", workOrder: "WO-01-001", status: "ok" }),
    );
    expect(() => classifyCelebration(ev)).not.toThrow();
    expect(classifyCelebration(ev)).toBe<CelebrationTier>("toast");
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// WO-09-002 — computeAgentLevel (IF-09-agent-xp)
// ════════════════════════════════════════════════════════════════════════════════

// ─── Fixture helpers ─────────────────────────────────────────────────────────

/** Build a closed WO event for a specific agent (agent + workOrder + status:ok). */
function closedWo(agentId: string, workOrder: string, at = "2026-06-17T10:00:00Z"): Event {
  return { event: "achievement", at, agent: agentId, workOrder, status: "ok" };
}

/** Build a non-WO activity event for an agent (should contribute 0 XP). */
function activityEvt(agentId: string, eventType: string): Event {
  return { event: eventType, at: "2026-06-17T10:00:00Z", agent: agentId };
}

/** Build a WO event that lacks status:ok (open/pending — should contribute 0 XP). */
function openWo(agentId: string, workOrder: string): Event {
  return { event: "achievement", at: "2026-06-17T10:00:00Z", agent: agentId, workOrder };
}

/** Build a WO event with status:fail (should contribute 0 XP). */
function failedWo(agentId: string, workOrder: string): Event {
  return {
    event: "achievement",
    at: "2026-06-17T10:00:00Z",
    agent: agentId,
    workOrder,
    status: "fail",
  };
}

// ─── AC-09-002.1: return shape and title ladder ───────────────────────────────

describe("computeAgentLevel — return shape (AC-09-002.1)", () => {
  it("returns an object with all required fields", () => {
    const result = computeAgentLevel("backend-dev", []);
    expect(result).toHaveProperty("level");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("xp");
    expect(result).toHaveProperty("next");
    expect(result).toHaveProperty("pctToNext");
  });

  it("level is a positive integer >= 1", () => {
    const result = computeAgentLevel("backend-dev", []);
    expect(result.level).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(result.level)).toBe(true);
  });

  it("xp is a non-negative number", () => {
    expect(computeAgentLevel("backend-dev", []).xp).toBeGreaterThanOrEqual(0);
  });

  it("pctToNext is between 0 and 1 inclusive", () => {
    const result = computeAgentLevel("backend-dev", []);
    expect(result.pctToNext).toBeGreaterThanOrEqual(0);
    expect(result.pctToNext).toBeLessThanOrEqual(1);
  });

  it("title at level 1 (0 XP) is 'Apprentice'", () => {
    expect(computeAgentLevel("backend-dev", []).title).toBe("Apprentice");
  });

  it("AGENT_RANKS ladder is [Apprentice, Engineer, Senior, Architect] in order", () => {
    expect(AGENT_RANKS[0]).toBe("Apprentice");
    expect(AGENT_RANKS[1]).toBe("Engineer");
    expect(AGENT_RANKS[2]).toBe("Senior");
    expect(AGENT_RANKS[3]).toBe("Architect");
    expect(AGENT_RANKS).toHaveLength(4);
  });

  it("AGENT_XP_THRESHOLDS is exported with 4 strictly-ascending positive values", () => {
    expect(AGENT_XP_THRESHOLDS).toHaveLength(4);
    for (const t of AGENT_XP_THRESHOLDS) {
      expect(t).toBeGreaterThan(0);
    }
    for (let i = 1; i < AGENT_XP_THRESHOLDS.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: index is in-bounds (loop guards i and i-1)
      expect(AGENT_XP_THRESHOLDS[i]).toBeGreaterThan(AGENT_XP_THRESHOLDS[i - 1]!);
    }
  });

  it("title advances to 'Engineer' when XP reaches first threshold", () => {
    // biome-ignore lint/style/noNonNullAssertion: AGENT_XP_THRESHOLDS[0] is always defined (4 entries)
    const threshold = AGENT_XP_THRESHOLDS[0]!;
    const events: Event[] = Array.from({ length: threshold }, (_, i) =>
      closedWo("agent-x", `WO-01-${String(i).padStart(3, "0")}`),
    );
    const result = computeAgentLevel("agent-x", events);
    expect(result.title).toBe("Engineer");
    expect(result.level).toBe(2);
  });

  it("title advances to 'Senior' when XP reaches second threshold", () => {
    // biome-ignore lint/style/noNonNullAssertion: AGENT_XP_THRESHOLDS[1] is always defined (4 entries)
    const threshold = AGENT_XP_THRESHOLDS[1]!;
    const events: Event[] = Array.from({ length: threshold }, (_, i) =>
      closedWo("agent-x", `WO-02-${String(i).padStart(3, "0")}`),
    );
    const result = computeAgentLevel("agent-x", events);
    expect(result.title).toBe("Senior");
    expect(result.level).toBe(3);
  });

  it("title advances to 'Architect' when XP reaches third threshold", () => {
    // biome-ignore lint/style/noNonNullAssertion: AGENT_XP_THRESHOLDS[2] is always defined (4 entries)
    const threshold = AGENT_XP_THRESHOLDS[2]!;
    const events: Event[] = Array.from({ length: threshold }, (_, i) =>
      closedWo("agent-x", `WO-03-${String(i).padStart(3, "0")}`),
    );
    const result = computeAgentLevel("agent-x", events);
    expect(result.title).toBe("Architect");
    expect(result.level).toBe(4);
  });
});

// ─── AC-09-002.2: XP only from agent's closed WOs (positive + negative AC) ──

describe("computeAgentLevel — XP source rules (AC-09-002.2)", () => {
  it("one closed WO gives XP > 0", () => {
    const result = computeAgentLevel("backend-dev", [closedWo("backend-dev", "WO-01-001")]);
    expect(result.xp).toBeGreaterThan(0);
  });

  it("two closed WOs give more XP than one (monotonic)", () => {
    const one = computeAgentLevel("backend-dev", [closedWo("backend-dev", "WO-01-001")]);
    const two = computeAgentLevel("backend-dev", [
      closedWo("backend-dev", "WO-01-001"),
      closedWo("backend-dev", "WO-01-002"),
    ]);
    expect(two.xp).toBeGreaterThan(one.xp);
  });

  it("NEGATIVE AC: 'message' events do NOT contribute XP", () => {
    expect(
      computeAgentLevel("backend-dev", [
        activityEvt("backend-dev", "message"),
        activityEvt("backend-dev", "message"),
      ]).xp,
    ).toBe(0);
  });

  it("NEGATIVE AC: 'read' events do NOT contribute XP", () => {
    expect(
      computeAgentLevel("backend-dev", [
        activityEvt("backend-dev", "read"),
        activityEvt("backend-dev", "read"),
      ]).xp,
    ).toBe(0);
  });

  it("NEGATIVE AC: 'write'/'edit'/'tool' events do NOT contribute XP", () => {
    expect(
      computeAgentLevel("backend-dev", [
        activityEvt("backend-dev", "write"),
        activityEvt("backend-dev", "edit"),
        activityEvt("backend-dev", "tool"),
      ]).xp,
    ).toBe(0);
  });

  it("NEGATIVE AC: 'start'/'end'/'handoff' events do NOT contribute XP", () => {
    expect(
      computeAgentLevel("backend-dev", [
        activityEvt("backend-dev", "start"),
        activityEvt("backend-dev", "end"),
        activityEvt("backend-dev", "handoff"),
      ]).xp,
    ).toBe(0);
  });

  it("NEGATIVE AC: 'blocked'/'review' events do NOT contribute XP", () => {
    expect(
      computeAgentLevel("backend-dev", [
        activityEvt("backend-dev", "blocked"),
        activityEvt("backend-dev", "review"),
      ]).xp,
    ).toBe(0);
  });

  it("NEGATIVE AC: 'test_ok' without work_order does NOT contribute XP", () => {
    const events: Event[] = [
      { event: "test_ok", at: "2026-06-17T10:00:00Z", agent: "backend-dev" },
    ];
    expect(computeAgentLevel("backend-dev", events).xp).toBe(0);
  });

  it("NEGATIVE AC: WO event with status:'fail' does NOT contribute XP", () => {
    expect(computeAgentLevel("backend-dev", [failedWo("backend-dev", "WO-01-001")]).xp).toBe(0);
  });

  it("NEGATIVE AC: WO event without status (open/pending) does NOT contribute XP", () => {
    expect(computeAgentLevel("backend-dev", [openWo("backend-dev", "WO-01-001")]).xp).toBe(0);
  });

  it("NEGATIVE AC: events from OTHER agents do NOT contribute to this agent's XP", () => {
    const events = [
      closedWo("frontend-dev", "WO-01-001"),
      closedWo("test-writer", "WO-01-002"),
      closedWo("researcher", "WO-01-003"),
    ];
    expect(computeAgentLevel("backend-dev", events).xp).toBe(0);
  });

  it("NEGATIVE AC: events without agent field do NOT contribute XP", () => {
    const events: Event[] = [
      { event: "achievement", at: "2026-06-17T10:00:00Z", workOrder: "WO-01-001", status: "ok" },
    ];
    expect(computeAgentLevel("backend-dev", events).xp).toBe(0);
  });

  it("mixed stream: only counts this agent's closed WOs", () => {
    const id = "backend-dev";
    const events: Event[] = [
      closedWo(id, "WO-01-001"), // +1 XP
      activityEvt(id, "message"), // +0
      closedWo("frontend-dev", "WO-02-001"), // +0 (wrong agent)
      failedWo(id, "WO-01-002"), // +0 (fail)
      openWo(id, "WO-01-003"), // +0 (no status:ok)
      closedWo(id, "WO-01-004"), // +1 XP
      activityEvt(id, "read"), // +0
    ];
    const result = computeAgentLevel(id, events);
    const expected = computeAgentLevel(id, [closedWo(id, "WO-A"), closedWo(id, "WO-B")]);
    expect(result.xp).toBe(expected.xp);
  });
});

// ─── AC-09-002.3: no closed WOs → honest zero state (negative AC) ────────────

describe("computeAgentLevel — zero state when no closed WOs (AC-09-002.3)", () => {
  it("NEGATIVE AC: empty events array → xp === 0", () => {
    expect(computeAgentLevel("backend-dev", []).xp).toBe(0);
  });

  it("NEGATIVE AC: zero XP → pctToNext === 0 (bar not fake-filled)", () => {
    expect(computeAgentLevel("backend-dev", []).pctToNext).toBe(0);
  });

  it("NEGATIVE AC: zero XP → level === 1 (not fake-leveled)", () => {
    expect(computeAgentLevel("backend-dev", []).level).toBe(1);
  });

  it("NEGATIVE AC: zero XP → title === 'Apprentice' (not a higher rank)", () => {
    expect(computeAgentLevel("backend-dev", []).title).toBe("Apprentice");
  });

  it("NEGATIVE AC: zero XP → pctToNext < 0.7 (FRD-09 bar-stuck-at-80% forbidden pattern)", () => {
    expect(computeAgentLevel("backend-dev", []).pctToNext).toBeLessThan(0.7);
  });

  it("NEGATIVE AC: only activity events → same zero state as empty array", () => {
    const withActivity = computeAgentLevel("backend-dev", [
      activityEvt("backend-dev", "message"),
      activityEvt("backend-dev", "read"),
      activityEvt("backend-dev", "write"),
    ]);
    const empty = computeAgentLevel("backend-dev", []);
    expect(withActivity).toEqual(empty);
  });
});

// ─── AC-09-002.4: pure function + unknown agentId → zero, not throw ──────────

describe("computeAgentLevel — purity and unknown agent (AC-09-002.4)", () => {
  it("unknown agentId returns zero state, does NOT throw", () => {
    const events = [closedWo("backend-dev", "WO-01-001")];
    expect(() => computeAgentLevel("unknown-agent-xyz", events)).not.toThrow();
    const result = computeAgentLevel("unknown-agent-xyz", events);
    expect(result.xp).toBe(0);
    expect(result.level).toBe(1);
  });

  it("empty string agentId returns zero state, does NOT throw", () => {
    const events = [closedWo("backend-dev", "WO-01-001")];
    expect(() => computeAgentLevel("", events)).not.toThrow();
    expect(computeAgentLevel("", events).xp).toBe(0);
  });

  it("is pure: same inputs → same outputs", () => {
    const id = "backend-dev";
    const events = [closedWo(id, "WO-01-001"), closedWo(id, "WO-01-002")];
    expect(computeAgentLevel(id, events)).toEqual(computeAgentLevel(id, events));
  });

  it("does NOT mutate the events array", () => {
    const id = "backend-dev";
    const events = [closedWo(id, "WO-01-001"), closedWo(id, "WO-01-002")];
    const originalLength = events.length;
    computeAgentLevel(id, events);
    expect(events.length).toBe(originalLength);
  });

  it("different agents on the same event list are independent", () => {
    const events = [
      closedWo("backend-dev", "WO-01-001"),
      closedWo("backend-dev", "WO-01-002"),
      closedWo("frontend-dev", "WO-02-001"),
    ];
    const be = computeAgentLevel("backend-dev", events);
    const fe = computeAgentLevel("frontend-dev", events);
    expect(be.xp).toBeGreaterThan(fe.xp);
  });

  it("all result fields are primitives (serializable)", () => {
    const result = computeAgentLevel("backend-dev", [closedWo("backend-dev", "WO-01-001")]);
    expect(typeof result.level).toBe("number");
    expect(typeof result.title).toBe("string");
    expect(typeof result.xp).toBe("number");
    expect(typeof result.next).toBe("number");
    expect(typeof result.pctToNext).toBe("number");
  });
});

// ─── pctToNext and next threshold math ───────────────────────────────────────

describe("computeAgentLevel — pctToNext and next threshold math", () => {
  it("pctToNext is 0 with 0 XP", () => {
    expect(computeAgentLevel("agent", []).pctToNext).toBe(0);
  });

  it("pctToNext grows as XP increases within the same level", () => {
    const partial = computeAgentLevel("agent", [closedWo("agent", "WO-01-001")]);
    expect(partial.pctToNext).toBeGreaterThan(0);
    expect(partial.pctToNext).toBeLessThan(1);
  });

  it("at exactly the first threshold, level advances and pctToNext resets to 0", () => {
    // biome-ignore lint/style/noNonNullAssertion: AGENT_XP_THRESHOLDS[0] is always defined (4 entries)
    const threshold = AGENT_XP_THRESHOLDS[0]!;
    const events: Event[] = Array.from({ length: threshold }, (_, i) =>
      closedWo("agent", `WO-A-${i}`),
    );
    const result = computeAgentLevel("agent", events);
    expect(result.level).toBe(2);
    expect(result.pctToNext).toBe(0);
  });

  it("next at level 1 equals the first XP threshold", () => {
    expect(computeAgentLevel("agent", []).next).toBe(AGENT_XP_THRESHOLDS[0]);
  });

  it("at max level (Architect, level 4), pctToNext is 1 (fully maxed)", () => {
    // biome-ignore lint/style/noNonNullAssertion: AGENT_XP_THRESHOLDS[3] is always defined (4 entries)
    const maxThreshold = AGENT_XP_THRESHOLDS[3]!;
    const events: Event[] = Array.from({ length: maxThreshold }, (_, i) =>
      closedWo("agent", `WO-MAX-${i}`),
    );
    const result = computeAgentLevel("agent", events);
    expect(result.level).toBe(4);
    expect(result.title).toBe("Architect");
    expect(result.pctToNext).toBe(1);
  });
});

// ─── AgentLevelResult type export ────────────────────────────────────────────

describe("AgentLevelResult type export", () => {
  it("type is exported and structurally matches the returned value", () => {
    const result: AgentLevelResult = computeAgentLevel("backend-dev", []);
    expect(result).toBeDefined();
  });
});
