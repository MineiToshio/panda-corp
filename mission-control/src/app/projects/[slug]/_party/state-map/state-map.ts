/**
 * WO-06-003 — Event → visual-action map (La Fragua decoupling boundary)
 * Wave 2 (La Fragua redesign, 2026-06-18)
 *
 * Pure module — no DOM, no I/O, no side-effects.
 *
 * Exports:
 *   - WoState         — visual states a work-order sprite can be in
 *   - RelayStep       — the three deep-mode relay sub-steps
 *   - VisualAction    — 10-member discriminated union of all engine actions
 *   - eventToVisual(event: DashboardEvent): VisualAction   IF-06-state-map
 *   - STATE_MAP_KNOWN_EVENTS   — set of event types with visual meaning
 *
 * The decoupling boundary: raw DashboardEvents → typed engine instructions.
 * The engine (IF-06-engine, WO-06-004) consumes VisualActions; it never reads
 * the raw event stream. This is the only place that knows both vocabularies.
 *
 * Redesign rationale (La Fragua, 2026-06-18):
 *   The old map was agent/zone-keyed (setState(agent, 'work'/'walk'), handoff
 *   between stages, researcher-on-demand). The faithful model is work-order-keyed
 *   with new event kinds (HandoffWritten, ContractPublished, relay `activity`,
 *   gate open) and no live peer chat.
 *
 * Mapping (blueprint §2 IF-06-state-map, FRD-06 REQ-06-001..012):
 *
 *   AgentWorking + phase:'build' + workOrder
 *     + mode:'deep' + activity in RELAY_STEPS  → advanceRelay(wo, step)
 *     + otherwise                              → setWo(wo, 'building')
 *
 *   AgentWorking + phase:'review'              → openGate()
 *
 *   HandoffWritten + workOrder                 → startHandoff(fromWo=workOrder, toWo=session)
 *
 *   ContractPublished + workOrder              → publishContract(wo)
 *
 *   SubagentStop + workOrder                   → verifyWo(wo)
 *
 *   achievement                                → fireAchievement(wo=workOrder?)
 *
 *   test_fail  OR  status:'fail'               → downSprite(wo=workOrder?)  [FAILURE FIRST — AC-06-012.1]
 *
 *   anything else                              → noop  [defensive]
 *
 * Event field conventions for new event kinds:
 *   HandoffWritten:      workOrder = fromWo;  session  = toWo (dependent WO in Build Plan)
 *   ContractPublished:   workOrder = the WO that published the contract
 *   SubagentStop:        workOrder = the WO that stopped/closed
 *
 * Traceability:
 *   IF-06-state-map → REQ-06-001, REQ-06-003, REQ-06-006, REQ-06-007, REQ-06-012
 *
 * Dependencies:
 *   IF-01-readEvents (lib/events.ts) — the Event type consumed as DashboardEvent
 *   WO-06-001 (event-vm.ts)          — EventType/VM types (vocabulary alignment)
 *   WO-06-012 (lib/events.ts)        — enriched optional fields (phase, activity, mode, role)
 */

import type { Event as DashboardEvent } from "@/lib/events/events";

// ---------------------------------------------------------------------------
// WoState — visual states a work-order sprite can occupy
// ---------------------------------------------------------------------------

/**
 * Visual state of a work-order sprite in La Fragua.
 * These drive CSS classes and engine transitions.
 *
 * - 'building'  : WO is actively being implemented (Sala de Forja)
 * - 'in_review' : WO is in the Tribunal del Juez (gate review)
 * - 'verified'  : WO has been verified (Bóveda trophy)
 * - 'blocked'   : WO is blocked / failed (first-class failure state)
 */
export type WoState = "building" | "in_review" | "verified" | "blocked";

// ---------------------------------------------------------------------------
// RelayStep — the three deep-mode relay sub-steps (REQ-06-007)
// ---------------------------------------------------------------------------

/**
 * The three sequential steps of the deep-mode relay (Opus).
 * Active only when mode='deep' and the WO has a frontend.
 *
 * test-writer (RED) → backend-dev → frontend-dev
 */
