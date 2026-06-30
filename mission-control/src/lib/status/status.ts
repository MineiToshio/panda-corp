/**
 * WO-01-005 — `readStatus` (yaml, partial-tolerant) — CMP-01-status, IF-01-readStatus
 *
 * Traceability:
 *   REQ-01-005 (read phase, version, running, progress, work order counts,
 *               pending_decisions, pending_bugs, last_green_sha, safe_to_test)
 *   REQ-01-006 (supplies `phase` — single source of truth for in-pipeline column)
 *   REQ-01-010 (project path missing → mark not-found; don't break the view)
 *   REQ-01-011 (read-only invariant: never writes, never calls Claude)
 *   AC-01-005.1 / AC-01-006.1 / (Edge) absent + malformed + partial
 *
 * Contract:
 *   export function readStatus(projectPath: string): StatusResult;
 *   // Resolves <projectPath>/.pandacorp/status.yaml via config.projectStatusPath.
 *   // Absent (uses pathExists) → { present: false, malformed: false, status: null }.
 *   // Parse with `yaml`. Malformed → { present: true, malformed: true, status: {} } (never throw).
 *   // Maps snake_case → camelCase; missing keys stay undefined (partial-tolerant).
 *   // Never writes. Never calls Claude.
 *
 * Tolerance rules (blueprint §3 fail-soft):
 *   - Absent file            → { present: false, malformed: false, status: null }
 *   - Non-existent project   → { present: false, malformed: false, status: null }
 *   - Malformed YAML         → { present: true, malformed: true, status: {} }
 *   - Empty file             → { present: true, malformed: false, status: {} } (yaml parses null)
 *   - Partial keys           → partial Partial<ProjectStatus>, never throws
 *   - Invalid type per field → field is undefined (never coerced)
 *   - NaN numeric values     → undefined (Number.isFinite guard — regression B1')
 *   - Array values for scalar fields → undefined (regression I3)
 *   - Empty yaml map {}      → all fields undefined (regression I2)
 *
 * Regression anchors:
 *   B1' (2026-06-16): typeof NaN === "number" bypasses numeric guards — use Number.isFinite.
 *   I2  (2026-06-16): empty-object / vacuous-truth — do not invent defaults.
 *   I3  (2026-06-16): array-shaped objects fool typeof — validate scalar type explicitly.
 */

import fs from "node:fs";
import { parse as parseYaml } from "yaml";
import { projectStatusPath } from "../config/config";
import { countPendingDecisions } from "../docs/activity";
import { pathExists } from "../fs-utils/fs-utils";

// ---------------------------------------------------------------------------
// Types (exported — consumed by FRD-02, FRD-03, FRD-04/05)
// ---------------------------------------------------------------------------

export type Phase = "product" | "design" | "architecture" | "implementation" | "release";

/**
 * Where a release is deployed (DR-085). The release is the same concept either way —
 * a launched software product — only the destination differs:
 *   - `internal`: an internal tool used in-house (like Mission Control on 127.0.0.1) — no external server.
 *   - `external`: deployed to an external host (Vercel, AWS, …).
 */
export type DeployTarget = "internal" | "external";

/** Web target platform (DR-074) — drives the responsive gate and the "qué es" tags. */
type TargetPlatform = "desktop" | "mobile" | "responsive";

export type ProjectStatus = {
  project: string;
  phase: Phase;
  version: string;
  running: boolean;
  progress?: number;
  workOrdersTotal: number;
  workOrdersDone: number;
  pendingDecisions: number;
  pendingBugs: number;
  rethinkPending: boolean;
  advancePending: boolean;
  lastGreenSha: string;
  safeToTest: boolean;
  overlayVersion?: string;
  createdWith?: string;
  updatedAt?: string;
  repo?: string;
  deployTarget?: DeployTarget;
  /** Web target platform (DR-074): desktop | mobile | responsive. */
  targetPlatforms?: TargetPlatform;
  /** Live URL where the release is deployed (DR-085). Absent until launched. */
  deployUrl?: string;
};

export type StatusResult =
  | { present: false; malformed: false; status: null }
  | { present: true; malformed: boolean; status: Partial<ProjectStatus> };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_PHASES: ReadonlyArray<Phase> = [
  "product",
  "design",
  "architecture",
  "implementation",
  "release",
];

