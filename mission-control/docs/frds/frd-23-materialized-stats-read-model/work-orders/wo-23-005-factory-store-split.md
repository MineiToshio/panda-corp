---
id: WO-23-005
type: work-order
slug: factory-store-split
title: 'WO-23-005 — Factory-scoped store + seal (writer/reader) and prune the per-project portada'
status: ACTIVE
parent: FRD-23
implementation_status: VERIFIED
reopen_count: 0
source_requirements: [REQ-23-006]
artifacts: [src/lib/achievements/read-model/**, src/lib/achievements/read-model/_tests/**]
difficulty: high
dependsOn: [WO-23-001, WO-23-002]
last_updated: '2026-07-06'
---
# WO-23-005 — Factory-scoped store + seal, prune per-project portada

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Contract in
[`frd.md`](../frd.md) (REQ-23-006, §"Portada scope-split"); design in [`blueprint.md`](../blueprint.md)
§3b–§5. Decision: [`ADR-0004`](../../../adr/ADR-0004-materialized-stats-read-model.md) §"SSOT correction".

## Goal
Close the DR-115 SSOT defect the FRD-23 gate surfaced: move the **factory-wide** facts out of the
per-project portada into **one** factory-scoped store `<factory-root>/.pandacorp/stats-factory.json` with
its **own factory-wide seal**, and prune the per-project portada to per-project facts only. Fail-loud
(DR-078), single writer (DR-115), atomic write.

## In scope
- `src/lib/achievements/read-model/factorySeal.ts` — `currentFactorySeal(factoryRoot): string | null` =
  the hash of the last commit touching `factory/portfolio.md`, `factory/decisions/`, `factory/memory/` and
  every project's `.pandacorp/status.yaml` (one `git log -1 --format=%H -- <paths>`); `isFactoryFresh(store, seal)`
  — equality only (LESSON-0009: commit hashes, not timestamps → no ordering).
- `src/lib/achievements/read-model/factoryStoreReader.ts` — `readStatsFactory(factoryRoot): FactoryResult`
  (`{ok:true;value:StatsFactory} | {ok:false; reason:"missing"|"stale"|"unparseable"}`), same fail-loud
  convention as `readStatsPortada`.
- `src/lib/achievements/read-model/factoryStoreWriter.ts` (factory tooling) — `writeStatsFactory(factoryRoot)`:
  re-derive `phaseTransitions`/`scalars.projects`/`scalars.decisions`/`lessons` via the existing pure
  `derive*` cores (DR-092 — do not re-implement), stamp the factory seal, write **atomically** (tmp+rename).
  Single writer (DR-115).
- Split `ReportScalars` → `ProjectScalars` (`frds`, `commits`) held per-project + `FactoryScalars`
  (`projects`, `decisions`) held factory-wide; update the `StatsPortada` schema/parser and `writeStatsPortada`
  to drop `phaseTransitions`/`scalars.projects`/`scalars.decisions`/`lessons`. **Remove** those fields from
  the per-project reader types/mappings (retire the stale copy by construction, DR-115) — not just stop writing them.
- Extend the `StatsFactory` schema + `z.infer`/type-guard parser reusing `report/types.ts` verbatim (DR-092).

## Acceptance criteria (EARS)
- **AC-23-006.1** — factory-wide facts stored ONCE in `stats-factory.json`, single writer, re-derived (no `+1/-1`).
- **AC-23-006.2** — factory seal covers `portfolio.md` + `decisions/` + `memory/` + every project's
  `status.yaml`; a phase change in ANY project mismatches the seal → store treated stale.
- **AC-23-006.3** — atomic write; `readStatsFactory` fail-loud (missing/stale/unparseable), never silent empty.
- **AC-23-006.4** — per-project portada no longer contains factory-wide facts; its seal validates 100% of it.

## TDD plan
RED: fixtures — a real-shape `stats-factory.json`, a malformed one, a stale one (seal mismatch), a missing
path; assert each `FactoryResult`. A **cross-project staleness** fixture: two projects' `status.yaml`, mutate
B → `currentFactorySeal` changes → store stale (seeds AC-23-007.3 in WO-23-006). Equivalence: factory store
numbers == live `derive*`. Portada parser rejects the OLD shape's removed fields as "shape it no longer owns"
(kept as per-project only). GREEN: implement. Refactor; `React.cache` the factory seal read.

## Definition of done
`pnpm vitest run lib/achievements/read-model` green; tsc + biome clean; no `any`; knip (no dead exports —
the removed portada fields fully retired); madge (no cycles); `.pandacorp/verify.sh` passes.

## Status Note

**Status: BLOCKED (`gate-test-defective`) — implementation complete & green in isolation; the ONLY
remaining gate red is ONE SUPERSEDED blessed reviewer test I may not edit (DR-080).** Routes to
gate-test repair (BL-0001), NOT a rebuild: the production code is correct — reverting it would destroy
correct work. Repair pass (2026-07-06) additionally fixed two REAL gate defects this WO introduced that
the first diagnosis missed (they RED the whole-project gate independently of the reviewer test):
- `factoryStoreWriter.test.ts` imported `gatherFactoryValues` unused → biome `noUnusedImports` warning,
  and `biome check . --error-on-warnings` treats every warning as a hard gate. Removed the import.
- `gatherFactoryValues` (writer) and `factoryStorePath` (reader) were `export`ed but used only inside
  their own module → knip "unused exports" (exit 1, fail-closed). Made both module-private (no
  speculative exported surface; WO-23-006 will export what its composed reader actually consumes —
  `readStatsFactory`, not these). tsc/biome/knip/madge now ALL green; read-model suite 105/106, the sole
  red being the reviewer test below.

### Built (all green in isolation: tsc clean, biome clean, 231/232 `lib/achievements` + 243/243 `app/achievements`)
- **Factory-scoped store (SSOT split, REQ-23-006).** New `stats-factory.json` under the FACTORY root,
  single writer, re-derived from git via the existing `derive*`/report cores (DR-092), atomic tmp+rename,
  fail-loud reader (DR-078). Factory-wide facts (`phaseTransitions`, `scalars.{projects,decisions}`,
  `lessons`) now live here, not in each per-project portada.
- **Pruned the per-project portada (REQ-23-006.4).** `StatsPortada` now holds ONLY `weeklyFlow`, per-project
  `scalars` (`frds`, `commits`) and `funnel`; the removed factory-wide fields are gone from the schema, the
  parser, `buildPortada`/`gatherLiveValues`, and `LiveReportValues` — retired by construction (DR-115), not
  just unwritten.

### Files
- `read-model/factorySeal.ts` — `currentFactorySeal(factoryRoot)`, `isFactoryFresh(store, seal)`.
- `read-model/factoryStoreReader.ts` — `readStatsFactory(factoryRoot): FactoryResult`, `factoryStorePath`.
- `read-model/factoryStoreWriter.ts` — `buildFactoryStore`, `gatherFactoryValues`, `writeFactoryStoreAtomic`,
  `writeStatsFactory`, `FactoryDeriveError`, types `LiveFactoryValues`/`FactoryStamp`.
- `read-model/statsSchema.ts` — added `StatsFactory`, `ProjectScalars`, `FactoryScalars`, `parseStatsFactory`;
  split `parseScalars`→`parseProjectScalars`+`parseFactoryScalars`; pruned `StatsPortada`/`parseStatsPortada`.
- `read-model/statsWriter.ts` — portada writer pruned to per-project facts.
- `read-model/informeResolver.ts` — recomposed so factory-wide facts come from the live cores ALWAYS
  (portada no longer holds them); per-project facts still from a fresh portada. Render shape `InformeSources`
  (FRD-10) unchanged. NOTE: the FULL factory-store recompose (read `readStatsFactory` here) is WO-23-006.

### Interfaces / contracts exposed (signatures)
```ts
// factorySeal.ts
currentFactorySeal(factoryRoot: string): string | null   // git log -1 over portfolio.md + decisions/ + memory/ + every IN-REPO project status.yaml
isFactoryFresh(store: StatsFactory, seal: string | null): boolean   // equality only, null never fresh (LESSON-0009)
// factoryStoreReader.ts
type FactoryResult = { ok: true; value: StatsFactory } | { ok: false; reason: "missing"|"stale"|"unparseable" }
readStatsFactory(factoryRoot: string): FactoryResult      // reads <factoryRoot>/.pandacorp/stats-factory.json
factoryStorePath(factoryRoot: string): string
// factoryStoreWriter.ts
type LiveFactoryValues = { phaseTransitions: ReportResult<PhaseTransition[]>; scalars: FactoryScalars; lessons: LessonCounts|null }
buildFactoryStore(values: LiveFactoryValues, stamp: { seal; generatedAt }): StatsFactory   // pure; throws FactoryDeriveError
gatherFactoryValues(factoryRoot: string): LiveFactoryValues
writeFactoryStoreAtomic(filePath: string, store: StatsFactory): void
writeStatsFactory(factoryRoot: string, now?: () => Date): string    // single writer; throws FactoryDeriveError
// statsSchema.ts
type ProjectScalars = { frds: number; commits: number }
type FactoryScalars = { projects: number; decisions: number }
type StatsFactory = { seal; generatedAt; phaseTransitions: readonly PhaseTransition[]; scalars: FactoryScalars; lessons: LessonCounts|null }
parseStatsFactory(value: unknown): StatsFactory | null
type StatsPortada = { seal; generatedAt; weeklyFlow; scalars: ProjectScalars; funnel }   // pruned
```

### Decisions & assumptions the consumer (WO-23-006) inherits
- **Factory store path** = `<factoryRoot>/.pandacorp/stats-factory.json` (sibling of the aggregate index).
- **Factory seal scope**: `factory/portfolio.md` + `factory/decisions/` + `factory/memory/` + every portfolio
  project's `.pandacorp/status.yaml` **that lives INSIDE the factory git repo** (relative path does not escape
  with `..`). Sibling-repo projects (`../personal-page-v2/`, etc.) are EXCLUDED — their status.yaml is a
  DIFFERENT git repo, unreachable from the factory's `git log` (including their pathspec makes `git log` error →
  a null seal → false-stale). Watching sibling repos needs their own trigger; not this seal. For the real MC
  repo the portfolio's MC cell isn't a resolvable path, so the seal falls back to the base 3 factory routes
  (valid, non-null). The cross-project regression (a phase change in B mismatches the seal) is proven on a
  self-contained two-project fixture git repo (`factorySeal.test.ts`) — it holds for in-factory projects.
- **Fail-loud convention** mirrors `readStatsPortada` verbatim: `missing`/`stale`/`unparseable`; null seal →
  `stale` (never trust an unvalidatable store); ENOENT → `missing`; any other fs error re-thrown.
- **Equivalence by construction**: `gatherFactoryValues` calls the SAME report cores (`phaseTransitions`,
  `reportScalars`, `lessonCounts`); `buildFactoryStore` only unwraps — no re-derivation, no `+1/-1`.
- **`resolveInformeSources` is an INTERMEDIATE**: factory-wide facts come from `live.*` always. WO-23-006 must
  replace those live reads with `readStatsFactory(factoryRoot)` (factory seal), keeping the live cores as the
  fail-loud fallback for the factory-wide scope ONLY (AC-23-007.2), and wire the composed reader into page.tsx.

### BLOCKER (escalated — routes to gate-test repair, cf. BL-0001 precedent)
`read-model/_tests/aggregateChain.reviewer.test.ts` lines 111-137 (blessed at the FRD-23 gate for
WO-23-001..004, commit `1018826d`) asserts that on a FRESH portada `resolveInformeSources` does NOT call the
live `phaseTransitions`/`scalars` readers. REQ-23-006.4 (this WO) DEROGATES that contract: once factory-wide
facts leave the portada, a fresh portada cannot supply them, so they MUST come from the factory store / live.
The reviewer test encodes the pre-split world and is structurally unsatisfiable under the split. I cannot edit
it (DR-080) and will not mark IN_REVIEW with a red gate. The recompose of this exact chain is WO-23-006's scope
(`dependsOn: WO-23-005`), which will re-bless it. **Action needed:** update/re-bless
`aggregateChain.reviewer.test.ts` to the split contract (fresh portada → factory-wide facts from the factory
store, NOT the portada), or move that chain assertion to WO-23-006. Full detail + candidate lesson in
`.pandacorp/comms/progress.md`.

### Tests (this WO's own — all green)
`factorySchema.test.ts`, `factorySeal.test.ts` (incl. the cross-project regression fixture),
`factoryStoreReader.test.ts` (4 fail-loud branches), `factoryStoreWriter.test.ts` (pure assembly + atomic +
fail-loud + equivalence). Updated: `fixtures.ts` (pruned `makePortada` + new `makeFactoryStore`),
`statsSchema.test.ts`, `statsWriter.test.ts`, `informeResolver.test.ts` (SSOT-split assertions).
