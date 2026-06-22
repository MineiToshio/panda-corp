import fs from "node:fs";
import path from "node:path";
import { resolveFactoryRoot, resolveProjectPath } from "../config/config";
import { pathExists } from "../fs-utils/fs-utils";
import { type Phase, readStatus, type StatusResult } from "../status/status";

/**
 * Data-reading module for the portfolio table (FRD-01, CMP-01-portfolio).
 * Compose layer for FRD-03: activeProjects() (CMP-03-active-projects, IF-03-activeProjects).
 *
 * Platform golden rule (architecture §1): read-only, never call Claude.
 * All I/O is `fs.readFileSync` only — no writes, no egress.
 *
 * Traceability:
 *   IF-01-readPortfolio → REQ-01-004 → AC-01-004.1
 *   IF-03-activeProjects → REQ-03-001 → AC-03-001.1
 *   REQ-01-010: project path is returned verbatim; pathExists() marks not-found downstream.
 */

export type PortfolioEntry = {
  name: string;
  /** Raw path cell; never validated for existence here (REQ-01-010: that is pathExists()'s job). */
  path: string;
  /** Repo URL. Placeholder cells ("—", "-", "") are normalized to `undefined`. */
  repo?: string;
  originIdea?: string;
  /** Advisory phase cell; status.yaml is authoritative. */
  phase?: string;
  users?: string;
  returnMetric?: string;
  verdict?: string;
  lastSync?: string;
};

// ---------------------------------------------------------------------------
// Header → field name mapping (name-based, not position-based)
// ---------------------------------------------------------------------------

/**
 * Map from normalised header cell text to the `PortfolioEntry` key.
 * Normalized = trimmed + lower-cased (so "Return metric" → "return metric").
 */
const HEADER_MAP: Record<string, keyof PortfolioEntry> = {
  name: "name",
  path: "path",
  repo: "repo",
  "origin idea": "originIdea",
  phase: "phase",
  users: "users",
  "return metric": "returnMetric",
  verdict: "verdict",
  "last sync": "lastSync",
  // Spanish headers — the real portfolio.md is gitignored → Spanish (DR-009). Without these the
  // header row is never recognized, columnMap stays null and every data row is dropped → [].
  proyecto: "name",
  ruta: "path",
  "idea origen": "originIdea",
  fase: "phase",
  usuarios: "users",
  retorno: "returnMetric",
  veredicto: "verdict",
  "última sync": "lastSync",
  "ultima sync": "lastSync",
};

// Placeholder values that should be mapped to `undefined`.
const PLACEHOLDERS = new Set(["—", "-", ""]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the given line looks like a GFM table separator row
 * (e.g. `|---|---|---|` or `| --- | --- |`).
 */
function isSeparatorRow(line: string): boolean {
  const stripped = line.trim();
  if (!stripped.startsWith("|")) return false;
  // A separator row consists only of pipe chars, dashes, colons and spaces.
  return /^\|[\s|:-]+\|?$/.test(stripped);
}

/**
 * Returns `true` when the line starts with `|` (GFM table row).
 */
function isTableRow(line: string): boolean {
  return line.trim().startsWith("|");
}

/**
 * Splits a GFM table row into trimmed cell strings.
 * `| foo | bar |` → `["foo", "bar"]`
 */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  // Remove leading and trailing `|` then split on `|`.
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutTrailing = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return withoutTrailing.split("|").map((cell) => cell.trim());
}

/**
 * Normalizes a cell value: trims whitespace, maps placeholder strings to `undefined`.
 */
function normalizeCell(raw: string): string | undefined {
  const trimmed = raw.trim();
  return PLACEHOLDERS.has(trimmed) ? undefined : trimmed === "" ? undefined : trimmed;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a GFM markdown table in `content` and return an array of `PortfolioEntry`.
 *
 * - Skips header rows (detected by the HEADER_MAP match).
 * - Skips separator rows (e.g. `|---|---|`).
 * - Maps columns by header name, not by position (column-order tolerant).
 * - Rows with missing cells degrade to `undefined` fields — never throws.
 * - Returns `[]` when there is no table, the content is empty, or the file is missing.
 */
type ColumnMap = (keyof PortfolioEntry | undefined)[];

/**
 * Trim a required cell, returning null when it is missing, blank, or a placeholder.
 */
function requiredCell(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === "" || PLACEHOLDERS.has(trimmed)) return null;
  return trimmed;
}

/**
 * Clean a portfolio path cell. The real (Spanish) portfolio wraps the path in backticks and may append
 * prose, e.g. "`mission-control/` (dentro de la fábrica — es su interfaz)" → "mission-control".
 */
