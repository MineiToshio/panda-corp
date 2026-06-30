// =============================================================================
// IF-04-docs — WO-04-002
// `readActivityLog` + `readDecisions`: comms readers for the Summary tab.
//
// Traceability:
//   AC-04-003.2 Summary tab renders the activity log from .pandacorp/comms/progress.md.
//   AC-04-003.3 Summary tab renders decision points from .pandacorp/inbox/decisions.md.
//   REQ-04-003  Summary tab reads both comms files.
//   REQ-04-004  Pending decisions are highlighted; count = filter(!resolved).length.
//
// Files are Spanish, gitignored, owner-facing comms (architecture §4.5) — read as-is.
// Read-only: no writes, no Claude calls.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { pathExists } from "../fs-utils/fs-utils";

/**
 * The parsed activity log from `.pandacorp/comms/progress.md`.
 *
 * `entries` is a genuine JS Array of non-empty strings, each representing a
 * bullet line from the file (the leading "- " prefix is stripped).
 * Absent or empty file → `{ entries: [] }`. Never throws.
 */
export interface ActivityLog {
  /** Each bullet-line item from progress.md, trimmed, leading "- " stripped. */
  entries: string[];
}

/**
 * A single decision block parsed from `.pandacorp/inbox/decisions.md`.
 *
 * `id`             — a stable, human-typeable reference for this exact block, derived
 *                    from the heading (never invented, never reused): `<YYYY-MM-DD>-<n>`
 *                    for a date-prefixed heading, where `n` is the 1-based count of
 *                    date-prefixed blocks sharing that EXACT date, in file order, counting
 *                    pending AND resolved blocks (so an id never shifts when a sibling
 *                    changes status); `legacy-<n>` for an `OPEN:/CLOSED:/RESOLVED:` heading
 *                    (no date), `n` = its 1-based position among legacy headings only. The
 *                    SAME derivation (date/position, top-to-bottom, all blocks counted) is
 *                    documented for `/pandacorp:decide` to compute by eye, so an id copied
 *                    from Mission Control always resolves to the same block from the skill.
 * `title`          — the heading text with the date/status prefix stripped (trimmed).
 * `date`           — the heading's `YYYY-MM-DD` prefix, or `null` for a legacy heading
 *                    (no date). Feeds an "hace N días" age display — never invented.
 * `recommendation` — text after a `- **Recommendation:**` / `- **Recomendación:**`
 *                    line in the block, or `undefined` when the block has none.
 * `status`         — `"pending"` (still needs the owner's answer) | `"resolved"` (the
 *                    owner answered — CLOSED/RESOLVED/RESUELTO/CERRADO) | `"obsolete"`
 *                    (SUPERSEDIDO/OBSOLETO — the codebase moved on, no answer was given;
 *                    a distinct terminal state from "resolved" so the history is honest
 *                    about WHICH decisions were actually decided vs dropped). No status
 *                    signal at all → `"pending"` (DR-078: surface, don't silently hide).
 * `resolved`       — derived convenience: `status !== "pending"`. Kept so existing
 *                    pending-count consumers (`countPendingDecisions`, the badge) don't
 *                    need to know about the 3-way status.
 */
export interface DecisionPoint {
  id: string;
  title: string;
  date: string | null;
  recommendation?: string;
  status: "pending" | "resolved" | "obsolete";
  resolved: boolean;
}

/**
 * Parse `.pandacorp/comms/progress.md` into an ActivityLog.
 *
 * Collects all lines that start with "- " (optionally after trimming leading spaces),
 * strips the "- " prefix, and returns them as `entries`.
 *
 * Fail-soft tolerance:
 *   - Absent file → `{ entries: [] }` (no throw; AC-04-003.2 empty state).
 *   - Non-existent projectPath → `{ entries: [] }` (no throw).
 *   - Empty or whitespace-only file → `{ entries: [] }` (regression I2 vacuous-truth).
 *   - entries.length is always a genuine finite integer (regression B1').
 *   - entries is always a genuine JS Array (regression I3).
 *
 * @param projectPath - Absolute path to the project root.
 * @returns `ActivityLog` with `entries` as a genuine JS Array. Never throws.
 */