// ---------------------------------------------------------------------------
// Field coercers (each returns the validated value or undefined — never throws)
// ---------------------------------------------------------------------------

/** A non-empty string passes; any other type → undefined. */
function asString(raw: unknown): string | undefined {
  return typeof raw === "string" ? raw : undefined;
}

/** A finite number passes; NaN/Infinity/non-number → undefined (regression B1'). */
function asFiniteNumber(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

/** Strict boolean only: 1/0/NaN/"true" rejected (regression B1'). */
function asStrictBoolean(raw: unknown): boolean | undefined {
  return raw === true || raw === false ? raw : undefined;
}

/** One of the five valid Phase literals; array/non-string values rejected (regression I3). */
function asPhase(raw: unknown): Phase | undefined {
  if (typeof raw === "string" && VALID_PHASES.includes(raw as Phase)) {
    return raw as Phase;
  }
  return undefined;
}

/** One of the two deploy targets (DR-085); any other value → undefined. */
function asDeployTarget(raw: unknown): DeployTarget | undefined {
  return raw === "internal" || raw === "external" ? raw : undefined;
}

function asTargetPlatform(raw: unknown): TargetPlatform | undefined {
  return raw === "desktop" || raw === "mobile" || raw === "responsive" ? raw : undefined;
}

/** Map the string-typed fields (snake_case → camelCase); invalid/missing omitted. */
function mapStringFields(raw: Record<string, unknown>, status: Partial<ProjectStatus>): void {
  const project = asString(raw.project);
  if (project !== undefined) status.project = project;

  const version = asString(raw.version);
  if (version !== undefined) status.version = version;

  const lastGreenSha = asString(raw.last_green_sha);
  if (lastGreenSha !== undefined) status.lastGreenSha = lastGreenSha;

  const overlayVersion = asString(raw.overlay_version);
  if (overlayVersion !== undefined) status.overlayVersion = overlayVersion;

  const createdWith = asString(raw.created_with);
  if (createdWith !== undefined) status.createdWith = createdWith;

  const updatedAt = asString(raw.updated_at);
  if (updatedAt !== undefined) status.updatedAt = updatedAt;

  const repo = asString(raw.repo);
  if (repo !== undefined) status.repo = repo;

  const deployUrl = asString(raw.deploy_url);
  if (deployUrl !== undefined) status.deployUrl = deployUrl;
}

/** Map the finite-number fields; invalid/NaN/missing omitted (regression B1'). */
function mapNumberFields(raw: Record<string, unknown>, status: Partial<ProjectStatus>): void {
  const progress = asFiniteNumber(raw.progress);
  if (progress !== undefined) status.progress = progress;

  const workOrdersTotal = asFiniteNumber(raw.work_orders_total);
  if (workOrdersTotal !== undefined) status.workOrdersTotal = workOrdersTotal;

  const workOrdersDone = asFiniteNumber(raw.work_orders_done);
  if (workOrdersDone !== undefined) status.workOrdersDone = workOrdersDone;

  const pendingDecisions = asFiniteNumber(raw.pending_decisions);
  if (pendingDecisions !== undefined) status.pendingDecisions = pendingDecisions;

  const pendingBugs = asFiniteNumber(raw.pending_bugs);
  if (pendingBugs !== undefined) status.pendingBugs = pendingBugs;
}

/** Map the strict-boolean fields; non-boolean/missing omitted (regression B1'). */
function mapBooleanFields(raw: Record<string, unknown>, status: Partial<ProjectStatus>): void {
  const running = asStrictBoolean(raw.running);
  if (running !== undefined) status.running = running;

  const rethinkPending = asStrictBoolean(raw.rethink_pending);
  if (rethinkPending !== undefined) status.rethinkPending = rethinkPending;

  const advancePending = asStrictBoolean(raw.advance_pending);
  if (advancePending !== undefined) status.advancePending = advancePending;

  const safeToTest = asStrictBoolean(raw.safe_to_test);
  if (safeToTest !== undefined) status.safeToTest = safeToTest;
}

/**
 * Map a validated YAML map (snake_case keys) into a partial ProjectStatus
 * (camelCase keys). Type-invalid or missing keys are omitted, never fabricated.
 */
function mapStatusFields(raw: Record<string, unknown>): Partial<ProjectStatus> {
  const status: Partial<ProjectStatus> = {};

  const phase = asPhase(raw.phase);
  if (phase !== undefined) status.phase = phase;

  const deployTarget = asDeployTarget(raw.deploy_target);
  if (deployTarget !== undefined) status.deployTarget = deployTarget;

  const targetPlatform = asTargetPlatform(raw.target_platforms);
  if (targetPlatform !== undefined) status.targetPlatforms = targetPlatform;

  mapStringFields(raw, status);
  mapNumberFields(raw, status);
  mapBooleanFields(raw, status);

  return status;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Reads and parses `<projectPath>/.pandacorp/status.yaml`.
 *
 * - When `projectPath` does not exist or has no status.yaml → `{ present: false }`.
 * - When status.yaml is unreadable or the YAML parser throws → `{ present: true, malformed: true, status: {} }`.
 * - When status.yaml is valid (including empty) → `{ present: true, malformed: false, status: Partial<ProjectStatus> }`.
 *
 * All snake_case YAML keys are mapped to camelCase in the result; snake_case keys never appear
 * on the returned object. Missing or type-invalid keys are omitted (undefined), never fabricated.
 *
 * Read-only invariant: only calls `fs.readFileSync` and `yaml.parse` — no writes, no network,
 * no Claude calls.
 */
export function readStatus(projectPath: string): StatusResult {
  const ABSENT: StatusResult = { present: false, malformed: false, status: null };

  // --- Guard: empty/blank path ---
  if (!projectPath || projectPath.trim() === "") {
    return ABSENT;
  }

  // --- Resolve status.yaml path ---
  const yamlPath = projectStatusPath(projectPath);

  // --- Absence check (pathExists, REQ-01-010) ---
  if (!pathExists(yamlPath)) {
    return ABSENT;
  }

  // --- Read file ---
  let raw: string;
  try {
    raw = fs.readFileSync(yamlPath, "utf-8");
  } catch {
    // Unreadable (permission denied, etc.) → treat as malformed rather than absent,
    // because the file was detected by pathExists.
    return { present: true, malformed: true, status: {} };
  }

  // --- Parse YAML (fail-soft) ---
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch {
    // Malformed YAML (SyntaxError or any yaml.parse error) → blueprint §3.
    return { present: true, malformed: true, status: {} };
  }

  // --- Handle null/non-object parse result (empty file, "null" yaml, etc.) ---
  if (parsed === null || parsed === undefined) {
    // Empty file parses to null — valid YAML, not malformed; status is empty.
    return { present: true, malformed: false, status: {} };
  }

  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    // A scalar or array at the top level is not a valid status map.
    return { present: true, malformed: true, status: {} };
  }

  // --- Map snake_case → camelCase with per-field type validation ---
  const status = mapStatusFields(parsed as Record<string, unknown>);

  return { present: true, malformed: false, status };
}

/**
 * `readStatus` with `pendingDecisions` overridden by the live count from
 * `.pandacorp/inbox/decisions.md` (`countPendingDecisions`), instead of the stored
 * `pending_decisions` YAML counter.
 *
 * The YAML field is maintenance-only (written by skills as a side effect) and drifts
 * the moment a decision is resolved without that write happening — every owner-facing
 * surface must read the SAME live count the Summary tab's decision list reads, never a
 * second independent derivation (DR-092 single source for derived state).
 *
 * `readStatus()` itself is unchanged — still a pure YAML parser; use this wrapper at
 * any call site that displays `pendingDecisions` to the owner.
 *
 * @param projectPath - Absolute path to the project root.
 * @returns The same `StatusResult` as `readStatus`, with `pendingDecisions` live when present.
 */
export function readStatusWithLiveDecisions(projectPath: string): StatusResult {
  const result = readStatus(projectPath);
  if (!result.present || result.status === null) {
    return result;
  }
  return {
    ...result,
    status: { ...result.status, pendingDecisions: countPendingDecisions(projectPath) },
  };
}