function cleanPathCell(raw: string): string {
  // Prefer the backticked path; otherwise drop any trailing parenthetical prose.
  const p = raw.match(/`([^`]+)`/)?.[1] ?? raw.replace(/\s*\(.*$/, "");
  return p.trim().replace(/\/+$/, "");
}

/**
 * Build a PortfolioEntry from a data row's cells using the header-derived column map.
 * Returns null when the required `name` / `path` cells are blank/placeholder.
 */
function buildEntry(cells: readonly string[], columnMap: ColumnMap): PortfolioEntry | null {
  // name and path are required; skip rows where either is blank/placeholder.
  const name = requiredCell(cells[0]);
  const projectPath = requiredCell(cells[1]);
  if (name === null || projectPath === null) return null;

  const entry: PortfolioEntry = { name, path: cleanPathCell(projectPath) };

  // Map remaining columns using the header-derived column map.
  for (let i = 2; i < columnMap.length; i++) {
    const key = columnMap[i];
    if (key === undefined || key === "name" || key === "path") continue;
    const normalized = normalizeCell(cells[i] ?? "");
    if (normalized !== undefined) {
      (entry as Record<string, string | undefined>)[key] = normalized;
    }
  }

  return entry;
}

function parsePortfolioTable(content: string): PortfolioEntry[] {
  if (!content || content.trim() === "") return [];

  const lines = content.split("\n");
  const entries: PortfolioEntry[] = [];

  // `columnMap[i]` = the PortfolioEntry key for column index i (undefined = unknown column).
  let columnMap: ColumnMap | null = null;

  for (const line of lines) {
    // Non-table / separator lines: skip. We do NOT reset columnMap on a non-table
    // line — it is reset only when we encounter a new header row (multi-table support).
    if (!isTableRow(line) || isSeparatorRow(line)) continue;

    const cells = splitTableRow(line);

    // Detect header row: a row whose first cell is the name column header (EN "name" or ES "proyecto").
    const firstCell = (cells[0] ?? "").trim().toLowerCase();
    if (firstCell === "name" || firstCell === "proyecto") {
      columnMap = cells.map((cell) => HEADER_MAP[cell.trim().toLowerCase()] ?? undefined);
      continue;
    }

    // Data row: need a column map to interpret it.
    if (columnMap === null) continue;

    const entry = buildEntry(cells, columnMap);
    if (entry !== null) {
      entries.push(entry);
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read and parse the portfolio markdown table.
 *
 * The `arg` parameter is flexible (blueprint contract: `portfolioPath?: string`):
 * - **Omitted** — reads from `config.PORTFOLIO` (derived from `PANDACORP_FACTORY_ROOT` at
 *   call-time so `withFactoryRoot` env swaps are respected in tests).
 * - **Looks like a file path** (starts with `/`, `./`, `../` or ends in `.md`) — reads
 *   the file at that path.
 * - **Contains `\n`** (raw markdown content) — parses directly without any filesystem call.
 * - **Non-existent path string** — treated as a file path; absent file → `[]` (fail-soft).
 *
 * Tolerance rules (blueprint §3):
 * - Absent / unreadable file → `[]`
 * - Empty content → `[]`
 * - No table in the file → `[]`
 * - Row with missing cells → fields degrade to `undefined`, row is kept
 * - Placeholder cells ("—", "-", "") → `undefined`
 * - Never throws
 *
 * @param arg - Optional path (absolute or relative) or raw markdown content.
 *   Defaults to `config.PORTFOLIO`.
 * @returns Array of `PortfolioEntry`; never throws.
 */
export function readPortfolio(arg?: string): PortfolioEntry[] {
  // --- Case 1: no argument → read from config.PORTFOLIO (re-derived at call-time) ---
  if (arg === undefined) {
    const portfolioPath = path.join(resolveFactoryRoot(), "factory", "portfolio.md");
    return readPortfolioFromPath(portfolioPath);
  }

  // --- Case 2: raw content (contains a newline) → parse directly ---
  if (arg.includes("\n")) {
    return parsePortfolioTable(arg);
  }

  // --- Case 3: empty string → treat as empty content ---
  if (arg.trim() === "") {
    return [];
  }

  // --- Case 4: file path (absolute or relative, or ends in .md) → read file ---
  return readPortfolioFromPath(arg);
}

function readPortfolioFromPath(filePath: string): PortfolioEntry[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    // File absent, unreadable, or path invalid → graceful empty result (blueprint §3).
    return [];
  }
  return parsePortfolioTable(content);
}

// ---------------------------------------------------------------------------
// FRD-03: activeProjects() compose helper (IF-03-activeProjects, CMP-03-active-projects)
// ---------------------------------------------------------------------------

/**
 * Enriched portfolio row for the portfolio rail (FRD-03).
 *
 * Traceability: IF-03-activeProjects → REQ-03-001..003, REQ-03-006
 */
export type ProjectListItem = {
  name: string;
  /** Raw path cell from the portfolio row (verbatim; may be relative or nonexistent). */
  path: string;
  repo?: string;
  /** Raw StatusResult from readStatus(resolvedPath). */
  status: StatusResult;
  /** True when the resolved path exists on disk. False for not-found rows (badge-ready). */
  exists: boolean;
  /**
   * Phase used for rail display: authoritative from status.yaml when present and valid,
   * falls back to the portfolio row's phase cell (with "shipped" → "operation" mapping).
   * Undefined only when neither source can supply a valid phase.
   */
  stage?: Phase;
  /**
   * Strict boolean from status.status.running. Undefined when status is absent or running
   * field is missing/malformed. Never NaN or null-coerced (regression anchor B1').
   */
  running?: boolean;
  /**
   * Business snapshot populated ONLY for operation (shipped) phase, from the portfolio row's
   * Users / Return metric / Verdict columns. Undefined for non-operation entries or when all
   * snapshot cells are placeholders.
   */
  snapshot?: {
    users?: string;
    returnMetric?: string;
    verdict?: string;
  };
};

/**
 * The set of portfolio phase advisory cell values that map to active phases.
 * "shipped" is the human-readable alias for "operation" in the portfolio table.
 */
const ADVISORY_TO_PHASE: Record<string, Phase> = {
  architecture: "architecture",
  implementation: "implementation",
  building: "implementation",
  release: "release",
  operation: "operation",
  shipped: "operation",
  // Spanish advisory cell values (the real portfolio.md is Spanish, DR-009).
  arquitectura: "architecture",
  implementación: "implementation",
  construcción: "implementation",
  "en construcción": "implementation",
  lanzamiento: "release",
  operación: "operation",
  lanzada: "operation",
};

/** Active phases — entries with these phases appear in the portfolio rail (REQ-03-001). */
const ACTIVE_PHASES: ReadonlySet<Phase> = new Set<Phase>([
  "architecture",
  "implementation",
  "release",
  "operation",
]);

/**
 * Compose helper: read the portfolio, enrich each entry with its status and
 * existence flag, and return only the active-phase entries.
 *
 * Active set: `architecture` | `implementation` | `release` | `operation`.
 * Phase is determined from `status.yaml` (authoritative); absent/malformed status
 * falls back to the portfolio table's `phase` cell (advisory).
 *
 * Overload:
 * - **Omitted** — reads from `config.PORTFOLIO` (same as readPortfolio()).
 * - **Raw markdown content** (string with `\n`) — parses the content in-memory;
 *   existence probes use the raw path from the portfolio row (for inline fixture tests).
 *
 * Tolerance rules (blueprint §3):
 * - Missing portfolio → []
 * - Missing status.yaml → phase from portfolio advisory cell; exists from pathExists.
 * - Malformed status → same fallback.
 * - Path not found → exists: false; row still listed when phase is active (badge-ready).
 * - Never throws.
 *
 * @param content - Optional raw portfolio markdown content (for inline tests).
 * @returns Array of ProjectListItem (active phases only). Never throws.
 *
 * Traceability: IF-03-activeProjects → REQ-03-001..003, REQ-03-006; AC-03-001.1
 */
/**
 * Determine the rail display phase: status.yaml is authoritative; fall back to the
 * portfolio advisory phase cell (mapped to a Phase literal). Undefined when neither
 * source supplies a valid phase.
 */
function resolveStage(entry: PortfolioEntry, statusResult: StatusResult): Phase | undefined {
  if (statusResult.present && statusResult.status.phase !== undefined) {
    return statusResult.status.phase;
  }
  if (entry.phase !== undefined) {
    return ADVISORY_TO_PHASE[entry.phase.toLowerCase().trim()];
  }
  return undefined;
}

/** Strict boolean from status.running; undefined otherwise (regression B1'). */
function resolveRunning(statusResult: StatusResult): boolean | undefined {
  if (
    statusResult.present &&
    (statusResult.status.running === true || statusResult.status.running === false)
  ) {
    return statusResult.status.running;
  }
  return undefined;
}

/** Business snapshot, populated only for operation phase from the portfolio row columns. */
function resolveSnapshot(entry: PortfolioEntry, stage: Phase): ProjectListItem["snapshot"] {
  if (stage !== "operation") return undefined;
  const { users, returnMetric, verdict } = entry;
  if (users !== undefined || returnMetric !== undefined || verdict !== undefined) {
    return { users, returnMetric, verdict };
  }
  return undefined;
}

/**
 * Enrich a single portfolio entry into a ProjectListItem, or null when its phase
 * is not active (so it should not appear in the rail).
 */
function enrichEntry(entry: PortfolioEntry): ProjectListItem | null {
  const resolvedPath = resolveProjectPath(entry.path);
  const statusResult = readStatus(resolvedPath);
  const exists = pathExists(resolvedPath);

  const stage = resolveStage(entry, statusResult);
  if (stage === undefined || !ACTIVE_PHASES.has(stage)) {
    return null;
  }

  return {
    name: entry.name,
    path: entry.path,
    repo: entry.repo,
    status: statusResult,
    exists,
    stage,
    running: resolveRunning(statusResult),
    snapshot: resolveSnapshot(entry, stage),
  };
}

export function activeProjects(content?: string): ProjectListItem[] {
  const entries = readPortfolio(content);
  const result: ProjectListItem[] = [];

  for (const entry of entries) {
    const item = enrichEntry(entry);
    if (item !== null) {
      result.push(item);
    }
  }

  return result;
}