export function readActivityLog(projectPath: string): ActivityLog {
  const empty: ActivityLog = { entries: [] };

  if (!projectPath || projectPath.trim() === "") {
    return empty;
  }
  if (!pathExists(projectPath)) {
    return empty;
  }

  const progressPath = path.join(projectPath, ".pandacorp", "comms", "progress.md");
  if (!pathExists(progressPath)) {
    return empty;
  }

  let content: string;
  try {
    content = fs.readFileSync(progressPath, "utf-8");
  } catch {
    return empty;
  }

  // Collect genuine bullet lines (lines starting with "- " after leading whitespace).
  // Regression I2: only non-blank entries after stripping the prefix.
  // Regression I3: built with push into a genuine Array literal.
  const entries: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("- ")) {
      const text = trimmed.slice(2).trim();
      // Regression I2: never push blank entries.
      if (text.length > 0) {
        entries.push(text);
      }
    }
  }

  return { entries };
}

/**
 * Parse `.pandacorp/inbox/decisions.md` into an array of DecisionPoint objects.
 *
 * Supports two heading conventions, both seen in real `.pandacorp/inbox/decisions.md`
 * files (DR-078 — parse the actual shape met in production, not just the documented one):
 *   - **Legacy explicit-status**: `## OPEN: <title>` / `## CLOSED: <title>` / `## RESOLVED: <title>`.
 *   - **Date-prefixed** (the `/pandacorp:decide` template + what agents write in practice):
 *     `## YYYY-MM-DD (<status phrase>) — <title>` or `## YYYY-MM-DD — <title>`. The status
 *     phrase is free Spanish text (e.g. "NECESITA DECISIÓN DEL OWNER", "RESUELTO por el
 *     owner") matched against resolved/pending keyword sets. An explicit body line
 *     `- **Estado:** PENDIENTE` / `RESUELTO: …` (the template's machine field) takes
 *     priority over the heading phrase when present.
 * A `##` heading that matches neither convention is not a decision block — other headings
 * in the file are ignored, never invented as a phantom decision.
 *
 * Within a block, an optional recommendation line is captured: `- **Recommendation:**` or
 * the Spanish `**Recomendación…:**` (with or without the leading `- `, as written in practice).
 *
 * Fail-soft tolerance:
 *   - Absent file → `[]` (no throw; AC-04-003.3 empty state).
 *   - Non-existent projectPath → `[]` (no throw).
 *   - Empty or whitespace-only file → `[]` (regression I2 vacuous-truth).
 *   - result.length is always a genuine finite integer (regression B1').
 *   - Result is always a genuine JS Array (regression I3).
 *
 * @param projectPath - Absolute path to the project root.
 * @returns `DecisionPoint[]` — genuine JS Array. Never throws.
 */
export function readDecisions(projectPath: string): DecisionPoint[] {
  if (!projectPath || projectPath.trim() === "") {
    return [];
  }
  if (!pathExists(projectPath)) {
    return [];
  }

  const decisionsPath = path.join(projectPath, ".pandacorp", "inbox", "decisions.md");
  if (!pathExists(decisionsPath)) {
    return [];
  }

  let content: string;
  try {
    content = fs.readFileSync(decisionsPath, "utf-8");
  } catch {
    return [];
  }

  // Regression I3: genuine Array built with push.
  const result: DecisionPoint[] = [];

  let current: DecisionBlock | null = null;
  const idCounters: IdCounters = { byDate: new Map(), legacy: 0 };
  for (const line of content.split("\n")) {
    current = _consumeLine(result, current, line, idCounters);
  }

  // Flush the last block.
  _pushDecision(result, current);

  return result;
}

/** Mutable counters used to assign each heading a stable, never-reused id (see DecisionPoint.id). */
type IdCounters = { byDate: Map<string, number>; legacy: number };

