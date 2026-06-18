/**
 * WO-06-003 — Event → visual-state map (the decoupling boundary)
 *
 * Pure module — no DOM, no I/O, no side-effects.
 *
 * Exports:
 *   - VisualAction  — discriminated union of all engine actions
 *   - eventToVisual(event: DashboardEvent): VisualAction   IF-06-state-map
 *
 * The decoupling boundary: raw DashboardEvents → typed engine instructions.
 * The engine (IF-06-engine, WO-06-004) consumes VisualActions; it never reads
 * the raw event stream. This is the only place that knows both vocabularies.
 *
 * Mapping (PARTY.md §4 + blueprint §2 IF-06-state-map, architecture §5):
 *   start                           → setState(agent, 'work')
 *   handoff(from, to)               → startHandoff(from, target=to)
 *   handoff(from, no target)        → setState(from, 'walk')  [solo handoff fallback]
 *   end                             → setState(agent, 'idle')
 *   blocked                         → setState(agent, 'blocked')
 *   review                          → setState(agent, 'review')
 *   achievement                     → fireAchievement(agent?, workOrder?)
 *   test_fail / status:'fail'       → downSprite(agent?)  [failure first-class, AC-06-013.1]
 *   unknown                         → noop  [defensive]
 *
 * Failure overrides event semantics: if status==='fail' OR event==='test_fail',
 * downSprite is always returned regardless of the event type (AC-06-013.1:
 * never hidden, distinct from completed).
 *
 * Traceability:
 *   IF-06-state-map → REQ-06-004, REQ-06-005, REQ-06-007, REQ-06-013
 *
 * Dependencies:
 *   IF-01-readEvents (lib/events.ts) — the Event type consumed as DashboardEvent
 *   WO-06-001 (event-vm.ts) — EventType union (for vocabulary alignment, not imported here;
 *     the mapping is over string values from the raw event stream)
 */

import type { Event as DashboardEvent } from "@/lib/events/events";

// ---------------------------------------------------------------------------
// AgentState — the visual states a sprite can be in (PARTY.md §1)
// CSS classes: s-work / s-walk / s-idle / s-blocked / s-review
// ---------------------------------------------------------------------------

/**
 * Visual states a sprite can occupy.
 * These map directly to CSS classes: `.mcag.s-<state>` (PARTY.md §1).
 */
export type AgentState = "work" | "walk" | "idle" | "blocked" | "review";

// ---------------------------------------------------------------------------
// VisualAction — discriminated union consumed by the engine (IF-06-engine)
// ---------------------------------------------------------------------------

/**
 * Set an agent sprite to a specific visual state.
 * Used for: start→work, end→idle, blocked→blocked, review→review, handoff-no-target→walk.
 */
export type SetStateAction = {
  kind: "setState";
  agentId: string;
  state: AgentState;
};

/**
 * Begin a handoff animation from agentId walking to targetId's zone.
 * Both sprites end up together; a speech bubble is shown (AC-06-004.1).
 */
export type StartHandoffAction = {
  kind: "startHandoff";
  agentId: string;
  targetId: string;
};

/**
 * Fire the "Achievement unlocked!" celebration (AC-06-007.1).
 * agentId / workOrder may be undefined when the event omits them.
 */
export type FireAchievementAction = {
  kind: "fireAchievement";
  agentId: string | undefined;
  workOrder: string | undefined;
};

/**
 * Put the agent sprite into a "downed" (failed) state — first-class, never hidden (AC-06-013.1).
 * agentId may be undefined when the event omits the agent field.
 */
export type DownSpriteAction = {
  kind: "downSprite";
  agentId: string | undefined;
};

/**
 * Safe no-op for unknown / unactionable events (defensive).
 * The engine ignores noops; they must never cause errors.
 */
export type NoopAction = {
  kind: "noop";
};

/**
 * Discriminated union of all actions the engine can process.
 * The engine (IF-06-engine) is the sole consumer; it switches on `kind`.
 */
export type VisualAction =
  | SetStateAction
  | StartHandoffAction
  | FireAchievementAction
  | DownSpriteAction
  | NoopAction;