export type RelayStep = "test" | "backend" | "frontend";

// ---------------------------------------------------------------------------
// VisualAction — discriminated union consumed by the engine (IF-06-engine)
// ---------------------------------------------------------------------------

/**
 * Set a work-order sprite's visual state (e.g. building, in_review, verified, blocked).
 * Used for: AgentWorking phase:build → setWo(wo,'building').
 */
type SetWoAction = {
  kind: "setWo";
  wo: string;
  state: WoState;
};

/**
 * Enqueue a work order that is not yet building (queued/pending dependencies).
 * Displayed as "+N en cola" (not a sprite) per AC-06-001.3.
 */
type EnqueueAction = {
  kind: "enqueue";
  wo: string;
};

/**
 * Begin the parchment animation: Status Note traveling from fromWo to toWo's station.
 * Driven by HandoffWritten (artifact hand-off, NOT live chat) per AC-06-006.1/AC-06-006.2.
 * toWo may be undefined when the dependent WO is not in the current scene (edge case).
 */
type StartHandoffAction = {
  kind: "startHandoff";
  fromWo: string;
  toWo: string | undefined;
};

/**
 * Advance the deep-mode relay to the given step within a work order (AC-06-007.2).
 * Steps are sequential: test → backend → frontend (one completed before the next).
 */
type AdvanceRelayAction = {
  kind: "advanceRelay";
  wo: string;
  step: RelayStep;
};

/**
 * Render the 📄 contract hand-off between backend-dev and frontend-dev steps (AC-06-007.3).
 * Driven by ContractPublished (docs/api.md published).
 */
type PublishContractAction = {
  kind: "publishContract";
  wo: string;
};

/**
 * Open the reviewer gate (Tribunal del Juez).
 * Fired when AgentWorking carries phase:'review' — the gate opens once all WOs are IN_REVIEW.
 */
type OpenGateAction = {
  kind: "openGate";
};

/**
 * Mark a work order as verified (Bóveda trophy).
 * Driven by SubagentStop (the WO closed cleanly).
 */
type VerifyWoAction = {
  kind: "verifyWo";
  wo: string;
};

/**
 * Fire the "¡Logro desbloqueado!" achievement toast (AC-06-012.1).
 * Driven by achievement events. wo may be undefined when the event omits it.
 */
type FireAchievementAction = {
  kind: "fireAchievement";
  wo: string | undefined;
};

/**
 * Put the work-order sprite into a "downed" (failed) state — first-class, never hidden (AC-06-012.1).
 * Driven by status:'fail' OR test_fail, regardless of other event semantics.
 * wo may be undefined when the event omits the workOrder field.
 */
type DownSpriteAction = {
  kind: "downSprite";
  wo: string | undefined;
};

/**
 * Safe no-op for unknown / unactionable events (defensive).
 * The engine ignores noops; they must never cause errors.
 */
type NoopAction = {
  kind: "noop";
};

/**
 * Discriminated union of all actions the engine can process.
 * The engine (IF-06-engine) is the sole consumer; it switches on `kind`.
 */
export type VisualAction =
  | SetWoAction
  | EnqueueAction
  | StartHandoffAction
  | AdvanceRelayAction
  | PublishContractAction
  | OpenGateAction
  | VerifyWoAction
  | FireAchievementAction
  | DownSpriteAction
  | NoopAction;

// ---------------------------------------------------------------------------
// Backward-compatible AgentState export
// (kept for consumers not yet migrated to the WO-keyed model)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use WoState for the work-order-keyed model.
 * Retained for backward compatibility with PartyScene/engine consumers.
 */
export type AgentState = "work" | "walk" | "idle" | "blocked" | "review";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The three relay steps that trigger advanceRelay in deep mode (REQ-06-007).
 * 'selftest' and 'implement' are EventActivity values but NOT relay steps.
 */
const RELAY_STEPS: ReadonlySet<string> = new Set<RelayStep>(["test", "backend", "frontend"]);

/**
 * Canonical event types handled by this mapper.
 * A subset of all event types — only the ones with visual meaning.
 */
