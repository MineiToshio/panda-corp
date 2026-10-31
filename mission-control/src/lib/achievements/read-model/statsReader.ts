/**
 * lib/achievements/read-model/statsReader.ts — the fail-loud portada reader (FRD-23, WO-23-001).
 *
 * Platform golden rule (architecture §1): read-only over the read-model. This module only READS
 * `stats.json` + the aggregate index; the writers live in the factory tooling (ADR-0004).
 *
 * Fail-loud (DR-078): every read returns a discriminated result — a typed value OR an explicit
 * reason — never a silent `[]`/`null` that reads as "no activity". The caller falls back to the
 * live git reader on any non-`ok` result:
 *   - present + well-formed + seal matches → `{ ok: true, value }`   (AC-23-001.1)
 *   - missing                              → `{ ok: false, reason: "missing" }`     (AC-23-001.2)
 *   - present but seal mismatches (stale)  → `{ ok: false, reason: "stale" }`       (AC-23-001.3)
 *   - present but unparseable/corrupt      → `{ ok: false, reason: "unparseable" }` (AC-23-001.4)
 */

import fs from "node:fs";
import { readParsedPortada } from "./portadaFile";
import { currentSeal, isFresh } from "./seal";
import { parseStatsAggregate, type StatsAggregate, type StatsPortada } from "./statsSchema";

/**
 * The result of reading one project's portada (DR-078 discriminated union).
 * `reason` distinguishes "missing" from "stale" from "unparseable" so the caller acts correctly
 * (all three fall back to live git, but the distinction is observable, not collapsed to a silent empty).
 */
export type PortadaResult =
  | { readonly ok: true; readonly value: StatsPortada }
  | { readonly ok: false; readonly reason: "missing" | "stale" | "unparseable" };

/** The result of reading the aggregate index (DR-078). */
export type AggregateResult =
  | { readonly ok: true; readonly value: StatsAggregate }
  | { readonly ok: false; readonly reason: "missing" | "unparseable" };

/**
 * Read one project's materialized portada, validating its freshness seal against live git.
 *
 * Fail-loud (DR-078): a corrupt/unrecognised `stats.json` yields `{ ok: false, reason: "unparseable" }`,
 * NEVER a silent empty. `currentSeal` is `null` (git unavailable) ⇒ the portada can't be validated ⇒
 * treated as `stale` (fall back to live git, never trust an unvalidatable snapshot).
 *
 * @param projectPath - Absolute path to the project's git work-tree.
 * @returns A `PortadaResult` the caller branches on (`ok` → use the numbers; else fall back).
 */
export function readStatsPortada(projectPath: string): PortadaResult {
  const result = readParsedPortada(projectPath);
  if (!result.ok) return result;
  const portada = result.value;

  if (!isFresh(portada, currentSeal(projectPath))) {
    // Seal mismatch (or git unavailable) → stale → fall back to live git (AC-23-001.3).
    return { ok: false, reason: "stale" };
  }

  return { ok: true, value: portada };
}

/**
 * Read the aggregate index (`sync-portfolio`'s O(1) join of every project's portada).
 *
 * Fail-loud (DR-078): a malformed aggregate yields `{ ok: false, reason: "unparseable" }`, never a
 * silent empty (AC-23-003.2). Absence → `{ ok: false, reason: "missing" }`. Seal validation is
 * per-project at the point of use (`readStatsPortada`), not here — the aggregate is a join, and
 * individual entries may be independently stale.
 *
 * @param aggregatePath - Absolute path to the aggregate index file.
 * @returns An `AggregateResult` the caller branches on.
 */
export function readStatsAggregate(aggregatePath: string): AggregateResult {
  let raw: string;
  try {
    raw = fs.readFileSync(aggregatePath, "utf-8");
  } catch (error) {
    if (isNotFound(error)) {
      return { ok: false, reason: "missing" };
    }
    throw error;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "unparseable" };
  }

  const aggregate = parseStatsAggregate(json);
  if (aggregate === null) {
    return { ok: false, reason: "unparseable" };
  }

  return { ok: true, value: aggregate };
}

/** True when a filesystem error is a "file not found" (ENOENT) — a real absence, not corruption. */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
