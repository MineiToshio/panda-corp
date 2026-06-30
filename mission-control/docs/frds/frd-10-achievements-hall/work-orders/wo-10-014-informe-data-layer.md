---
id: WO-10-014
type: work-order
slug: informe-data-layer
title: 'WO-10-014 — Informe data layer: flow-series + phase-transitions + scalars + usage + funnel + lessons + rules'
status: ACTIVE
parent: FRD-10
implementation_status: IN_REVIEW
source_requirements: [REQ-10-020, REQ-10-021, REQ-10-022, REQ-10-023, REQ-10-024, REQ-10-025, REQ-10-026, REQ-10-027]
artifacts: [src/lib/achievements/report/**, src/lib/achievements/report/_tests/**]
difficulty: high
dependsOn: []
last_updated: '2026-06-29'
---
# WO-10-014 — Informe operativo: the report data layer

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. The Informe sub-feature +
honesty contract live in [`frd.md`](../frd.md) (REQ-10-020..027); the new interfaces + the perf caveat
in the [blueprint §3 v3](../blueprint.md). Visual anchor (consumed by the UI WO, not this one):
[`docs/design/prototype/informe-del-gremio.html`](../../../design/prototype/informe-del-gremio.html).

## Goal
Provide the pure, **fail-loud** (DR-078), **read-only** aggregates the sober operator Informe needs —
everything the v2 `signals` layer does NOT already give, because these read the **committed artifacts'
git history** and the **ideas/usage** sources. The UI WO (WO-10-015) consumes these; this WO ships no
rendering. **Honesty:** every aggregate maps to a verifiable real source; an aggregate with **no wired
source** returns an explicit **absent/`null`** state the UI renders as **"no cableado"** — never a
fabricated zero.

## In Scope
New read modules (under `src/lib/achievements/report/`, split one concern per file, each ≤ the size
limit):

- **`IF-10-flow-series`** — `weeklyFlow()`:
  - **WO-verified-per-week**: from the **git history of each `work-orders/wo-*.md`**, find the commit
    where its `implementation_status` crosses to `VERIFIED`, bucket by **ISO week**. Reuse the
    `build-track.ts` `readGitLog` fail-soft `execSync` pattern; **scope the `git log` to the wo files'
    pathspec and `-n`-cap it** (perf caveat, blueprint §3). Expected real shape: **W25=78, W26=8, W27=5,
    91 total** (all mission-control).
  - **ideas-captured-per-week**: from the `created` frontmatter of `factory/ideas/*.md`, bucket by ISO
    week. Expected real shape: **W24=3, W26=15**. An idea card with no `created` is **excluded** and the
    count of excluded cards is exposed (observable, not silently zeroed).
  - **peak week**: the max WO-verified week count (**78**) for the records grid (REQ-10-027).
- **`IF-10-phase-transitions`** — `phaseTransitions()`: per-project `phase` transition log from the **git
  history of each `.pandacorp/status.yaml`** (`git log -p`/blame-style diff of the `phase:` line, scoped
  pathspec + `-n`-cap), each entry `{ project, date, from, to, isReopen }` where `isReopen` is true when
  `to` precedes `from` in the order `product<design<architecture<implementation<release`. Expected real
  shape for mission-control: **06-16 architecture→implementation, 06-18 implementation→release, 06-19
  release→implementation (isReopen), 06-21 implementation→release**.
- **`IF-10-scalars`** — `reportScalars()`: **FRDs (21)** from `docs/frds/` (reuse `lib/docs`); **Commits
  (823)** from `git rev-list --count HEAD` (git at read time); **Decisions/DR (99)** from the registry
  reader (`lib/registry`); **Projects created (2)** from `readPortfolio`/`readStatus`; **Tests passing
  (7134)** from its real source — wire it cheaply if available, **else return absent** so the UI shows
  "no cableado" (do NOT fabricate).
- **`IF-10-usage`** — `usageMix(readerData)`: **most-used workflows/skills** (top-N descending) + the
  **effort mix** (high/xhigh/max/medium) aggregated from `eventsSnapshot` (already read by the page) —
  **pure, no new fs**. Expected real shape: deep-research 1494 / pandacorp-build 850 / audits-research
  ≈400; high 1384 / xhigh 937 / max 700 / medium 3.
- **`IF-10-funnel`** — `funnelAndFlow(ideas, statuses)`: ideas→launched funnel (**18 → 1, ≈6 %**), WIP
  (active projects: `phase` ∈ {design, architecture, implementation}, **=1**), idea status breakdown
  (**discovered 6, in-pipeline 2, discarded 10**), and **discards-without-structured-reason** (discarded
  cards whose `discard_reason` is empty). Pure over `readIdeas`+`readStatus`, no new I/O.
- **`IF-10-lessons`** — `lessonCounts()`: **distilled (2) / captured (131)** from the memory reader
  (`lib/memory`) + inbox; a missing source → absent (UI: "no cableado").
- **verdict + next-actions** — `factoryVerdict(metrics)` and `nextActions(metrics)`: **pure deterministic
  rule functions** over the aggregates above; `nextActions` returns each action with its **command**
  (`/pandacorp:memory`, `/pandacorp:release`, `/pandacorp:recommend`). Same inputs → same output.

## Out of Scope
- All rendering / the six bands / the ledger + records grid layout — **WO-10-015**.
- Any change to the v2 `signals`/`stats`/catalogue derivation, the radar, or the other tabs.
- Wiring an idea→release **lead-time** timestamp or **quality telemetry** — both stay "no cableado"
  (the readers expose the absent state; wiring the emitters is a separate future WO,
  `docs/achievements.md` §8 pending-emitter).
- Mutating any file (read-only invariant, architecture §1/§7).

## Acceptance criteria (EARS)
- **AC-10-014.1** — `weeklyFlow()` SHALL return WO-verified-per-week from the git crossing-to-`VERIFIED`
  commit of each `wo-*.md`, bucketed by ISO week, matching **W25=78 / W26=8 / W27=5 / 91 total** on the
  real-shape fixture; AND ideas-per-week from `created` frontmatter matching **W24=3 / W26=15**; AND
  expose `peakWeek=78` and the count of `created`-less ideas excluded. (REQ-10-021, REQ-10-027)
- **AC-10-014.2** — `phaseTransitions()` SHALL return per-project `{project,date,from,to,isReopen}` from
  the git history of each `status.yaml`, with `isReopen=true` on a backward transition, matching the
  mission-control real shape (4 transitions incl. the 06-19 reopen). (REQ-10-023)
- **AC-10-014.3** — `reportScalars()` SHALL return the wired counts (FRDs 21, Commits 823, DR 99,
  Projects 2) from their real sources; Tests-passing SHALL be a real count OR an **explicit absent**
  state — never a fabricated number. (REQ-10-026)
- **AC-10-014.4** — `usageMix()` SHALL return the top workflows + effort mix from `eventsSnapshot`
  matching the real shape; `funnelAndFlow()` SHALL return the funnel/WIP/conversion + discards-without-
  reason matching the real shape; both pure (no new I/O). (REQ-10-022, REQ-10-023, REQ-10-024)
- **AC-10-014.5** — `lessonCounts()` SHALL return distilled/captured (**2/131**) or an explicit absent
  state when a source is missing. (REQ-10-024, REQ-10-027)
- **AC-10-014.6** — `factoryVerdict()` and `nextActions()` SHALL be **pure** functions of the wired
  aggregates (same inputs → same output); `nextActions` items SHALL each carry their command. No
  fabricated sentence/suggestion. (REQ-10-020, REQ-10-025)
- **AC-10-014.7** (honesty / fail-loud) — Each git-backed reader SHALL distinguish **"source empty"**
  from **"unparseable / git unavailable"**: on git-unavailable or an unrecognised shape it SHALL return
  an **explicit error/absent** result (so the UI renders an error / "no cableado" band), **never a silent
  `[]` masquerading as zero activity** (DR-078). Each reader SHALL be unit-tested against a **real-shape
  fixture AND a malformed/empty one**; the time-series MUST NOT be constrained only-grow (a week may drop).

## Edge cases / error states (each maps to an AC)
- Git binary/repo unavailable at read time → readers return absent (AC-10-014.7); not a crash, not a zero.
- A `wo-*.md` whose `implementation_status` is still `PLANNED`/`IN_PROGRESS` → contributes **no** week
  (it never crossed to VERIFIED) — not bucketed into "now".
- An idea card with no `created` → excluded from the per-week series, counted in the excluded tally
  (AC-10-014.1).
- A `status.yaml` with no `phase` history yet (never advanced) → zero transitions for that project, not
  an error.
- Tests-passing source absent → absent state, rendered "no cableado" (AC-10-014.3).

## Data model (shapes the UI consumes)
```
WeeklyFlow      = { woVerified: { isoWeek: string; count: number }[]; ideasCaptured: { isoWeek: string; count: number }[]; peakWeek: number; ideasWithoutCreated: number }
PhaseTransition = { project: string; date: string; from: Phase; to: Phase; isReopen: boolean }
ReportScalars   = { frds: number; commits: number; decisions: number; projects: number; testsPassing: number | null }   // null → "no cableado"
UsageMix        = { workflows: { name: string; count: number }[]; effort: { level: "high"|"xhigh"|"max"|"medium"; count: number }[] }
FunnelFlow      = { totalIdeas: number; byStatus: Record<IdeaStatus, number>; launched: number; conversionPct: number; wip: number; discardsWithoutReason: number }
LessonCounts    = { distilled: number; captured: number } | null   // null → "no cableado"
```
Each git-backed reader returns its typed value OR a discriminated error variant (parse-don't-validate,
DR-078) — never a bare `[]`/`null` that the UI can't distinguish from "no activity".

## TDD plan
RED: real-shape fixtures (git-log output stubs for the wo/status pathspecs; `factory/ideas` `created`
frontmatter; an `eventsSnapshot` builder) asserting each expected number above; a malformed/empty fixture
per git-backed reader asserting the explicit error/absent path; purity of verdict/next-actions. GREEN:
implement, reusing `build-track.ts`'s `readGitLog` shape + `lib/docs`/`lib/registry`/`lib/memory`
readers (DR-092 single-source — do not re-implement). Refactor; per-request cache (`React.cache`) on the
git readers; files ≤500 lines.

## Definition of done
`pnpm vitest run lib/achievements` green incl. new + existing; tsc + biome clean; pure derivation, no new
writes; no `any`; `.pandacorp/verify.sh` passes.

## Status Note
**Built (WO-10-014 — the Informe data layer).** Seven read modules under
`src/lib/achievements/report/` (one concern per file, all ≤ size limit), each fail-loud (DR-078) and
read-only. Covered by `src/lib/achievements/report/_tests/*.test.ts` (31 tests) + the events-reader
extension test in `src/lib/events/_tests/events.achievements.test.ts`. Self-test green: report+events
vitest (161), `tsc --noEmit` 0, biome clean, madge no cycles.

**Interfaces exposed (what WO-10-015 consumes — signatures + shapes in `report/types.ts`):**
- `weeklyFlow(projectPath: string): ReportResult<WeeklyFlow>` (`flowSeries.ts`, React-`cache`d) — WO-verified
  per ISO week (from the git crossing-to-`VERIFIED` commit of each `wo-*.md`) + ideas-per-week (from the
  `created` frontmatter) + `peakWeek` + `ideasWithoutCreated`. Also exports the **pure** `deriveWeeklyFlow(input | null)`
  and `isoWeekKey(d)`. Live shape confirmed: peak=78, 3 wo-weeks, 0 excluded.
- `phaseTransitions(): ReportResult<PhaseTransition[]>` (`phaseTransitions.ts`, React-`cache`d) — per-project
  `{project,date,from,to,isReopen}` from each `.pandacorp/status.yaml` git history; pure core
  `derivePhaseTransitions(history | null)`. Live shape confirmed: the 4 expected mission-control transitions
  incl. the 06-19 reopen (plus the real in-flight 06-29 reopen — honest, not fabricated).
- `reportScalars(projectPath: string): ReportScalars` (`scalars.ts`, React-`cache`d) — `{frds, commits, decisions,
  projects, testsPassing}`; pure core `deriveScalars(sources)`. **`testsPassing` is `null` ("no cableado")** — no
  cheap real source today (pending-emitter, `docs/achievements.md §8`); never fabricated. Live: frds 21, commits
  827, decisions 98, projects 2, testsPassing null.
- `usageMix(data: ReaderData): UsageMix` (`usage.ts`, **pure, no new fs**) — top workflows (descending) + effort
  mix (descending), from the already-read `eventsSnapshot`.
- `funnelAndFlow(ideas, statuses): FunnelFlow` (`funnel.ts`, **pure**) — totalIdeas, byStatus (every bucket present),
  launched, conversionPct, wip (design/architecture/implementation), discardsWithoutReason.
- `lessonCounts(): LessonCounts | null` (`lessons.ts`) — `{distilled, captured}` or `null` ("no cableado") when the
  memory dir is absent; pure core `deriveLessonCounts(sources)`. Live: distilled 1, captured 101.
- `factoryVerdict(m: ReportMetrics): string` + `nextActions(m: ReportMetrics): NextAction[]` (`verdict.ts`) — pure
  deterministic rules; each action carries its `command` (`/pandacorp:memory|/pandacorp:release|/pandacorp:recommend`).

**Decisions & assumptions the consumer inherits:**
- **Fail-loud contract:** the three git-backed readers return a discriminated `ReportResult<T> = {ok:true; value} |
  {ok:false; reason:"git-unavailable"|"unparseable"}` (NOT a bare `[]`/`null`). The UI MUST branch on `.ok` and render
  an error / "no cableado" band on `false` — an empty `value` (e.g. `woVerified: []`) is a **real zero**, not absence.
  `reportScalars.testsPassing` and `lessonCounts()` use `null` for "no cableado".
- **ISO week key** is `"YYYY-WW"` Monday-based, identical to `signals.ts`/`stats.ts` (one bucketing convention,
  DR-092) — exported as `isoWeekKey`; reuse it, don't re-derive.
- **Phase order** for the reopen flag: `product<design<architecture<implementation<release`; `isReopen` = `to` ranks
  below `from`.
- **WIP** = phase ∈ {design, architecture, implementation}; **launched** = phase=release; **conversionPct** =
  `round(launched/totalIdeas*100)`, 0 when no ideas.
- **`distilled`** = `factory/memory/LESSON-*.md` count (via `readLessons`); **`captured`** = `_inbox.md` non-empty lines.
  A present-but-empty memory dir → real `{0,0}`, not `null`.
- **Workflow names** were not on `Event` — `events.ts` was extended (additive, backward-compatible, same nested-`data`
  pattern as WO-10-009) with `Event.workflows?: string[]` read from `data.background_tasks[].name`. `usageMix` reads that.
  Malformed `background_tasks` drops the field (never throws).
- **Mission-Control-in-factory git quirk:** `git show <sha>:<path>` resolves against the repo root, but MC shares the
  factory `.git` (its status.yaml is `mission-control/.pandacorp/status.yaml`). The phase reader prepends
  `git rev-parse --show-prefix` so the blob read resolves — handled inside the reader; consumers need not care.
- Per-request caching (`React.cache`) wraps the git readers (`weeklyFlow`/`phaseTransitions`/`reportScalars`) so a tab
  render runs git once, not per row; the **pure** `derive*` cores are unwrapped and unit-tested directly.
- **Files & scope:** `report/{types,flowSeries,phaseTransitions,scalars,usage,funnel,lessons,verdict}.ts` + their
  `_tests/`; plus the additive `Event.workflows` field in `src/lib/events/events.ts`. No rendering (WO-10-015 owns the
  six bands). No mutation (read-only invariant). The report public entrypoints are currently unused exports — that is
  expected (their consumer WO-10-015 `dependsOn: [WO-10-014]` is built next); whole-project `knip` greens once it wires
  them.
