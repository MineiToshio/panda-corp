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
import { projectStatusPath } from "./config";
import { pathExists } from "./fs-utils";

// ---------------------------------------------------------------------------
// Types (exported — consumed by FRD-02, FRD-03, FRD-04/05)
// ---------------------------------------------------------------------------

export type Phase =
  | "product"
  | "design"
  | "architecture"
  | "implementation"
  | "release"
  | "operation";

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
  "operation",
];

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

  // --- Map snake_case → camelCase with type validation ---
  const raw_data = parsed as Record<string, unknown>;
  const status: Partial<ProjectStatus> = {};

  // project: string
  const project = raw_data.project;
  if (typeof project === "string") {
    status.project = project;
  }

  // phase: Phase (one of six valid literals; array/non-string values rejected — regression I3)
  const phase = raw_data.phase;
  if (typeof phase === "string" && VALID_PHASES.includes(phase as Phase)) {
    status.phase = phase as Phase;
  }

  // version: string
  const version = raw_data.version;
  if (typeof version === "string") {
    status.version = version;
  }

  // running: boolean (strict boolean only — regression B1': 1/0 or NaN not accepted)
  const running = raw_data.running;
  if (running === true || running === false) {
    status.running = running;
  }

  // progress: number (finite, integer-safe — optional)
  const progress = raw_data.progress;
  if (typeof progress === "number" && Number.isFinite(progress)) {
    status.progress = progress;
  }

  // work_orders_total → workOrdersTotal: number (finite — regression B1')
  const workOrdersTotal = raw_data.work_orders_total;
  if (typeof workOrdersTotal === "number" && Number.isFinite(workOrdersTotal)) {
    status.workOrdersTotal = workOrdersTotal;
  }

  // work_orders_done → workOrdersDone: number (finite)
  const workOrdersDone = raw_data.work_orders_done;
  if (typeof workOrdersDone === "number" && Number.isFinite(workOrdersDone)) {
    status.workOrdersDone = workOrdersDone;
  }

  // pending_decisions → pendingDecisions: number (finite)
  const pendingDecisions = raw_data.pending_decisions;
  if (typeof pendingDecisions === "number" && Number.isFinite(pendingDecisions)) {
    status.pendingDecisions = pendingDecisions;
  }

  // pending_bugs → pendingBugs: number (finite)
  const pendingBugs = raw_data.pending_bugs;
  if (typeof pendingBugs === "number" && Number.isFinite(pendingBugs)) {
    status.pendingBugs = pendingBugs;
  }

  // rethink_pending → rethinkPending: boolean (strict)
  const rethinkPending = raw_data.rethink_pending;
  if (rethinkPending === true || rethinkPending === false) {
    status.rethinkPending = rethinkPending;
  }

  // advance_pending → advancePending: boolean (strict)
  const advancePending = raw_data.advance_pending;
  if (advancePending === true || advancePending === false) {
    status.advancePending = advancePending;
  }

  // last_green_sha → lastGreenSha: string
  const lastGreenSha = raw_data.last_green_sha;
  if (typeof lastGreenSha === "string") {
    status.lastGreenSha = lastGreenSha;
  }

  // safe_to_test → safeToTest: boolean (strict — regression B1')
  const safeToTest = raw_data.safe_to_test;
  if (safeToTest === true || safeToTest === false) {
    status.safeToTest = safeToTest;
  }

  // overlay_version → overlayVersion: string (optional)
  const overlayVersion = raw_data.overlay_version;
  if (typeof overlayVersion === "string") {
    status.overlayVersion = overlayVersion;
  }

  // created_with → createdWith: string (optional)
  const createdWith = raw_data.created_with;
  if (typeof createdWith === "string") {
    status.createdWith = createdWith;
  }

  // updated_at → updatedAt: string (optional; ISO 8601 date string, serializable)
  const updatedAt = raw_data.updated_at;
  if (typeof updatedAt === "string") {
    status.updatedAt = updatedAt;
  }

  // repo: string (optional)
  const repo = raw_data.repo;
  if (typeof repo === "string") {
    status.repo = repo;
  }

  return { present: true, malformed: false, status };
}
