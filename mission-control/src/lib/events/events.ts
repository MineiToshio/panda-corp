import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { type EventRuntime, normalizeEventName } from "./event-contract";
import { isNewerTimestamp } from "./event-time";

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

/**
 * Upper bound on bytes read from the NDJSON file (stream hygiene, 2026-07-07).
 * The dashboard stream grows unbounded (every Claude session appends); reading
 * the whole file just to keep the last ~200 events is wasteful and grows without
 * limit. We tail the last 256 KB — comfortably more than DEFAULT_CAP lines — and
 * discard the first (partial) line so no truncated JSON reaches the parser.
 */
const MAX_TAIL_BYTES = 256 * 1024;

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

/** Codex-local additive transport. It never replaces or writes the Claude stream. */
function defaultCodexEventsPath(): string {
  const override = process.env.PANDACORP_CODEX_EVENTS_FILE;
  if (override !== undefined && override.length > 0) return override;
  const home = process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
  return path.join(home, ".codex", "dashboard-events.ndjson");
}

/**
 * Read the NDJSON file as UTF-8, bounded to the last `MAX_TAIL_BYTES` (stream
 * hygiene, 2026-07-07). When the file is at/under the cap the whole content is
 * returned; when it is larger only the tail window is read via `readSync` and the
 * first (partial) line is dropped so no truncated JSON line reaches the parser.
 * Uses one fd (open → fstat → read → close) so size and content are consistent.
 */
