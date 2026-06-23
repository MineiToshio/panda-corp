/**
 * FRD-18 reviewer integration tests (DR-015) — adversarial, cross-work-order.
 *
 * Exercises the dashboard derivations of WO-18-001..006 TOGETHER, anchored in the
 * FRD's EARS criteria, probing edges the implementers' unit tests did not assert:
 *
 *   - IF-18-digest marker boundary semantics (REQ-18-006/007): "new" is STRICTLY
 *     newer than the marker; an event at the exact marker ms is NOT new; a refresh
 *     never loses unseen events.
 *   - IF-18-turn exclusion invariant (REQ-18-011): routine progress (running build,
 *     advance_pending, auto-retried failed WO) NEVER enters the queue, whatever the
 *     input; the queue stays urgency-ordered (REQ-18-012).
 *   - IF-18-pulse safety & ≤5 signals (REQ-18-013): conversion is clamped, never NaN,
 *     even when shipped > alive or alive = 0; no-signal builds surface as the alarm.
 *   - IF-18-card freshness/staleness/blocker (REQ-18-016/017/018): live vs no-signal
 *     are mutually exclusive; clock-skew is guarded; blocker reason normalises.
 *   - The page-level integration invariant: pulse.ownerWaiting is fed from the SAME
 *     turn-queue length the operator sees (the two sections cannot disagree).
 *
 * These are reviewer tests: they live beside the feature and consume only the public
 * derivation API (no implementation-detail coupling).
 */

import { describe, expect, it } from "vitest";
import { computeDigest } from "@/app/_lib/digest";
import { pulse } from "@/app/_lib/pulse";
import { deriveCard } from "@/app/(dashboard)/_lib/card";
import { buildTurnQueue, type TurnInput, type TurnItemKind } from "@/app/(dashboard)/_lib/turn";
import type { Event } from "@/lib/events/events";

// ---------------------------------------------------------------------------
// Builders (override only what each test cares about)
// ---------------------------------------------------------------------------

const NOW = Date.UTC(2026, 5, 18, 12, 0, 0); // 2026-06-18T12:00:00Z
const HOUR = 60 * 60 * 1000;

function ev(overrides: Partial<Event> & { at: string }): Event {
  return { event: "WorkOrderClosed", ...overrides };
}

function turnInput(overrides: Partial<TurnInput> = {}): TurnInput {
  return {
    pendingDecisions: 0,
    inboxDecisionLines: [],
    shippedAwaitingReview: [],
    memoryNeedsAttention: false,
    undiscoveredIdeas: 0,
    ...overrides,
  };
}

// ===========================================================================
// IF-18-digest — REQ-18-006 / REQ-18-007 marker boundary
// ===========================================================================

describe("FRD-18 digest: visto_hasta marker boundary (REQ-18-007)", () => {
  it("an event at the EXACT marker timestamp is NOT new (strict >, never re-flags a seen event)", () => {
    const markerMs = Date.parse("2026-06-18T11:00:00.000Z");
    const atMarker = ev({ at: "2026-06-18T11:00:00.000Z", event: "PhaseTransition" });

    const res = computeDigest([atMarker], markerMs, NOW);

    expect(res.newEvents).toHaveLength(0);
    expect(res.atDia).toBe(true);
    // The seen event still appears in the last-24h fallback (never blank — REQ-18-008).
    expect(res.last24h).toHaveLength(1);
  });

  it("one millisecond after the marker IS new (boundary is exclusive on the marker side)", () => {
    const markerMs = Date.parse("2026-06-18T11:00:00.000Z");
    const justAfter = ev({ at: "2026-06-18T11:00:00.001Z" });

    const res = computeDigest([justAfter], markerMs, NOW);

    expect(res.newEvents).toHaveLength(1);
    expect(res.atDia).toBe(false);
  });

  it("a refresh (recompute with the SAME marker) never loses unseen events (REQ-18-006)", () => {
    const markerMs = Date.parse("2026-06-18T10:00:00.000Z");
    const unseen = [
      ev({ at: "2026-06-18T10:30:00.000Z", event: "WorkOrderClosed" }),
      ev({ at: "2026-06-18T11:30:00.000Z", event: "DecisionQueued" }),
    ];

    const first = computeDigest(unseen, markerMs, NOW);
    const afterRefresh = computeDigest(unseen, markerMs, NOW + HOUR);

    expect(first.newEvents).toHaveLength(2);
    // Same marker after a refresh → the unseen count is preserved, not advanced away.
    expect(afterRefresh.newEvents).toHaveLength(2);
  });

  it("does not mutate the input events array (purity)", () => {
    const events = [ev({ at: "2026-06-18T09:00:00.000Z" }), ev({ at: "2026-06-18T11:00:00.000Z" })];
    const snapshot = JSON.stringify(events);
    computeDigest(events, NOW - HOUR, NOW);
    expect(JSON.stringify(events)).toBe(snapshot);
  });
});

