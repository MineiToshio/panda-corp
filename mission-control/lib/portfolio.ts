import fs from "node:fs";
import path from "node:path";
import { resolveFactoryRoot } from "./config";

/**
 * Data-reading module for the portfolio table (FRD-01, CMP-01-portfolio).
 *
 * Platform golden rule (architecture §1): read-only, never call Claude.
 * All I/O is `fs.readFileSync` only — no writes, no egress.
 *
 * Traceability:
 *   IF-01-readPortfolio → REQ-01-004 → AC-01-004.1
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
function parsePortfolioTable(content: string): PortfolioEntry[] {
  if (!content || content.trim() === "") return [];

  const lines = content.split("\n");
  const entries: PortfolioEntry[] = [];

  // `columnMap[i]` = the PortfolioEntry key for column index i (undefined = unknown column).
  let columnMap: (keyof PortfolioEntry | undefined)[] | null = null;

  for (const line of lines) {
    if (!isTableRow(line)) {
      // Non-table line: if we had a header, reset so we can pick up a new header later.
      // (Supports multiple disjoint tables.)
      // We do NOT reset columnMap here — we reset it only when we encounter a new header row.
      continue;
    }

    if (isSeparatorRow(line)) {
      // Separator row: skip.
      continue;
    }

    const cells = splitTableRow(line);

    // Detect header row: a row where the first cell normalizes to a known header key.
    const firstCell = (cells[0] ?? "").trim().toLowerCase();
    if (firstCell === "name") {
      // This is a header row — build the column map.
      columnMap = cells.map((cell) => HEADER_MAP[cell.trim().toLowerCase()] ?? undefined);
      continue;
    }

    // Data row: need a column map to interpret it.
    if (columnMap === null) {
      // No header seen yet — skip.
      continue;
    }

    // Build the entry from the cells.
    const rawName = cells[0];
    const rawPath = cells[1];

    // name and path are required; skip rows where either is blank/placeholder.
    if (!rawName || PLACEHOLDERS.has(rawName.trim()) || rawName.trim() === "") continue;
    if (!rawPath || PLACEHOLDERS.has(rawPath.trim()) || rawPath.trim() === "") continue;

    const entry: PortfolioEntry = {
      name: rawName.trim(),
      path: rawPath.trim(),
    };

    // Map remaining columns using the header-derived column map.
    for (let i = 2; i < columnMap.length; i++) {
      const key = columnMap[i];
      if (key === undefined || key === "name" || key === "path") continue;
      const raw = cells[i] ?? "";
      const normalized = normalizeCell(raw);
      if (normalized !== undefined) {
        (entry as Record<string, string | undefined>)[key] = normalized;
      }
    }

    entries.push(entry);
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