const KNOWN_EVENTS = new Set([
  "AgentWorking",
  "HandoffWritten",
  "ContractPublished",
  "SubagentStop",
  "achievement",
  "test_fail",
]);

// ---------------------------------------------------------------------------
// IF-06-state-map — eventToVisual (pure mapper)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Internal helpers — extracted to reduce cyclomatic complexity per function
// ---------------------------------------------------------------------------

/** Handle AgentWorking events (Rules 2 & 3). Returns a VisualAction or null to fall through. */
function handleAgentWorking(event: DashboardEvent): VisualAction {
  const { workOrder, phase, mode, activity } = event;

  if (phase === "review") {
    // Rule 2: gate opens when all WOs reach IN_REVIEW (REQ-06-004)
    return { kind: "openGate" };
  }

  if (phase === "build") {
    if (workOrder === undefined) return { kind: "noop" };

    // Rule 3a: deep mode relay step — advanceRelay (AC-06-007.2)
    if (mode === "deep" && activity !== undefined && RELAY_STEPS.has(activity)) {
      return { kind: "advanceRelay", wo: workOrder, step: activity as RelayStep };
    }

    // Rule 3b: regular build → building state (AC-06-001.1)
    return { kind: "setWo", wo: workOrder, state: "building" };
  }

  // AgentWorking with no recognized phase → noop
  return { kind: "noop" };
}

/**
 * Map a raw DashboardEvent to a VisualAction for the engine.
 *
 * Rules (FRD-06 §2 IF-06-state-map + blueprint REQ-06-001..012):
 *
 * 1. FAILURE FIRST: status==='fail' OR event==='test_fail' → downSprite (AC-06-012.1).
 * 2. AgentWorking + phase:'review' → openGate (REQ-06-004).
 * 3. AgentWorking + phase:'build' → setWo or advanceRelay (AC-06-001.1, AC-06-007.2).
 * 4. HandoffWritten → startHandoff parchment (AC-06-006.1).
 * 5. ContractPublished → publishContract (AC-06-007.3).
 * 6. SubagentStop → verifyWo.
 * 7. achievement → fireAchievement (AC-06-012.1).
 * 8. Anything else → noop (defensive, never throws).
 *
 * @param event - Raw event from the dashboard NDJSON stream (lib/events.ts).
 * @returns VisualAction — always defined, never throws.
 */
export function eventToVisual(event: DashboardEvent): VisualAction {
  const { event: evType, workOrder, session, status } = event;

  // Rule 1 — FAILURE OVERRIDES: first-class, never hidden (AC-06-012.1)
  if (status === "fail" || evType === "test_fail") {
    return { kind: "downSprite", wo: workOrder };
  }

  // Rule 7 — ACHIEVEMENT (AC-06-012.1)
  if (evType === "achievement") {
    return { kind: "fireAchievement", wo: workOrder };
  }

  // Rules 2 & 3 — AGENT WORKING (delegated to helper)
  if (evType === "AgentWorking") {
    return handleAgentWorking(event);
  }

  // Rule 4 — HANDOFF WRITTEN → parchment (AC-06-006.1)
  // session carries the dependent WO (Build Plan target)
  if (evType === "HandoffWritten") {
    if (workOrder === undefined) return { kind: "noop" };
    return { kind: "startHandoff", fromWo: workOrder, toWo: session };
  }

  // Rule 5 — CONTRACT PUBLISHED (AC-06-007.3)
  if (evType === "ContractPublished") {
    if (workOrder === undefined) return { kind: "noop" };
    return { kind: "publishContract", wo: workOrder };
  }

  // Rule 6 — SUBAGENT STOP → verifyWo
  if (evType === "SubagentStop") {
    if (workOrder === undefined) return { kind: "noop" };
    return { kind: "verifyWo", wo: workOrder };
  }

  // Rule 8 — UNKNOWN / unhandled event type → defensive noop.
  return { kind: "noop" };
}

// Re-export KNOWN_EVENTS for consumers that need to check membership.
export { KNOWN_EVENTS as STATE_MAP_KNOWN_EVENTS };