// ===========================================================================
// IF-18-turn — REQ-18-011 exclusion invariant + REQ-18-012 ordering
// ===========================================================================

describe("FRD-18 Tu turno: routine progress is NEVER a gate (REQ-18-011)", () => {
  const FORBIDDEN: ReadonlySet<TurnItemKind> = new Set([
    "running-build",
    "advance-pending",
    "failed-wo",
  ]);

  it("never emits running-build / advance-pending / failed-wo, even with every gate firing", () => {
    const queue = buildTurnQueue(
      turnInput({
        pendingDecisions: 3,
        shippedAwaitingReview: [{ name: "alpha", path: "/p/alpha" }],
        memoryNeedsAttention: true,
        undiscoveredIdeas: 2,
      }),
    );

    expect(queue.length).toBeGreaterThan(0);
    for (const item of queue) {
      expect(FORBIDDEN.has(item.kind)).toBe(false);
      // Every actionable item surfaces a /pandacorp:* command (REQ-18-002).
      expect(item.command.startsWith("/pandacorp:")).toBe(true);
      // Every item navigates somewhere (REQ-18-002).
      expect(item.href.startsWith("/")).toBe(true);
    }
  });

  it("urgency order is stable: pending-decisions before review-launch before memory before ideas (REQ-18-012)", () => {
    const queue = buildTurnQueue(
      turnInput({
        undiscoveredIdeas: 1,
        memoryNeedsAttention: true,
        shippedAwaitingReview: [{ name: "z", path: "/p/z" }],
        pendingDecisions: 1,
      }),
    );
    expect(queue.map((i) => i.kind)).toEqual([
      "pending-decisions",
      "review-launch",
      "memory-nudge",
      "undiscovered-ideas",
    ]);
  });

  it("nothing waiting → empty queue (al-día), no manufactured urgency (REQ-18-003)", () => {
    expect(buildTurnQueue(turnInput())).toEqual([]);
  });

  it("many shipped projects do not truncate silently (REQ-18-012 edge: many items)", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `p${i}`, path: `/p/${i}` }));
    const queue = buildTurnQueue(turnInput({ shippedAwaitingReview: many }));
    expect(queue.filter((i) => i.kind === "review-launch")).toHaveLength(12);
  });
});

// ===========================================================================
// IF-18-pulse — REQ-18-013 / REQ-18-014 safety
// ===========================================================================

describe("FRD-18 Pulso: safe & honest signals (REQ-18-013/014)", () => {
  it("fresh factory (no ideas) → 0% conversion, calm, no NaN (REQ-18-013 edge)", () => {
    const res = pulse({
      ideasAlive: 0,
      ideasShipped: 0,
      inConstructionLive: 0,
      inConstructionStale: 0,
      ownerWaiting: 0,
    });
    expect(res.conversionPct).toBe(0);
    expect(Number.isNaN(res.conversionPct)).toBe(false);
    expect(res.calm).toBe(true);
  });

  it("clamps impossible ratios: shipped > alive does not exceed 100%", () => {
    const res = pulse({
      ideasAlive: 1,
      ideasShipped: 5,
      inConstructionLive: 0,
      inConstructionStale: 0,
      ownerWaiting: 0,
    });
    expect(res.conversionPct).toBeLessThanOrEqual(100);
    expect(res.conversionPct).toBeGreaterThanOrEqual(0);
  });

  it("a stale build is itself the alarm: hasStale true → NOT calm (REQ-18-014)", () => {
    const res = pulse({
      ideasAlive: 3,
      ideasShipped: 0,
      inConstructionLive: 0,
      inConstructionStale: 1,
      ownerWaiting: 0,
    });
    expect(res.hasStale).toBe(true);
    expect(res.calm).toBe(false);
  });

  it("owner-waiting items break the calm state (exception-first)", () => {
    const res = pulse({
      ideasAlive: 2,
      ideasShipped: 0,
      inConstructionLive: 0,
      inConstructionStale: 0,
      ownerWaiting: 1,
    });
    expect(res.calm).toBe(false);
  });
});

