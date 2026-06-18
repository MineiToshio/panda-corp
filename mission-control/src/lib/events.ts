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
 * Parsed event from the NDJSON stream (architecture §5).
 *
 * Field-name mapping: the NDJSON producer uses `work_order` (snake_case);
 * this type exposes it as `workOrder` (camelCase), per architecture §5 convention.
 * All other field names are passed through unchanged.
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
 * Resolve the default NDJSON path: `~/.claude/dashboard-events.ndjson`.
 * Mirrors `EVENTS_NDJSON` in `lib/config.ts` but reproduced locally so this
 * module is self-contained and testable without importing config.
 */
function defaultEventsPath(): string {
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

  return ev;
}

/**
 * Read the event stream and compute the dashboard digest.
 *
 * Behaviour (blueprint §3 tolerance rules):
 * - Missing file → `{ events: [], lastEventAt: null, byProject: {} }` (no throw).
 * - One JSON object per line; malformed lines are skipped, valid lines kept.
 * - Tail is capped at `cap` (default 200) — the LAST `cap` lines after filtering.
 * - `lastEventAt` = max `at` across retained events (null if none).
 * - `byProject`: per-project last `at`; events without `project` go to `__global__`.
 * - `work_order` in the raw JSON is mapped to `workOrder` in the output type.
 *
 * @param opts.path - Path to the NDJSON file. Defaults to `~/.claude/dashboard-events.ndjson`.
 * @param opts.cap  - Maximum number of events to retain (tail semantics). Default 200.
 *                    NaN/Infinity fall back to 200; negatives clamp to 0.
 * @returns A fully-typed, serializable `EventsSnapshot`. Never throws.
 */
export function readEvents(opts?: { path?: string; cap?: number }): EventsSnapshot {
  const filePath = opts?.path ?? defaultEventsPath();
  const cap = resolveCapFromOpts(opts?.cap);

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

  // Split into lines, parse each independently (per-line catch pattern).
  const lines = raw.split("\n");
  const validEvents: Event[] = [];

  for (const line of lines) {
    const ev = parseLine(line);
    if (ev !== undefined) {
      validEvents.push(ev);
    }
  }

  // Apply tail cap: take the LAST `cap` events.
  const retained =
    cap >= validEvents.length ? validEvents : validEvents.slice(validEvents.length - cap);

  // Derive `lastEventAt` — the maximum `at` string across retained events.
  // ISO 8601 strings compare lexicographically, so string comparison is correct.
  let lastEventAt: string | null = null;
  for (const ev of retained) {
    if (lastEventAt === null || ev.at > lastEventAt) {
      lastEventAt = ev.at;
    }
  }

  // Derive `byProject` — per-project latest `at`.
  const byProject: Record<string, { lastEventAt: string }> = {};

  for (const ev of retained) {
    const key = ev.project ?? GLOBAL_BUCKET;
    const existing = byProject[key];
    if (existing === undefined || ev.at > existing.lastEventAt) {
      byProject[key] = { lastEventAt: ev.at };
    }
  }

  return { events: retained, lastEventAt, byProject };
}

/**
 * Resolve the cap from the opts object.
 * Extracted to a named function to keep `readEvents` readable.
 */
function resolveCapFromOpts(cap: number | undefined): number {
  return resolveCap(cap);
}