/**
 * Process one line of `decisions.md`: a heading flushes the previous block (pushed into
 * `result`) and opens a new one (assigning it a stable id via `idCounters`); any other
 * line is scanned for the current block's optional recommendation/estado fields. Returns
 * the (possibly new) current block.
 */
function _consumeLine(
  result: DecisionPoint[],
  current: DecisionBlock | null,
  line: string,
  idCounters: IdCounters,
): DecisionBlock | null {
  const heading = _parseHeading(line);
  if (heading !== null) {
    _pushDecision(result, current);
    return {
      id: _nextId(heading, idCounters),
      title: heading.title,
      date: heading.date,
      statusPhrase: heading.statusPhrase,
      estado: null,
    };
  }

  if (current === null) return current;

  const recommendation = _parseRecommendation(line);
  if (recommendation !== undefined) {
    current.recommendation = recommendation;
  }
  const estado = _parseEstado(line);
  if (estado !== undefined) {
    current.estado = estado;
  }
  return current;
}

/**
 * Assign the next stable id for a freshly-parsed heading and advance its counter.
 * `<date>-<n>` for a dated heading (n = 1-based count of blocks sharing that exact date,
 * pending + resolved, file order); `legacy-<n>` for an OPEN/CLOSED/RESOLVED heading.
 */
function _nextId(heading: ParsedHeading, idCounters: IdCounters): string {
  if (heading.date === null) {
    idCounters.legacy += 1;
    return `legacy-${idCounters.legacy}`;
  }
  const n = (idCounters.byDate.get(heading.date) ?? 0) + 1;
  idCounters.byDate.set(heading.date, n);
  return `${heading.date}-${n}`;
}

/**
 * Count pending (unresolved) decisions for a project — the single live count every
 * owner-facing surface should show (DR-092 single source). Equivalent to
 * `readDecisions(projectPath).filter(d => !d.resolved).length`, exposed as its own
 * function so call sites don't re-derive the filter independently.
 *
 * @param projectPath - Absolute path to the project root.
 * @returns A genuine finite integer ≥ 0. Never throws (inherits readDecisions' fail-soft tolerance).
 */
export function countPendingDecisions(projectPath: string): number {
  return readDecisions(projectPath).filter((d) => !d.resolved).length;
}

// Legacy explicit-status heading: "## OPEN: <title>" / "## CLOSED: <title>" / "## RESOLVED: <title>".
const LEGACY_HEADING = /^##\s+(OPEN|CLOSED|RESOLVED):\s*(.+)/i;
// Date-prefixed heading: "## YYYY-MM-DD (<status phrase>) — <title>" or "## YYYY-MM-DD — <title>"
// or "## YYYY-MM-DD <title>" (no separator). Group 1 = date, group 2 = optional status phrase, group 3 = title.
const DATED_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s*(?:\(([^)]*)\)\s*)?(?:[—-]\s*)?(.+)$/;
// Recommendation bullet: "- **Recommendation:** <text>" (both bold styles, "- " optional).
const RECOMMENDATION_LINE = /^-?\s*\*{1,2}Recommendation:\*{1,2}\s*(.+)/i;
// Spanish variant: "**Recomendación:**" / "**Recomendación (del agente):**" / "**Recomendación del X:**".
const RECOMENDACION_LINE = /^-?\s*\*{1,2}Recomendaci[oó]n[^:*]*:\*{1,2}\s*(.+)/i;
// The template's machine field: "- **Estado:** PENDIENTE" / "RESUELTO: …" / "OBSOLETO: …".
const ESTADO_LINE = /^-?\s*\*{1,2}Estado:?\*{1,2}\s*(PENDIENTE|RESUELTO|OBSOLETO|OBSOLETA)/i;
// "Resolved" / "pending" / "obsolete" keyword sets for a heading's status phrase — covers both the
// legacy English single-word phrase (CLOSED/RESOLVED/OPEN) and the Spanish free-text phrase.
// Obsolete is its OWN status (the codebase moved on, no answer was given) — NOT folded into
// resolved, so the history stays honest about which decisions were actually answered.
const RESOLVED_KEYWORDS = /^CLOSED$|^RESOLVED$|RESUELT|CERRAD/;
const OBSOLETE_KEYWORDS = /SUPERSEDID|OBSOLET/;
const PENDING_KEYWORDS = /^OPEN$|NECESITA|PENDIENT|ABIERT/;

