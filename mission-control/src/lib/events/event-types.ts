/**
 * Pure type definitions for the event stream (FRD-01/FRD-06/FRD-10).
 *
 * Leaf module: no imports from `./events` or `./event-contract` — both of those
 * modules import types FROM here, so this file must never import back from
 * either (that would reintroduce the import cycle it exists to break).
 */

/** Producer runtime. Legacy custom fixtures remain `unknown`. */
export type EventRuntime = "claude" | "codex" | "unknown";

/**
 * Engine phase for the build run (FRD-06, REQ-06-008).
 * Optional — emitted by the plugin when the engine enriches the event.
 */
export type EventPhase = "build" | "review";

/**
 * Activity sub-step within a work order (FRD-06, REQ-06-008).
 * Used in deep-mode relay (`test-writer → backend-dev → frontend-dev`)
 * and the non-split `implement` step.
 */
export type EventActivity = "test" | "backend" | "frontend" | "selftest" | "implement";

/**
 * Build mode read from the engine state (FRD-06, REQ-06-008).
 * Controls the wave size and whether a deep relay is rendered.
 */
export type EventMode = "pro" | "balanced" | "powerful" | "deep";

/**
 * Parsed event from the NDJSON stream (architecture §5).
 *
 * Field-name mapping: the NDJSON producer uses `work_order` (snake_case);
 * this type exposes it as `workOrder` (camelCase), per architecture §5 convention.
 * All other field names are passed through unchanged.
 *
 * The enriched optional fields (`frd`, `phase`, `activity`, `mode`, `role`) are
 * added in WO-06-012 for the La Fragua faithful engine view (FRD-06, REQ-06-008).
 * They are backward-compatible: absent fields → `undefined`; wrong-typed fields
 * are dropped silently (AC-06-008.2).
 */
export type Event = {
  event: string;
  /** Runtime-neutral semantic act from the canonical event vocabulary. */
  semanticName?: string;
  at: string;
  /** Producer runtime. Legacy custom fixtures remain `unknown`. */
  runtime?: EventRuntime;
  /** Durable run identity for semantic accounting. */
  runId?: string;
  /** Stable transport identity. Derived deterministically for legacy lines. */
  eventId?: string;
  /** Explicit accounting subject; falls back to WO/FRD/task/agent/project. */
  subject?: string;
  agent?: string;
  session?: string;
  tool?: string;
  status?: "ok" | "fail";
  workOrder?: string;
  task?: string;
  project?: string;
  /** FRD id of the event (e.g. `"frd-06-party"`). Optional — WO-06-012. */
  frd?: string;
  /** Engine phase: `"build"` (implementer running) or `"review"` (gate). Optional — WO-06-012. */
  phase?: EventPhase;
  /** Activity sub-step within a work order. Optional — WO-06-012. */
  activity?: EventActivity;
  /** Run mode, controls wave size and relay rendering. Optional — WO-06-012. */
  mode?: EventMode;
  /** Build role alias (from `AgentWorking.data.role` or top-level). Optional — WO-06-012. */
  role?: string;
  // ── Real result-bearing enriched fields (WO-10-009, FRD-10 v2) ───────────────
  // Surfaced from the REAL event vocabulary the factory emits so achievement
  // unlocks anchor to verifiable signals (see docs/achievements.md §1). All
  // optional + additive; read from the nested `data` object (real emitter shape).
  /** Review/gate verdict: `"APPROVED"` | `"PASS"` | `"REJECT"` | … (ReviewVerdict/GateResult/GateVerdict/AgentFinding). */
  verdict?: string;
  /** Work-order result, e.g. `"green"` (AgentDone). */
  result?: string;
  /** Times a WO's gate reopened before passing (`data.reopen_count`, GateVerdict). */
  reopenCount?: number;
  /** Blocking-finding count (AgentFinding `data.blocking`). */
  blocking?: number;
  /** Important-finding count (AgentFinding `data.important`). */
  important?: number;
  /** Subagent kind (`data.agent_type`, SubagentStop). */
  agentType?: string;
  /** Effort tier of a subagent run (`data.effort.level`: low|medium|high|xhigh). */
  effortLevel?: string;
  /** Max agents for a build run (`data.maxAgents`, BuildLaunch/Relaunch). */
  maxAgents?: number;
  /** WO progress string at build completion, e.g. `"78/78"` (BuildComplete `data.wos`). */
  wos?: string;
  /** FRD progress string at build completion, e.g. `"18/18"` (BuildComplete `data.frds`). */
  frds?: string;
  /** Relaunch reason (`data.reason`, BuildRelaunch). */
  reason?: string;
  /**
   * Workflow/skill names this event ran (from `data.background_tasks[].name`, SubagentStop) —
   * the real source of the "most-used workflows" usage mix (FRD-10 v3, WO-10-014). Optional +
   * additive; absent when the event carries no background tasks. Empty/malformed entries dropped.
   */
  workflows?: string[];
  // ── New engine event vocabulary (2026-07-07, top-level fields) ────────────────
  // Backward WO transitions + gate/preview/hardening lifecycle. All optional +
  // additive; read from the nested `data` object OR the top level (new events
  // carry them top-level). A wrong type drops just that field (never the event).
  /** Hardening stage (`stage`: "security"|"telemetry"|"integration"). */
  stage?: string;
  /** Patch outcome (`outcome`: "green"|"gate-test-defective"|"code-fail", PatchResult). */
  outcome?: string;
  /** Preview-smoke pass flag (`pass`, PreviewSmoke). */
  pass?: boolean;
  /** Routes exercised in a preview smoke (`routes`, PreviewSmoke). */
  routes?: number;
  /** Failed-route count in a preview smoke (`failed`, PreviewSmoke). */
  failed?: number;
  /** Gate attempt counter (`attempt`, gate). */
  attempt?: number;
};