// ---------------------------------------------------------------------------
// Canonical event types handled by this mapper
// (a subset of EventType from event-vm.ts — only the ones with visual meaning)
// ---------------------------------------------------------------------------

const KNOWN_EVENTS = new Set([
  "start",
  "handoff",
  "end",
  "blocked",
  "review",
  "achievement",
  "test_fail",
]);

// ---------------------------------------------------------------------------
// IF-06-state-map — eventToVisual (pure mapper)
// ---------------------------------------------------------------------------

/**
 * Map a raw DashboardEvent to a VisualAction for the engine.
 *
 * Rules (PARTY.md §4 + blueprint §2 IF-06-state-map):
 *
 * 1. FAILURE FIRST (AC-06-013.1): if status==='fail' OR event==='test_fail',
 *    return downSprite immediately — failure is never filtered or hidden,
 *    and it overrides the normal event semantics.
 *
 * 2. ACHIEVEMENT (AC-06-007.1): event==='achievement' → fireAchievement.
 *    Checked before other state-transitions so the celebration always fires.
 *
 * 3. HANDOFF (AC-06-004.1): event==='handoff' with both agent+target
 *    → startHandoff (both end up together). With agent but no target → setState walk.
 *    With no agent → noop.
 *
 * 4. STATE TRANSITIONS: start/end/blocked/review → setState the appropriate state.
 *    All require an agent; no-agent → noop.
 *
 * 5. UNKNOWN: anything not in KNOWN_EVENTS → noop (defensive, no throw).
 *
 * @param event - Raw event from the dashboard NDJSON stream (lib/events.ts).
 * @returns VisualAction — always defined, never throws.
 */
export function eventToVisual(event: DashboardEvent): VisualAction {
  const { event: evType, agent, session, workOrder, status } = event;

  // -------------------------------------------------------------------------
  // Rule 1 — FAILURE OVERRIDES (AC-06-013.1)
  // test_fail event OR status==='fail' → downSprite; never hidden.
  // -------------------------------------------------------------------------
  if (status === "fail" || evType === "test_fail") {
    return { kind: "downSprite", agentId: agent };
  }

  // -------------------------------------------------------------------------
  // Rule 2 — ACHIEVEMENT (AC-06-007.1)
  // Work-order close fires an achievement regardless of agent presence.
  // -------------------------------------------------------------------------
  if (evType === "achievement") {
    return { kind: "fireAchievement", agentId: agent, workOrder };
  }

  // -------------------------------------------------------------------------
  // Rule 3 — HANDOFF (AC-06-004.1)
  // `session` carries the target role for the handoff (the NDJSON emitter uses
  // the `session` field as the handoff target per the event contract).
  // -------------------------------------------------------------------------
  if (evType === "handoff") {
    if (agent === undefined) return { kind: "noop" };
    if (session !== undefined) {
      // Full handoff: both sprites walk toward each other and end up together.
      return { kind: "startHandoff", agentId: agent, targetId: session };
    }
    // Solo handoff fallback: agent walks without a known target.
    return { kind: "setState", agentId: agent, state: "walk" };
  }

  // -------------------------------------------------------------------------
  // Rules 4 — STATE TRANSITIONS
  // All require an agent field; missing agent → noop.
  // -------------------------------------------------------------------------
  if (agent === undefined) {
    // Can only reach here for start/end/blocked/review and unknown types.
    // In all cases: no agent → noop.
    return { kind: "noop" };
  }

  switch (evType) {
    case "start":
      return { kind: "setState", agentId: agent, state: "work" };

    case "end":
      return { kind: "setState", agentId: agent, state: "idle" };

    case "blocked":
      return { kind: "setState", agentId: agent, state: "blocked" };

    case "review":
      return { kind: "setState", agentId: agent, state: "review" };

    default:
      // Rule 5 — UNKNOWN / unhandled event type → defensive noop.
      return { kind: "noop" };
  }
}

// Re-export KNOWN_EVENTS for consumers that need to check membership
// (e.g. the engine's batch-apply to skip events it has already handled).
export { KNOWN_EVENTS as STATE_MAP_KNOWN_EVENTS };
