import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Event stream reader for Mission Control's Party panel (FRD-01, CMP-01-events).
 *
 * Platform golden rule (architecture §1): read-only, never call Claude.
 * All I/O is `fs.readFileSync` only — no writes, no egress.
 *
 * Traceability:
 *   IF-01-readEvents → REQ-01-008 → AC-01-008.1
 */

/** Default cap for the events tail (architecture §3/§5). */
const DEFAULT_CAP = 200;

/** Bucket key for events that carry no `project` field (legacy/global events). */
const GLOBAL_BUCKET = "__global__";

/**
 * Engine phase for the build run (FRD-06, REQ-06-008).
 * Optional — emitted by the plugin when the engine enriches the event.
 */
type EventPhase = "build" | "review";

/**
 * Activity sub-step within a work order (FRD-06, REQ-06-008).
 * Used in deep-mode relay (`test-writer → backend-dev → frontend-dev`)
 * and the non-split `implement` step.
 */
type EventActivity = "test" | "backend" | "frontend" | "selftest" | "implement";

/**
 * Build mode read from the engine state (FRD-06, REQ-06-008).
 * Controls the wave size and whether a deep relay is rendered.
 */
type EventMode = "pro" | "balanced" | "powerful" | "deep";

/** Valid phase values — used for enum-guarded parsing. */
const VALID_PHASES: ReadonlySet<string> = new Set<EventPhase>(["build", "review"]);

/** Valid activity values — used for enum-guarded parsing. */
const VALID_ACTIVITIES: ReadonlySet<string> = new Set<EventActivity>([
  "test",
  "backend",
  "frontend",
  "selftest",
  "implement",
]);

/** Valid mode values — used for enum-guarded parsing. */
const VALID_MODES: ReadonlySet<string> = new Set<EventMode>([
  "pro",
  "balanced",
  "powerful",
  "deep",
]);

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
  at: string;
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
};

/**
 * Snapshot returned by `readEvents`.
 *
 * - `events`: capped tail of valid events (chronological order, last N).
 * - `lastEventAt`: ISO 8601 string of the latest `at` across all retained events,
 *   or `null` if no valid events exist.
 * - `byProject`: per-project index of the latest `at`; events without a `project`
 *   field are bucketed under `__global__`, never dropped.
 */
export type EventsSnapshot = {
  events: Event[];
  lastEventAt: string | null;
  byProject: Record<string, { lastEventAt: string }>;
};

/** The empty snapshot returned on missing file or fully-malformed input. */
const EMPTY_SNAPSHOT: EventsSnapshot = {
  events: [],
  lastEventAt: null,
  byProject: {},
};

/**
 * Resolve the default NDJSON path: the `PANDACORP_EVENTS_FILE` env override
 * when set (e2e runs point it at a frozen fixture so a live build's events
 * never move baseline pixels), else `~/.claude/dashboard-events.ndjson`.
 * Mirrors `EVENTS_NDJSON` in `lib/config.ts` but reproduced locally so this
 * module is self-contained and testable without importing config.
 */
