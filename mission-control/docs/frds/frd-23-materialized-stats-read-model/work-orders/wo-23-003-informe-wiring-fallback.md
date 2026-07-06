---
id: WO-23-003
type: work-order
slug: informe-wiring-fallback
title: 'WO-23-003 — Wire the Informe to read the portada first, fall back to live git'
status: ACTIVE
parent: FRD-23
implementation_status: VERIFIED
reopen_count: 0
source_requirements: [REQ-23-001, REQ-23-005]
artifacts: [src/lib/achievements/report/**, src/app/**]
difficulty: medium
dependsOn: [WO-23-001]
last_updated: '2026-07-06'
---
# WO-23-003 — Informe wiring + honest fallback

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Contract in
[`frd.md`](../frd.md) (REQ-23-001, REQ-23-005); design in [`blueprint.md`](../blueprint.md) §3.

## Goal
Make the Informe data path try the portada/aggregate first and **fall back to the existing live git
readers** (WO-10-014) on any non-`ok` result. No visual change (the Informe looks identical).

## In scope
- A resolver that, per project, calls `readStatsPortada` (WO-23-001); on `{ok:true}` uses the portada,
  on any `{ok:false}` (`missing`/`stale`/`unparseable`) falls back to the live `weeklyFlow` /
  `phaseTransitions` / `reportScalars` / `lessonCounts` / `funnelAndFlow`.
- Keep `getPendingMerge` (FRD-21) on the **live** path — NOT materialized (AC-23-005.1).

## Acceptance criteria (EARS)
- **AC-23-001.1** — fresh portada → numbers come from the portada, no live git shell.
- **AC-23-001.2/.3/.4** — missing / stale / corrupt → fall back to the live reader, honest, never a
  fabricated zero.
- **AC-23-005.1** — `getPendingMerge` still reads live git.

## TDD plan
RED: resolver tests over stubbed reader results (fresh → portada; each non-`ok` → live fallback);
assert pending-merge untouched. GREEN: implement. Refactor.

## Definition of done
`pnpm vitest run lib/achievements` green incl. existing; tsc + biome clean; no `any`; `.pandacorp/verify.sh` passes.

## Status Note

**Built.** A new pure resolver — `src/lib/achievements/read-model/informeResolver.ts` —
`resolveInformeSources(portadaResult: PortadaResult, live: LiveInformeReaders): InformeSources`.
On `portadaResult.ok === true` it returns the portada's `weeklyFlow`/`phaseTransitions`/`scalars`/
`lessons`/`funnel` **without invoking any live reader** (AC-23-001.1 — no git shell for that
project). On ANY non-`ok` result (`missing` / `stale` / `unparseable` — AC-23-001.2/.3/.4) it
calls **every** live thunk and returns their results **verbatim**, including a live reader's own
fail-loud result (e.g. `{ ok: false, reason: "git-unavailable" }`) — the resolver never
synthesizes its own empty/zero on fallback.

**Integration seam** — `src/app/achievements/page.tsx` (the `HallPage` Server Component) now
calls `resolveInformeSources(readStatsPortada(projectPath), { weeklyFlow, phaseTransitions,
scalars, lessons, funnel })` where each `live.*` is a zero-arg closure over the EXISTING WO-10-014
readers (`weeklyFlow(projectPath)`, `phaseTransitions()`, `reportScalars(projectPath)`,
`lessonCounts()`, `funnelAndFlow(ideas, statuses)`) — those readers are byte-for-byte unchanged;
only the call site moved into a lazy thunk so a fresh portada genuinely skips them. The resolved
`informeSources.{weeklyFlow,phaseTransitions,scalars,lessons,funnel}` feed `buildInformeData`
exactly where the live values used to go — `usage` (not part of the materialized `StatsPortada`
shape, per blueprint §4) is untouched, still derived live from `usageMix`/the event snapshot.

**`getPendingMerge` (FRD-21) is untouched** — `src/lib/pendingMerge/pendingMerge.ts` and its
consumer `PendingMergeBadge` were not touched by this work order; it is a separate module on its
own always-live `cache(readPending)` path, never routed through `resolveInformeSources`
(AC-23-005.1 verified by inspection — zero diff on that file/module).

**Decisions & assumptions the consumer inherits:**
- `InformeSources` is the resolved-per-project bundle of the five materializable report shapes;
  `LiveInformeReaders` are **zero-arg thunks** (not the raw reader functions) so the caller
  supplies already-partially-applied closures (`projectPath`, `ideas`, `statuses` captured) and
  the resolver stays free of those parameters — it only branches on `PortadaResult`.
- The resolver does not read/validate the seal itself (that's `readStatsPortada`, WO-23-001) —
  it is a pure dispatcher over an already-computed `PortadaResult`, kept unit-testable without I/O
  (mirrors `buildInformeData`'s "pure over already-read inputs" convention, DR-092/DR-115).
- No visual change: `InformeData`'s shape and `Informe.tsx`'s rendering are untouched; only the
  upstream source of the five fields changed.

**Tests (all green, RED-proven):**
- `src/lib/achievements/read-model/_tests/informeResolver.test.ts` — fresh portada → portada
  values, live thunks NEVER called (AC-23-001.1); missing/stale/unparseable → every live thunk
  called and its result passed through verbatim (AC-23-001.2/.3/.4), including a live reader's own
  fail-loud `git-unavailable` result (never collapsed to a fabricated `ok: true`).
- Full existing suites re-verified green with the new wiring: `src/lib/achievements/**` and
  `src/app/achievements/**` (34 files / 401 tests), incl. `informeData.test.ts`, `Informe.test.tsx`,
  and the FRD-10 gate/reviewer tests — no behavior change, no visual change.

**Self-test (green):** `pnpm biome check` on the touched files (clean) · `pnpm tsc --noEmit`
(clean) · `pnpm vitest run src/lib/achievements src/app/achievements` (34 files, 401 tests
passed).
