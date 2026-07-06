---
id: FRD-23-blueprint
type: blueprint
parent: FRD-23
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-07-06'
---
# Feature blueprint — FRD-23 Materialized stats read-model

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049): how FRD-23 is implemented on top of the platform in
> [`docs/product/architecture.md`](../../product/architecture.md), and how it supersedes the FRD-10
> blueprint §3 "git-at-read-time in the render" contract for the Informe. Architecture decision:
> [ADR-0004](../../adr/ADR-0004-materialized-stats-read-model.md).

## 1. Summary

Move the Informe's history-derived numbers from "derive by shelling out to git in the render" to
"read a materialized read-model (`.pandacorp/stats.json`) with a self-validating freshness seal, and
fall back to the live git reader when the snapshot is missing / stale / corrupt". The **live git
readers stay** (WO-10-014, `src/lib/achievements/report/*`) — they become the **fallback**, not the
primary path, and the reference the writer + equivalence test derive against.

## 2. Platform references

- **Read-only invariant (architecture §7).** Mission Control (the app) stays **read-only** over the
  read-model: it only reads `stats.json` + the aggregate index + (fallback) live git. The **writers**
  live in the **factory tooling**, not in the MC app: the Stop hook / `post-commit` hook / `sync-portfolio`
  / the backfill command. This is a platform decision — see ADR-0004. MC's `lib/discard/` write set is
  unchanged; MC never writes `stats.json`.
- **Fail-loud read boundary (DR-078).** The portada reader and the aggregate reader parse-don't-validate:
  a typed value OR an explicit error variant, never a silent `[]`/`null`. The caller renders the
  fallback / error state.
- **Single source of truth (DR-115).** `stats.json` is an **honest cache**: single named writer,
  re-derived from git (the atomic source) at safe points, seal-validated on read, documented as a
  replica; never maintained by incremental writes; never read while a live resolver would be more
  correct (seal decides).
- **Reuse of existing readers.** The writer derives the portada by calling the already-shipped **pure**
  cores in `src/lib/achievements/report/*` (`deriveWeeklyFlow`, `derivePhaseTransitions`, `deriveScalars`,
  `deriveLessonCounts`, `funnelAndFlow`) — do NOT re-implement the derivation (DR-092).

## 3. Modules

- **`src/lib/achievements/read-model/statsReader.ts`** (new) — `readStatsPortada(projectPath): PortadaResult`
  and `readStatsAggregate(): AggregateResult`. Fail-loud (DR-078): parse the JSON with a Zod schema; on a
  malformed/unrecognised shape return an explicit error variant. `PortadaResult = {ok:true; value: StatsPortada}
  | {ok:false; reason:"missing"|"stale"|"unparseable"}`.
- **`src/lib/achievements/read-model/seal.ts`** (new) — `currentSeal(projectPath): string` =
  `git log -1 --format=%H -- docs/frds .pandacorp/status.yaml` (O(1)); `isFresh(portada, seal)`.
- **`src/lib/achievements/read-model/statsWriter.ts`** (new — factory tooling, invoked by hooks/backfill)
  — `writeStatsPortada(projectPath)`: re-derives via the report `derive*` cores + stamps the seal, writes
  **atomically** (tmp + rename). Single writer (DR-115).
- **Informe wiring** — the Informe data layer (WO-10-014 consumers) is changed to try the portada/aggregate
  first (via `statsReader`) and fall back to the existing live git readers on any non-`ok` result. The live
  readers are unchanged.
- **`sync-portfolio` join** — extend the existing portfolio walk to write the aggregate index from the N
  portadas.
- **Backfill** — one-shot command over existing projects calling `writeStatsPortada` once each.

## 4. Data model

```
StatsPortada = {
  seal: string,               // git log -1 --format=%H -- docs/frds .pandacorp/status.yaml
  generatedAt: string,        // ISO — provenance, not authority
  weeklyFlow: WeeklyFlow,     // from report/types.ts (reused verbatim)
  phaseTransitions: PhaseTransition[],
  scalars: ReportScalars,
  lessons: LessonCounts | null,
  funnel: FunnelFlow,
}
StatsAggregate = { projects: Record<string, StatsPortada> }
PortadaResult   = { ok: true; value: StatsPortada } | { ok: false; reason: "missing" | "stale" | "unparseable" }
```

The reader NEVER returns a bare `[]`/`null` on an unrecognised shape (DR-078); `reason` distinguishes
"missing" from "unparseable" from "stale" so the caller acts correctly.

## 5. Testing (DR-078 / DR-115)

- **Real-shape fixture** portada (production shape) → reads correctly, seal matches → used.
- **Malformed** portada (bad JSON / wrong shape) → reader fails loud → fallback to live git.
- **Stale** portada (seal mismatch) → fallback.
- **Missing** portada → fallback.
- **Atomic write** → a simulated mid-write never leaves a readable corrupt file.
- **Equivalence** → materialized numbers == live-git numbers for the same project (cross-check the
  `ca82bbba` invariant).
- **Aggregate index** → O(1) read; malformed aggregate fails loud.
- **Backfill** → generates an initial portada equivalent to the live reader.
