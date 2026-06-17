/**
 * WO-09-005 — classifyCelebration tests
 *
 * Traceability:
 *   AC-09-005.1 — classifyCelebration returns the correct tier for each outcome
 *   AC-09-005.2 — non-result events classify as "none" (negative AC)
 *   AC-09-005.3 — pure, fixture-tested; ambiguous/unknown → "none" (never default celebration)
 *
 * FRD-09 blueprint IF-09-celebration:
 *   `classifyCelebration(event): "toast" | "phase" | "release" | "levelup" | "none"`
 *   Maps outcome events to the correct celebration tier so celebrations scale, never flat.
 */

import { describe, expect, it } from "vitest";
import type { Event } from "./events";
import { type CelebrationTier, classifyCelebration } from "./gamification";

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