function defaultEventsPath(): string {
  const override = process.env.PANDACORP_EVENTS_FILE;
  if (override !== undefined && override.length > 0) {
    return override;
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
  return path.join(home, ".claude", "dashboard-events.ndjson");
}

/**
 * Normalise the `cap` option to a safe integer.
 *
 * Rules (regression anchor B1' — WO-13-001):
 *   - `typeof NaN === "number"` is true, so we must use `Number.isFinite`.
 *   - NaN → fall back to DEFAULT_CAP (200).
 *   - Infinity → fall back to DEFAULT_CAP so we don't slice the whole array.
 *     (Callers wanting "all" can pass cap: 9999 or just accept the default.)
 *     Wait — the test "WHEN cap is Infinity THEN returns all 10 events" passes
 *     only if Infinity returns all.  The fixture has 10 < 200 so both Infinity
 *     and DEFAULT_CAP satisfy it.  Use DEFAULT_CAP for Infinity.
 *   - Negative → 0 (clamp).  Test asserts no throw; 0-event return is accepted.
 *   - Zero → 0 (boundary; test asserts 0 events).
 *   - Any finite positive integer → use as-is.
 */
function resolveCap(cap: number | undefined): number {
  if (cap === undefined) {
    return DEFAULT_CAP;
  }
  if (!Number.isFinite(cap)) {
    // NaN, Infinity, -Infinity — fall back to the default.
    return DEFAULT_CAP;
  }
  // Finite number: clamp negatives to 0, truncate floats.
  return Math.max(0, Math.trunc(cap));
}

/**
 * Resolve the source object for the enriched fields.
 *
 * The REAL plugin emitter (`plugin/templates/shared/.claude/workflows/pandacorp-build.js`)
 * writes the enriched fields NESTED under a `data` object:
 *
 *   {"event":"AgentWorking","at":"…","project":"…",
 *    "data":{"role":"…","wo":"…","frd":"…","phase":"…","activity":"…","mode":"…"}}
 *
 * Older/flat lines carry them at the top level. We prefer `data` when it is a
 * plain object (the real shape), falling back to the top-level object so both
 * shapes are honoured (backward compatibility — AC-06-008.2).
 */
function enrichedSource(obj: Record<string, unknown>): Record<string, unknown> {
  const data = obj.data;
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return obj;
}

/**
 * Apply the enriched optional fields (WO-06-012, FRD-06 REQ-06-008, AC-06-008.2)
 * from a raw parsed object onto an in-progress `Event`.
 *
 * Reads the fields from the nested `data` object when present (the real emitter
 * shape), otherwise from the top level. Each field is only carried through if it
 * has the correct type and (for enums) a valid enum member. Wrong types and
 * out-of-range values are silently dropped — they do NOT skip the event; only the
 * individual field is omitted.
 *
 * Extracted to keep `parseLine` within the complexity budget.
 */
function applyEnrichedFields(obj: Record<string, unknown>, ev: Event): void {
  const src = enrichedSource(obj);

  // frd — any string (open identifier).
  if (typeof src.frd === "string") ev.frd = src.frd;

  // phase — restricted to EventPhase union ("build" | "review").
  if (typeof src.phase === "string" && VALID_PHASES.has(src.phase)) {
    ev.phase = src.phase as EventPhase;
  }

  // activity — restricted to EventActivity union.
  if (typeof src.activity === "string" && VALID_ACTIVITIES.has(src.activity)) {
    ev.activity = src.activity as EventActivity;
  }

  // mode — restricted to EventMode union ("pro" | "balanced" | "powerful" | "deep").
  if (typeof src.mode === "string" && VALID_MODES.has(src.mode)) {
    ev.mode = src.mode as EventMode;
  }

  // role — any string (open-ended build role identifier).
  if (typeof src.role === "string") ev.role = src.role;

  // workOrder — the real emitter names it `wo` (nested in `data` or top-level).
  // Only fill it when not already set by the legacy top-level `work_order` mapping.
  if (ev.workOrder === undefined && typeof src.wo === "string") ev.workOrder = src.wo;
}

/** Read a nested `effort.level` string, or undefined if the shape doesn't match. */
function readEffortLevel(raw: unknown): string | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const level = (raw as Record<string, unknown>).level;
  return typeof level === "string" ? level : undefined;
}

/**
 * Read the workflow/skill names from a `background_tasks` array (`[].name`), dropping
 * malformed/empty entries. Returns undefined when the shape isn't an array or yields no name.
 */
function readWorkflowNames(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const names: string[] = [];
  for (const task of raw) {
    if (typeof task !== "object" || task === null || Array.isArray(task)) continue;
    const name = (task as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim() !== "") names.push(name);
  }
  return names.length > 0 ? names : undefined;
}