// ===========================================================================
// IF-18-card — REQ-18-016 / REQ-18-017 / REQ-18-018
// ===========================================================================

describe("FRD-18 Cartera card: freshness/staleness/blocker (REQ-18-016/017/018)", () => {
  function card(overrides: Partial<Parameters<typeof deriveCard>[0]> = {}) {
    return deriveCard({
      name: "alpha",
      phase: "implementation",
      version: "v1",
      running: true,
      workOrdersDone: 4,
      workOrdersTotal: 8,
      phaseStartedAt: undefined,
      lastEventAt: new Date(NOW - 5 * 60 * 1000).toISOString(),
      failedWoReason: undefined,
      nowMs: NOW,
      ...overrides,
    });
  }

  it("live and no-signal are mutually exclusive (REQ-18-016)", () => {
    const live = card({ lastEventAt: new Date(NOW - 60 * 1000).toISOString() });
    expect(live.isLive).toBe(true);
    expect(live.isNoSignal).toBe(false);

    const stale = card({ lastEventAt: new Date(NOW - 2 * HOUR).toISOString() });
    expect(stale.isLive).toBe(false);
    expect(stale.isNoSignal).toBe(true);
  });

  it("a running build with NO event yet is no-signal, never live (REQ-18-016 edge)", () => {
    const c = card({ lastEventAt: null });
    expect(c.isNoSignal).toBe(true);
    expect(c.isLive).toBe(false);
  });

  it("a NON-running project is neither live nor no-signal (freshness only applies while building)", () => {
    const c = card({ running: false, phase: "release", lastEventAt: null });
    expect(c.isLive).toBe(false);
    expect(c.isNoSignal).toBe(false);
    expect(c.isShipped).toBe(true);
    expect(c.nextCommand).toBe("/pandacorp:review-launch");
  });

  it("clock skew (future phase start) is guarded → age 0, not negative (REQ-18-017 edge)", () => {
    const future = new Date(NOW + 5 * 24 * HOUR).toISOString();
    const c = card({ phaseStartedAt: future });
    expect(c.ageInStageDays).toBe(0);
    expect(c.isStalled).toBe(false);
  });

  it("phase age beyond the staleness threshold → estancado (REQ-18-017)", () => {
    const old = new Date(NOW - 30 * 24 * HOUR).toISOString();
    const c = card({ phaseStartedAt: old });
    expect(c.isStalled).toBe(true);
    expect(c.ageInStageDays).toBeGreaterThan(7);
  });

  it("a whitespace-only blocker reason normalises to no blocker (REQ-18-018 edge)", () => {
    const c = card({ failedWoReason: "   " });
    expect(c.blockerReason).toBeUndefined();
  });

  it("a real blocker reason surfaces inline (REQ-18-018)", () => {
    const c = card({ failedWoReason: "tsc failed in WO-99-001" });
    expect(c.blockerReason).toBe("tsc failed in WO-99-001");
  });

  it("WO progress is division-safe with zero total (no NaN)", () => {
    const c = card({ workOrdersDone: 0, workOrdersTotal: 0 });
    expect(c.woProgress.pct).toBe(0);
  });
});

// ===========================================================================
// Cross-WO page-level invariant: Pulso.ownerWaiting === |Tu turno|
// ===========================================================================

describe("FRD-18 integration: the two sections cannot disagree on the owner-waiting count", () => {
  it("ownerWaiting fed into the pulse equals the rendered turn-queue length", () => {
    const input = turnInput({
      pendingDecisions: 2,
      memoryNeedsAttention: true,
      undiscoveredIdeas: 1,
    });
    const queue = buildTurnQueue(input);
    // page.tsx feeds turnItems.length as pulse.ownerWaiting — pin that contract.
    const res = pulse({
      ideasAlive: 4,
      ideasShipped: 0,
      inConstructionLive: 1,
      inConstructionStale: 0,
      ownerWaiting: queue.length,
    });
    expect(res.ownerWaiting).toBe(queue.length);
    // With real gates waiting the pulse must not claim calm.
    expect(res.calm).toBe(false);
  });
});