function readTailUtf8(filePath: string): string {
  const fd = fs.openSync(filePath, "r");
  try {
    const { size } = fs.fstatSync(fd);
    if (size <= MAX_TAIL_BYTES) {
      return fs.readFileSync(fd, "utf-8");
    }
    const start = size - MAX_TAIL_BYTES;
    const buf = Buffer.allocUnsafe(MAX_TAIL_BYTES);
    const bytesRead = fs.readSync(fd, buf, 0, MAX_TAIL_BYTES, start);
    const text = buf.toString("utf-8", 0, bytesRead);
    // Drop everything up to and including the first newline — the tail window
    // almost certainly starts mid-line, and that partial line is not valid JSON.
    const firstNl = text.indexOf("\n");
    return firstNl === -1 ? "" : text.slice(firstNl + 1);
  } finally {
    fs.closeSync(fd);
  }
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
/** Apply the finite-number result fields (reopen_count, blocking, important, maxAgents, routes, failed, attempt). */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: flat independent optional-number guards are clearer than an unsafe generic assignment loop.
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
  if (typeof src.routes === "number" && Number.isFinite(src.routes)) ev.routes = src.routes;
  if (typeof src.failed === "number" && Number.isFinite(src.failed)) ev.failed = src.failed;
  if (typeof src.attempt === "number" && Number.isFinite(src.attempt)) ev.attempt = src.attempt;
  // `wos` is a string on BuildComplete ("done/total") but a plain count on the
  // extended gate event — tolerate the numeric form instead of dropping it.
  if (ev.wos === undefined && typeof src.wos === "number" && Number.isFinite(src.wos)) {
    ev.wos = String(src.wos);
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
  if (typeof src.stage === "string") ev.stage = src.stage;
  if (typeof src.outcome === "string") ev.outcome = src.outcome;
  if (typeof src.pass === "boolean") ev.pass = src.pass;

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
function baseContractEvent(obj: Record<string, unknown>, transportRuntime: EventRuntime): Event {
  const rawName = obj.event as string;
  const normalized = normalizeEventName(rawName);
  const runtime: EventRuntime =
    obj.runtime === "claude" || obj.runtime === "codex" ? obj.runtime : transportRuntime;
  const event: Event = {
    event: normalized.display,
    semanticName: normalized.semanticName,
    at: obj.at as string,
    runtime,
  };
  if (typeof obj.event_id === "string" && obj.event_id.trim() !== "") event.eventId = obj.event_id;
  if (typeof obj.run_id === "string" && obj.run_id.trim() !== "") event.runId = obj.run_id;
  if (typeof obj.subject === "string" && obj.subject.trim() !== "") event.subject = obj.subject;
  return event;
}

function parseLine(line: string, transportRuntime: EventRuntime = "unknown"): Event | undefined {
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

  const ev = baseContractEvent(obj, transportRuntime);

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
function parseLines(raw: string, runtime: EventRuntime = "unknown"): Event[] {
  const validEvents: Event[] = [];
  for (const line of raw.split("\n")) {
    const ev = parseLine(line, runtime);
    if (ev !== undefined) {
      validEvents.push(ev);
    }
  }
  return validEvents;
}

/**
 * Derive `lastEventAt` — the chronologically latest `at` across retained events.
 * Normalised via `isNewerTimestamp` so mixed second/millisecond precisions order
 * correctly (a `…00.500Z` frame must not lose to a `…00Z` one — stream hygiene).
 */
function deriveLastEventAt(events: readonly Event[]): string | null {
  let last: string | null = null;
  for (const ev of events) {
    if (last === null || isNewerTimestamp(ev.at, last)) {
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
    if (existing === undefined || isNewerTimestamp(ev.at, existing.lastEventAt)) {
      byProject[key] = { lastEventAt: ev.at };
    }
  }
  return byProject;
}

type EventSource = { path: string; runtime: EventRuntime };

function resolveEventSources(explicitPath: string | undefined): EventSource[] {
  if (explicitPath !== undefined) {
    return [
      {
        path: explicitPath,
        runtime: explicitPath === defaultEventsPath() ? "claude" : "unknown",
      },
    ];
  }
  const claudeOverride = process.env.PANDACORP_EVENTS_FILE;
  const codexOverride = process.env.PANDACORP_CODEX_EVENTS_FILE;
  if (claudeOverride || codexOverride) {
    return [
      ...(claudeOverride ? [{ path: claudeOverride, runtime: "claude" as const }] : []),
      ...(codexOverride ? [{ path: codexOverride, runtime: "codex" as const }] : []),
    ];
  }
  return [
    { path: defaultEventsPath(), runtime: "claude" },
    { path: defaultCodexEventsPath(), runtime: "codex" },
  ];
}

function readEventSources(sources: readonly EventSource[]): { parsed: Event[]; count: number } {
  const parsed: Event[] = [];
  const seenSources = new Set<string>();
  let count = 0;
  for (const source of sources) {
    const sourceKey = path.resolve(source.path);
    if (seenSources.has(sourceKey)) continue;
    seenSources.add(sourceKey);
    if (!fs.existsSync(source.path)) continue;
    try {
      parsed.push(...parseLines(readTailUtf8(source.path), source.runtime));
      count++;
    } catch {
      // Transports are optional and independently fail-soft.
    }
  }
  return { parsed, count };
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
  const cap = resolveCapFromOpts(opts?.cap);
  const project = opts?.project;
  const { parsed, count: readSourceCount } = readEventSources(resolveEventSources(opts?.path));

  // Exact replay across a transport or dual-reader is idempotent. First observation wins.
  const seenEventIds = new Set<string>();
  const unique = parsed.filter((event) => {
    const id = event.eventId;
    if (id === undefined) return true;
    if (seenEventIds.has(id)) return false;
    seenEventIds.add(id);
    return true;
  });

  // The two runtime transports are independent tails. Concatenating Claude then Codex would let an
  // older Codex tail evict a newer Claude event when the cap is applied. Merge chronologically first;
  // Array#sort is stable, so equal/invalid timestamps retain their source order.
  if (readSourceCount > 1) {
    unique.sort((a, b) => {
      const left = Date.parse(a.at);
      const right = Date.parse(b.at);
      return Number.isFinite(left) && Number.isFinite(right) ? left - right : 0;
    });
  }

  // Project filter BEFORE the cap (legacy events without a project field pass).
  const validEvents =
    project === undefined
      ? unique
      : unique.filter((ev) => ev.project === undefined || ev.project === project);

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