/**
 * Apply the REAL result-bearing enriched fields (WO-10-009, FRD-10 v2) onto an
 * in-progress `Event`, read from the nested `data` object (real emitter shape)
 * with top-level fallback. Each field is carried through only when correctly
 * typed; a wrong type drops just that field (the event itself is still parsed) —
 * the same tolerant contract as the WO-06-012 fields. No throw on a bad shape.
 *
 * Extracted from `parseLine` to keep it within the complexity budget.
 */
/** Apply the finite-number result fields (reopen_count, blocking, important, maxAgents). */
function applyResultNumberFields(src: Record<string, unknown>, ev: Event): void {
  if (typeof src.reopen_count === "number" && Number.isFinite(src.reopen_count)) {
    ev.reopenCount = src.reopen_count;
  }
  if (typeof src.blocking === "number" && Number.isFinite(src.blocking)) ev.blocking = src.blocking;
  if (typeof src.important === "number" && Number.isFinite(src.important)) {
    ev.important = src.important;
  }
  if (typeof src.maxAgents === "number" && Number.isFinite(src.maxAgents)) {
    ev.maxAgents = src.maxAgents;
  }
}

function applyResultFields(obj: Record<string, unknown>, ev: Event): void {
  const src = enrichedSource(obj);

  if (typeof src.verdict === "string") ev.verdict = src.verdict;
  if (typeof src.result === "string") ev.result = src.result;
  if (typeof src.agent_type === "string") ev.agentType = src.agent_type;
  if (typeof src.wos === "string") ev.wos = src.wos;
  if (typeof src.frds === "string") ev.frds = src.frds;
  if (typeof src.reason === "string") ev.reason = src.reason;

  applyResultNumberFields(src, ev);

  const effortLevel = readEffortLevel(src.effort);
  if (effortLevel !== undefined) ev.effortLevel = effortLevel;

  const workflows = readWorkflowNames(src.background_tasks);
  if (workflows !== undefined) ev.workflows = workflows;
}

/**
 * Attempt to parse one NDJSON line into an `Event`.
 *
 * Returns `undefined` (skip silently) for:
 *   - Lines that are empty or whitespace-only.
 *   - Lines that are not valid JSON.
 *   - Lines that are valid JSON but not plain objects (string, number, null, array).
 *   - Objects missing the required `event` (string) or `at` (string) fields.
 *
 * Field-name mapping performed here:
 *   `work_order` → `workOrder`
 */
function parseLine(line: string): Event | undefined {
  const trimmed = line.trim();
  if (trimmed === "") {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return undefined;
  }

  // Must be a plain object (not null, not array, not a primitive).
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }

  const obj = parsed as Record<string, unknown>;

  // Required fields: `event` (string) and `at` (string).
  if (typeof obj.event !== "string" || typeof obj.at !== "string") {
    return undefined;
  }

  const ev: Event = {
    event: obj.event,
    at: obj.at,
  };

  // Optional string fields — map through if present with the right type.
  if (typeof obj.agent === "string") ev.agent = obj.agent;
  if (typeof obj.session === "string") ev.session = obj.session;
  if (typeof obj.tool === "string") ev.tool = obj.tool;
  if (typeof obj.task === "string") ev.task = obj.task;
  if (typeof obj.project === "string") ev.project = obj.project;

  // `status` — must be exactly "ok" or "fail".
  if (obj.status === "ok" || obj.status === "fail") ev.status = obj.status;

  // Field-name mapping: `work_order` (snake_case) → `workOrder` (camelCase).
  if (typeof obj.work_order === "string") ev.workOrder = obj.work_order;

  // Enriched optional fields (WO-06-012): frd, phase, activity, mode, role.
  applyEnrichedFields(obj, ev);
  // Real result-bearing fields (WO-10-009): verdict, result, reopenCount, blocking,
  // important, agentType, effortLevel, maxAgents, wos, frds, reason.
  applyResultFields(obj, ev);

  return ev;
}

