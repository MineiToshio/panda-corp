---
id: WO-23-001
type: work-order
slug: portada-reader-seal
title: 'WO-23-001 — Portada reader + freshness seal + fail-loud fixtures'
status: ACTIVE
parent: FRD-23
implementation_status: VERIFIED
reopen_count: 0
source_requirements: [REQ-23-001]
artifacts:
  - 'src/lib/achievements/read-model/statsSchema.ts'
  - 'src/lib/achievements/read-model/seal.ts'
  - 'src/lib/achievements/read-model/statsReader.ts'
  - 'src/lib/achievements/read-model/_tests/statsSchema.test.ts'
  - 'src/lib/achievements/read-model/_tests/statsReader.test.ts'
  - 'src/lib/achievements/read-model/_tests/seal.test.ts'
  - 'src/lib/achievements/read-model/_tests/fixtures.ts'
difficulty: high
dependsOn: []
last_updated: '2026-10-22'
---
# WO-23-001 — Portada reader + freshness seal

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Contract in
[`frd.md`](../frd.md) (REQ-23-001); design in [`blueprint.md`](../blueprint.md) §3–§5.

## Goal
The **fail-loud** (DR-078), read-only reader of the materialized portada + its self-validating seal.
No writing here.

## In scope
- `src/lib/achievements/read-model/seal.ts` — `currentSeal(projectPath): string` =
  `git log -1 --format=%H -- docs/frds .pandacorp/status.yaml`; `isFresh(portada, seal): boolean`.
- `src/lib/achievements/read-model/statsReader.ts` — `readStatsPortada(projectPath): PortadaResult`
  (Zod-parsed; discriminated `{ok:true;value} | {ok:false; reason:"missing"|"stale"|"unparseable"}`),
  `readStatsAggregate(): AggregateResult`.
- The `StatsPortada` / `StatsAggregate` Zod schema + `z.infer` types, reusing `report/types.ts`.

## Acceptance criteria (EARS)
- **AC-23-001.1** — WHEN a project's `.pandacorp/stats.json` is present, well-formed and its seal
  **matches** the current git seal, Mission Control SHALL read the **sealed** Informe numbers (the WO-verified
  series and the FRD count) from the portada and NOT shell out to the `docs/frds` git history for that project.
- **AC-23-001.2** — WHEN the portada is **missing**, Mission Control SHALL fall back to the live git
  reader for that project (current behavior), never a fabricated zero.
- **AC-23-001.3** — WHEN the portada exists but its **seal mismatches** the current git seal (stale),
  Mission Control SHALL treat it as stale and fall back to the live git reader for that project.
- **AC-23-001.4** — WHEN the portada is **present but unparseable/corrupt** (malformed JSON or an
  unrecognised shape), the reader SHALL **fail loud** (throw / explicit error variant) and the caller
  SHALL fall back to the live git reader — never a silent `[]`/`null` treated as "no activity" (DR-078).

(The reader-level result shapes it delivers: present and fresh gives `{ok:true; value}`; missing gives `reason:"missing"`; a seal mismatch gives `reason:"stale"`; corrupt or unrecognised gives `reason:"unparseable"`, never a silent `[]` or `null`. AC-23-001.5, the seal-coverage rule added 2026-09-30, is owned by WO-23-006 and proven by `informeResolver.sealCoverage.test.ts`.)

## TDD plan
RED: fixtures — a **real production-shape** `stats.json`, a **malformed** one (bad JSON + wrong shape),
a **stale** one (seal mismatch), and a **missing** path; assert each result. GREEN: implement.
Refactor; `React.cache` the seal read.

## Definition of done
`pnpm vitest run lib/achievements/read-model` green; tsc + biome clean; no `any`; `.pandacorp/verify.sh` passes.

## Status Note

**Built (IN_REVIEW).** The fail-loud (DR-078), read-only portada reader + its self-validating
freshness seal + the portada/aggregate schema parser. No writing (the writer is WO-23-002).

### Files
- `src/lib/achievements/read-model/statsSchema.ts` — the `StatsPortada` / `StatsAggregate` types
  (reusing `report/types.ts` shapes **verbatim**, DR-092 — not redefined) + hand-written fail-loud
  parsers `parseStatsPortada(value: unknown): StatsPortada | null` and
  `parseStatsAggregate(value: unknown): StatsAggregate | null`.
- `src/lib/achievements/read-model/seal.ts` — `currentSeal(projectPath: string): string | null`
  (`React.cache`-deduped) and `isFresh(portada: StatsPortada, seal: string | null): boolean`.
- `src/lib/achievements/read-model/statsReader.ts` — `readStatsPortada(projectPath: string): PortadaResult`
  and `readStatsAggregate(aggregatePath: string): AggregateResult`.