/**
 * A heading parse result: the block's title, an optional raw status phrase, and its date
 * (`null` for a legacy heading) — `date` feeds the id derivation (`_nextId`) and the
 * owner-facing age display.
 */
interface ParsedHeading {
  title: string;
  statusPhrase: string | null;
  date: string | null;
}

/** Mutable accumulator for the decision block currently being parsed. */
type DecisionBlock = {
  id: string;
  title: string;
  date: string | null;
  statusPhrase: string | null;
  estado: "pending" | "resolved" | "obsolete" | null;
  recommendation?: string;
};

/**
 * Parse a `##` heading line into a title + optional status phrase + date, trying the
 * legacy convention first (preserves exact historical behavior), then the date-prefixed
 * one. Returns `null` for any other `##` heading (not a decision block).
 */
function _parseHeading(line: string): ParsedHeading | null {
  const legacy = LEGACY_HEADING.exec(line);
  if (legacy) {
    const title = (legacy[2] ?? "").trim();
    return title === ""
      ? null
      : { title, statusPhrase: (legacy[1] ?? "").toUpperCase(), date: null };
  }
  const dated = DATED_HEADING.exec(line);
  if (dated) {
    const title = (dated[3] ?? "").trim();
    return title === ""
      ? null
      : { title, statusPhrase: dated[2]?.trim() ?? null, date: dated[1] ?? null };
  }
  return null;
}

/**
 * Extract the recommendation text from a line (English or Spanish bold-prefixed bullet),
 * or `undefined` when the line is not a (non-empty) recommendation line.
 */
function _parseRecommendation(line: string): string | undefined {
  const recMatch = RECOMMENDATION_LINE.exec(line) ?? RECOMENDACION_LINE.exec(line);
  if (!recMatch) return undefined;
  const text = (recMatch[1] ?? "").trim();
  return text.length > 0 ? text : undefined;
}

/** Extract the template's explicit `- **Estado:**` machine field, or `undefined` if absent. */
function _parseEstado(line: string): "pending" | "resolved" | "obsolete" | undefined {
  const m = ESTADO_LINE.exec(line);
  if (!m) return undefined;
  const word = (m[1] ?? "").toUpperCase();
  if (word === "RESUELTO") return "resolved";
  if (word === "OBSOLETO" || word === "OBSOLETA") return "obsolete";
  return "pending";
}

/**
 * Resolve a block's status: an explicit `- **Estado:**` body line wins; otherwise the
 * heading's status phrase is matched against known resolved/obsolete/pending keywords
 * (covers both the legacy single-word phrase and the date-prefixed free-text phrase
 * uniformly); with no signal at all, default to pending — surface rather than silently
 * hide it (DR-078 fail-loud spirit).
 */
function _resolveStatus(
  statusPhrase: string | null,
  estado: "pending" | "resolved" | "obsolete" | null,
): "pending" | "resolved" | "obsolete" {
  if (estado !== null) return estado;
  if (statusPhrase === null) return "pending";
  if (OBSOLETE_KEYWORDS.test(statusPhrase)) return "obsolete";
  if (RESOLVED_KEYWORDS.test(statusPhrase)) return "resolved";
  if (PENDING_KEYWORDS.test(statusPhrase)) return "pending";
  return "pending";
}

/**
 * Append a parsed block as a DecisionPoint when it has a non-empty title.
 */
function _pushDecision(result: DecisionPoint[], block: DecisionBlock | null): void {
  if (block === null || block.title.trim().length === 0) {
    return;
  }
  const status = _resolveStatus(block.statusPhrase, block.estado);
  const dp: DecisionPoint = {
    id: block.id,
    title: block.title,
    date: block.date,
    status,
    resolved: status !== "pending",
  };
  if (block.recommendation !== undefined) {
    dp.recommendation = block.recommendation;
  }
  result.push(dp);
}
