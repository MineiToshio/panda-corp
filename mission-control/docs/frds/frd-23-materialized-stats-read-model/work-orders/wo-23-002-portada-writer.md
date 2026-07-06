---
id: WO-23-002
type: work-order
slug: portada-writer
title: 'WO-23-002 — Portada writer (single writer, atomic) + portada-vs-live equivalence'
status: ACTIVE
parent: FRD-23
implementation_status: VERIFIED
reopen_count: 0
source_requirements: [REQ-23-002]
artifacts: [src/lib/achievements/read-model/statsWriter.ts, src/lib/achievements/read-model/_tests/**]
difficulty: high
dependsOn: [WO-23-001]
last_updated: '2026-07-06'
---
# WO-23-002 — Portada writer

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Contract in
[`frd.md`](../frd.md) (REQ-23-002); design in [`blueprint.md`](../blueprint.md) §3.

## Goal
The **single writer** (DR-115) that re-derives the portada from git via the report `derive*` cores and
writes it **atomically**. Lives in factory tooling (invoked by hooks/backfill), not the MC render path.

## In scope
- `writeStatsPortada(projectPath)` — re-derive `weeklyFlow / phaseTransitions / scalars / lessons /
  funnel` by calling the existing pure cores in `src/lib/achievements/report/*` (DR-092 — do not
  re-implement), stamp `seal = currentSeal(projectPath)` and `generatedAt`, write **atomically**
  (tmp file + `fs.rename`).

## Acceptance criteria (EARS)
- **AC-23-002.1** — numbers re-derived from git + seal stamped; **never** incremental `+1/-1` writes.
- **AC-23-002.2** — atomic write (tmp + rename); a mid-write crash never leaves corrupt `stats.json`.
- **AC-23-002.3** — **equivalence**: materialized numbers == live-git numbers for the same project.

## TDD plan
RED: equivalence test (write portada for a fixture repo, read it back, assert == the live `derive*`
output); atomic-write test (no readable partial file). GREEN: implement. Refactor.

## Definition of done
`pnpm vitest run lib/achievements/read-model` green; tsc + biome clean; no `any`; `.pandacorp/verify.sh` passes.

## Status Note

**Built (IN_REVIEW).** The SINGLE writer (DR-115) of the materialized portada — re-derives every
number from git via the already-shipped report cores (DR-092, no re-implementation), stamps the
freshness seal, and writes `.pandacorp/stats.json` **atomically** (tmp + rename). Factory tooling
only (invoked by hooks/backfill/`sync-portfolio` — WO-23-004), NEVER the MC render path.

### Files
- `src/lib/achievements/read-model/statsWriter.ts` — the writer.
- `src/lib/achievements/read-model/_tests/statsWriter.test.ts` — 13 tests (RED-proven).

### Interfaces / contracts exposed (signatures)
```ts
type LiveReportValues = {
  weeklyFlow: ReportResult<WeeklyFlow>;          // from report/flowSeries.ts `weeklyFlow(projectPath)`
  phaseTransitions: ReportResult<PhaseTransition[]>; // from report/phaseTransitions.ts `phaseTransitions()`
  scalars: ReportScalars;                        // from report/scalars.ts `reportScalars(projectPath)`
  lessons: LessonCounts | null;                  // from report/lessons.ts `lessonCounts()`
  funnel: FunnelFlow;                            // from report/funnel.ts `funnelAndFlow(ideas, statuses)`
};
type PortadaStamp = { seal: string; generatedAt: string };
class PortadaDeriveError extends Error {}

buildPortada(values: LiveReportValues, stamp: PortadaStamp): StatsPortada   // pure; throws PortadaDeriveError
gatherLiveValues(projectPath: string, ideas?, statuses?): LiveReportValues  // impure; reads the report readers
writePortadaAtomic(filePath: string, portada: StatsPortada): void           // tmp + fs.rename, cleanup on fail
writeStatsPortada(projectPath: string, now?: () => Date): string            // the single writer; returns the abs path
```

### Integration seams (for WO-23-004 hooks/backfill and WO-23-003 wiring)
- **Backfill / hooks / `sync-portfolio` (WO-23-004)** call `writeStatsPortada(projectPath)` once per
  project. It returns the absolute path of the written `stats.json`, or **throws `PortadaDeriveError`**
  when git is unavailable / a required source is non-`ok` (writes nothing — the reader's live-git
  fallback covers the gap). Callers should catch `PortadaDeriveError` and skip that project, never
  fabricate an empty portada.
- The written JSON satisfies `parseStatsPortada` (WO-23-001) and its `seal` equals
  `currentSeal(projectPath)` at write time — so the reader treats a just-written portada as **fresh**.

### Decisions & assumptions the consumer inherits
- **Assembled, not re-derived (DR-092).** `gatherLiveValues` calls the SAME report readers the render
  uses (`weeklyFlow`/`phaseTransitions`/`reportScalars`/`lessonCounts`/`funnelAndFlow`); `buildPortada`
  only UNWRAPS the `ReportResult`s. Equivalence (AC-23-002.3) holds **by construction** — there is one
  derivation, not two.
- **Fail loud, write nothing (DR-078).** A `null` seal (git unavailable) OR a non-`ok`
  `weeklyFlow`/`phaseTransitions` throws `PortadaDeriveError` — the writer NEVER materializes a
  fabricated "no activity" portada. `scalars`, `lessons` (nullable) and `funnel` are always-derivable
  values, so they don't gate the write; only the two `ReportResult` sources + the seal do.
- **Atomicity (AC-23-002.2).** Temp file is `<.pandacorp>/.stats.json.<pid>.<ms>.tmp` (same dir → same
  filesystem → `fs.rename` is atomic). On any write/serialize failure the temp file is removed
  (best-effort) and the original error re-thrown; the pre-existing `stats.json` is left whole (a
  mid-write crash never yields a readable partial file). The rename swaps the whole file at once.
- **Serialization format.** Pretty-printed (`JSON.stringify(portada, null, 2)`) with a trailing
  newline — human-diffable in git; the parser is whitespace-agnostic so format is cosmetic.
- **`generatedAt`** is provenance (ISO), NOT authority — the seal decides freshness. A `now: () => Date`
  param is injected for deterministic tests; production uses the wall clock.
- **`funnel` inputs.** `gatherLiveValues` defaults `ideas`/`statuses` to the SAME single sources the
  render reads (`readIdeas()`, `getGuildState().statuses`) so a standalone hook/backfill call produces
  the identical funnel the render would (DR-115 single source).
- **No new dependency** — pure `node:fs`/`node:path` for the atomic write (no `write-file-atomic` pkg;
  DR-052 no mid-build churn). The tmp+rename is the standard atomic-write pattern.

### Tests (all green, RED-proven) — `_tests/statsWriter.test.ts`
- `buildPortada`: materializes live numbers verbatim + stamps seal (AC-23-002.1); round-trips through
  the fail-loud parser; accepts `lessons: null`; fails loud on non-`ok` weeklyFlow/phaseTransitions +
  empty seal (DR-078).
- `writePortadaAtomic`: writes a parseable file; a simulated rename-time crash leaves the WHOLE
  previous file intact with no temp litter; a write-time failure never creates the target (AC-23-002.2).
- `writeStatsPortada`: fails loud (writes nothing) on a null seal; writes a fresh seal-matching portada
  the reader accepts against the real MC git repo.
- **Equivalence (AC-23-002.3)**: the materialized numbers `.toEqual` the live git reader's numbers
  field-by-field for the real MC repo (`weeklyFlow`, `phaseTransitions`, `scalars`, `lessons`, `funnel`).

### Self-test (green)
`pnpm biome check` (2 files, clean) · `pnpm tsc --noEmit` (clean) · `pnpm vitest run
src/lib/achievements/read-model` (5 files, 45 tests passed) · knip (exit 0, no unused exports) ·
madge (no cycles). No `any`/`@ts-ignore`.
