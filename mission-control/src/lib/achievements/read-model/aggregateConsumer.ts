/**
 * lib/achievements/read-model/aggregateConsumer.ts — the O(1) aggregate READ path (FRD-23, WO-23-004, REQ-23-003).
 *
 * AC-23-003.1 has two clauses: (a) `sync-portfolio` JOINS the N portadas into one file (see
 * `aggregate.ts`), and (b) Mission Control READS that one file in O(1). This module is clause (b):
 * the read path the Informe uses. The MC render (`app/achievements/page.tsx`) reads the aggregate
 * index (`readStatsAggregate`, WO-23-001) in a SINGLE `fs` read — one file, independent of the
 * number of projects — then calls `resolvePortadaFromAggregate` to pick + seal-validate the current
 * project's entry. Before this, the Informe paid an O(N) git shell-out per navigation.
 *
 * Platform golden rule (architecture §1): read-only. This only READS the aggregate + (fallback) the
 * per-project portada; the writers live in the factory tooling (ADR-0004).
 *
 * Honest, seal-validated (DR-078 + DR-115): the aggregate join does NOT seal-validate at join time
 * (it may legitimately hold independently-stale entries — see `aggregate.ts`), so freshness is
 * checked HERE at the point of use. The result is the SAME `PortadaResult` `readStatsPortada`
 * returns, so the Informe wiring (`resolveInformeSources`) is unchanged. Any non-usable outcome —
 * missing / unparseable aggregate, no entry for this project, or a stale entry — falls back to the
 * per-project reader (`readStatsPortada`), which itself falls back to live git. Never a fabricated
 * zero, never a silent empty.
 */

import { currentSeal, isFresh } from "./seal";
import { type AggregateResult, type PortadaResult, readStatsPortada } from "./statsReader";

/**
 * Resolve one project's portada from an already-read aggregate result, preferring the O(1) entry and
 * falling back to the per-project reader (REQ-23-003, AC-23-003.1 clause b).
 *
 * The caller reads the aggregate ONCE (`readStatsAggregate`) and passes the result in, so the single
 * file read is at the render surface (the literal consumer). If the aggregate holds a fresh entry for
 * `projectKey` (seal-checked against live git via `currentSeal(projectPath)`), returns it as
 * `{ ok: true, value }` WITHOUT touching the per-project `stats.json`. On any non-usable outcome —
 * aggregate missing/unparseable, no entry for this project, or a stale entry — it defers to
 * `readStatsPortada(projectPath)` (which seal-validates the on-disk file and, on its own
 * miss/stale/corrupt, the caller falls back to live git). Fail-loud throughout (DR-078): every branch
 * returns an explicit `PortadaResult`.
 *
 * @param aggregate   - The result of `readStatsAggregate(aggregatePath)` (WO-23-001).
 * @param projectKey  - The project's key in the aggregate's `projects` record (its portfolio path cell).
 * @param projectPath - Absolute path to the project's git work-tree (for the seal + fallback read).
 * @returns A `PortadaResult` the Informe wiring branches on (identical shape to `readStatsPortada`).
 */
export function resolvePortadaFromAggregate(
  aggregate: AggregateResult,
  projectKey: string,
  projectPath: string,
): PortadaResult {
  if (aggregate.ok) {
    const entry = aggregate.value.projects[projectKey];
    // A fresh aggregate entry is the O(1) hit — trust it only after re-validating its seal (the
    // join may have captured it while stale). A stale or absent entry falls through to the
    // per-project reader, never a fabricated zero.
    if (entry !== undefined && isFresh(entry, currentSeal(projectPath))) {
      return { ok: true, value: entry };
    }
  }

  // Aggregate missing / unparseable / no fresh entry for this project → per-project reader (which
  // seal-validates the on-disk portada and, on its own non-`ok`, the caller falls back to live git).
  return readStatsPortada(projectPath);
}