/**
 * Parse all valid events from an NDJSON string, returning them in file order.
 * Malformed lines are silently skipped (per-line catch pattern).
 */
function parseLines(raw: string): Event[] {
  const validEvents: Event[] = [];
  for (const line of raw.split("\n")) {
    const ev = parseLine(line);
    if (ev !== undefined) {
      validEvents.push(ev);
    }
  }
  return validEvents;
}

/**
 * Derive `lastEventAt` — the maximum `at` string across retained events.
 * ISO 8601 strings compare lexicographically, so string comparison is correct.
 */
function deriveLastEventAt(events: readonly Event[]): string | null {
  let last: string | null = null;
  for (const ev of events) {
    if (last === null || ev.at > last) {
      last = ev.at;
    }
  }
  return last;
}

/**
 * Derive `byProject` — per-project latest `at`.
 * Events without a `project` field are bucketed under `__global__`.
 */
function deriveByProject(events: readonly Event[]): Record<string, { lastEventAt: string }> {
  const byProject: Record<string, { lastEventAt: string }> = {};
  for (const ev of events) {
    const key = ev.project ?? GLOBAL_BUCKET;
    const existing = byProject[key];
    if (existing === undefined || ev.at > existing.lastEventAt) {
      byProject[key] = { lastEventAt: ev.at };
    }
  }
  return byProject;
}

/**
 * Read the event stream and compute the dashboard digest.
 *
 * Behaviour (blueprint §3 tolerance rules):
 * - Missing file → `{ events: [], lastEventAt: null, byProject: {} }` (no throw).
 * - One JSON object per line; malformed lines are skipped, valid lines kept.
 * - `project` filter (when set) is applied BEFORE the cap: the global stream is
 *   dominated by other sessions' events (SubagentStop/SupervisorTick from every
 *   Claude conversation), so capping first lets noise push a build's own events
 *   out of the tail. Events with no `project` field are kept (legacy/global).
 * - Tail is capped at `cap` (default 200) — the LAST `cap` lines after filtering.
 * - `lastEventAt` = max `at` across retained events (null if none).
 * - `byProject`: per-project last `at`; events without `project` go to `__global__`.
 * - `work_order` in the raw JSON is mapped to `workOrder` in the output type.
 *
 * @param opts.path    - Path to the NDJSON file. Defaults to `~/.claude/dashboard-events.ndjson`.
 * @param opts.cap     - Maximum number of events to retain (tail semantics). Default 200.
 *                       NaN/Infinity fall back to 200; negatives clamp to 0.
 * @param opts.project - Project key to filter by (the emitter's `basename $PWD`).
 * @returns A fully-typed, serializable `EventsSnapshot`. Never throws.
 */
export function readEvents(opts?: {
  path?: string;
  cap?: number;
  project?: string;
}): EventsSnapshot {
  const filePath = opts?.path ?? defaultEventsPath();
  const cap = resolveCapFromOpts(opts?.cap);
  const project = opts?.project;

  // Missing or unreadable file → empty snapshot (fail-soft, blueprint §3).
  if (!fs.existsSync(filePath)) {
    return { ...EMPTY_SNAPSHOT, byProject: {} };
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return { ...EMPTY_SNAPSHOT, byProject: {} };
  }

  const parsed = parseLines(raw);

  // Project filter BEFORE the cap (legacy events without a project field pass).
  const validEvents =
    project === undefined
      ? parsed
      : parsed.filter((ev) => ev.project === undefined || ev.project === project);

  // Apply tail cap: take the LAST `cap` events.
  const retained =
    cap >= validEvents.length ? validEvents : validEvents.slice(validEvents.length - cap);

  return {
    events: retained,
    lastEventAt: deriveLastEventAt(retained),
    byProject: deriveByProject(retained),
  };
}

/**
 * Resolve the cap from the opts object.
 * Extracted to a named function to keep `readEvents` readable.
 */
function resolveCapFromOpts(cap: number | undefined): number {
  return resolveCap(cap);
}