### Interfaces / contracts exposed (signatures)
```ts
type StatsPortada = { seal; generatedAt; weeklyFlow; phaseTransitions; scalars; lessons: LessonCounts|null; funnel }
type StatsAggregate = { projects: Record<string, StatsPortada> }
type PortadaResult   = { ok: true; value: StatsPortada } | { ok: false; reason: "missing" | "stale" | "unparseable" }
type AggregateResult = { ok: true; value: StatsAggregate } | { ok: false; reason: "missing" | "unparseable" }

parseStatsPortada(value: unknown): StatsPortada | null
parseStatsAggregate(value: unknown): StatsAggregate | null
currentSeal(projectPath: string): string | null      // git log -1 --format=%H -- docs/frds .pandacorp/status.yaml
isFresh(portada: StatsPortada, seal: string | null): boolean
readStatsPortada(projectPath: string): PortadaResult   // reads <projectPath>/.pandacorp/stats.json
readStatsAggregate(aggregatePath: string): AggregateResult
```

### Integration seams (for the Informe wiring & WO-23-002/003)
- **Informe wiring** (WO-10-014 consumers): call `readStatsPortada(projectPath)`; on `ok: true` use
  `value` (do NOT shell out to git for that project); on ANY non-`ok` result fall back to the existing
  live git readers (`report/*`). All three fail reasons fall back — the distinction is observable, not
  collapsed to a silent empty.
- **WO-23-002 (writer)** must produce JSON that satisfies `parseStatsPortada` and stamp
  `seal = currentSeal(projectPath)` at write time (same command used here for validation).
- **WO-23-003 (aggregate)** must produce `{ projects: Record<path, StatsPortada> }`; per-project seal
  validation is at the point of use via `readStatsPortada`, NOT inside `readStatsAggregate` (a join may
  hold independently-stale entries).

### Decisions & assumptions the consumer inherits
- **No Zod** (blueprint/WO said "Zod-parsed"): the project has no Zod dependency and DR-052 forbids
  mid-build dep churn, so I mirrored the codebase's established hand-written type-guard convention
  (`ideas.ts`). The fail-loud parse contract (DR-078) is fully met — a typed value OR an explicit
  reason, never a silent empty. **Called out as a deliberate deviation from the literal wording.**
- **Portada path** = `<projectPath>/.pandacorp/stats.json` (WO/FRD spec).
- **Seal is equality-only**, never ordered (seals are commit hashes, not timestamps — LESSON-0009's
  ordering hazard does not apply). `currentSeal` returns **`null`** when git is unavailable (never a
  fabricated seal); `isFresh(portada, null)` is **`false`**, so an unvalidatable snapshot is treated as
  **stale** → the reader returns `{ ok: false, reason: "stale" }` (fall back to live git). This is an
  intentional choice: never trust a snapshot we cannot validate.
- **`missing` vs `unparseable`**: `ENOENT` on read → `missing`; any OTHER fs error (permissions/I/O)
  is genuinely unexpected and is **re-thrown** (not swallowed — error-handling rule). Malformed JSON
  OR a well-formed JSON of the wrong shape → `unparseable`. Corruption is decided **before** the seal
  is read (a corrupt file never shells out to git).
- **Number validation is strict**: `NaN`/`Infinity` counts are rejected as corrupt (`Number.isFinite`).
- **`lessons: null`** and **`scalars.testsPassing: null`** are accepted as legitimate "no cableado"
  absences, NOT corruption (they mirror the report layer's nullable semantics).
- The `unknown`-phase / missing-idea-status-bucket / string-count cases all fail loud (`null` from the
  parser → `unparseable` from the reader).
- Reused the report layer's `WeeklyFlow`/`PhaseTransition`/`ReportScalars`/`LessonCounts`/`FunnelFlow`/
  `WeeklyBucket` shapes verbatim (DR-092/DR-115) — the materialized portada is type-identical to the
  live derivation, so the equivalence test (WO-23-002 AC-23-002.3) can compare directly.

### Tests (all green, RED-proven)
- `_tests/statsSchema.test.ts` — real-shape accept + fail-loud on every corrupt shape (AC-23-001.4,
  AC-23-003.2).
- `_tests/statsReader.test.ts` — the four EARS branches on real on-disk fixtures with a mocked
  `currentSeal`: present+fresh (AC-23-001.1), missing (AC-23-001.2), stale + git-unavailable
  (AC-23-001.3), malformed JSON + wrong shape + array (AC-23-001.4), aggregate fail-loud.
- `_tests/seal.test.ts` — `isFresh` equality/null; `currentSeal` returns `null` in a non-git dir.
- `_tests/fixtures.ts` — typed `makePortada()` builder (defaults + override).

### Self-test (green)
`pnpm biome check` (7 files, clean) · `pnpm tsc --noEmit` (clean) · `pnpm vitest run
src/lib/achievements/read-model` (3 files, 27 tests passed) · knip (no unused exports) · madge (no cycles).
