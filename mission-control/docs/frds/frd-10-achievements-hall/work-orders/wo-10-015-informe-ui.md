---
id: WO-10-015
type: work-order
slug: informe-ui
title: 'WO-10-015 — Informe operativo UI: 6 bands + 8-row ledger + records 2×3 (sober register)'
status: ACTIVE
parent: FRD-10
implementation_status: VERIFIED
reopen_count: 0
source_requirements: [REQ-10-020, REQ-10-021, REQ-10-022, REQ-10-023, REQ-10-024, REQ-10-025, REQ-10-026, REQ-10-027]
artifacts: [src/app/achievements/Informe/**, src/app/achievements/StatsPanel.tsx, src/app/achievements/_components/HallTabs.tsx, src/app/achievements/_tests/**]
difficulty: high
dependsOn: [WO-10-014]
last_updated: '2026-06-29'
---
# WO-10-015 — Informe operativo: the report UI

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. The Informe sub-feature +
honesty contract live in [`frd.md`](../frd.md) (REQ-10-020..027); the component map in the
[blueprint §4 `CMP-10-informe`](../blueprint.md). **Approved visual anchor (source of truth for the
look):** [`docs/design/prototype/informe-del-gremio.html`](../../../design/prototype/informe-del-gremio.html)
— the sober six-band Informe view. Owner sign-off 2026-06-29.

## Goal
Turn the Estadísticas tab into the owner-approved **sober operator report**, rendering the WO-10-014
aggregates as six bands plus the expanded ledger and records grid. **Additive:** the existing radar,
record tiles and per-category ledger stay; the report sits **above** them. **No data here** — the UI
consumes the typed readers from WO-10-014 (the page already reads `eventsSnapshot`/`ideas`/`statuses`;
add the git-backed reader calls in the Server Component `page.tsx` / Estadísticas tab, not in the client
shell). Every figure with no wired source renders **"—" with a "no cableado" label** (honesty contract).

## In Scope
- **`app/achievements/Informe/**`** (`CMP-10-informe`, new route-local component): the six bands matching
  the prototype section headers and copy:
  1. **El pulso de la fábrica** — the one-sentence verdict (`factoryVerdict`) + a KPI row: WO verified/
     week + delta, active projects (WIP), idea→launched conversion, and **idea→release lead time rendered
     "no cableado"** (REQ-10-020).
  2. **En el tiempo, de verdad** (sub: "¿Cómo voy semana a semana?") — WO-verified-per-week +
     ideas-captured-per-week series (`weeklyFlow`); REPLACES the old raw-event-count view (REQ-10-021).
  3. **Cómo usas la fábrica** (sub: "¿En qué me apoyo y a qué coste?") — most-used workflows + effort
     mix (`usageMix`) (REQ-10-022).
  4. **Embudo y flujo** (sub: "¿Dónde se atascan las ideas y los proyectos?") — ideas→launched funnel +
     per-project phase transitions with the **reopen flag** (text+icon) (`funnelAndFlow`,
     `phaseTransitions`) (REQ-10-023).
  5. **Estado y salud del proceso** (sub: "¿Qué proyectos hay y qué señales vigilar?") — 2 columns:
     projects-by-phase + process signals (lessons 2/131, build relaunches, discards-without-reason,
     quality telemetry "no cableado") (REQ-10-024).
  6. **Qué mover ahora** (sub: "La conclusión, con su comando") — next-actions each with its command
     (`nextActions`) (REQ-10-025).
- **Ledger expansion** in `StatsPanel.tsx`: **8 rows per column** so the three columns align.
  **Producción** += FRDs completed (21), Commits (823), Projects created (2); **Calidad** += Tests
  passing (7134), Decisions/DR (99). Wire each to its `reportScalars` value; unwired → "—"/"no cableado".
  (REQ-10-026)
- **Records grid** in `StatsPanel.tsx`: from 3 tiles to a **2×3 grid (6 records)** — add Peak week (78),
  Lessons captured (131), Subagents coordinated (`signals.subagents`). (REQ-10-027)
- Wire the new readers into the Estadísticas tab's Server-Component path (pass their output into
  `StatsPanel`/`Informe` as props, like the existing `readerData` flow — no I/O in the client shell).

## Out of Scope
- The data layer / aggregates / verdict + next-action rules — **WO-10-014** (this WO only renders them).
- Any change to the visual language/tokens or the other tabs' look (DR-062 — reuse sibling styles).
- The radar, record-tile and ledger **derivations** beyond adding rows/records to the existing structures.
- Wiring lead-time or quality-telemetry sources (they render "no cableado").

## Acceptance criteria (EARS)
- **AC-10-015.1** — THE pulse band SHALL render the verdict sentence + the KPI row (WO/week+delta, WIP,
  conversion), AND render **idea→release lead time as "—" with a visible "no cableado" label** (not a
  zero). (REQ-10-020)
- **AC-10-015.2** — THE time-series band SHALL render the WO-verified-per-week + ideas-per-week series
  from `weeklyFlow`, and the Informe SHALL NOT render the old raw-event-count view. (REQ-10-021)
- **AC-10-015.3** — THE usage band SHALL render the top workflows + effort mix; IF the event stream is
  absent/unreadable THEN it SHALL render its "no cableado"/error state (fail-loud), not an empty band.
  (REQ-10-022)
- **AC-10-015.4** — THE funnel & flow band SHALL render the ideas→launched funnel and the per-project
  phase transitions WITH the project name, AND a **backward (reopen) transition SHALL be flagged by text
  + icon (never color alone)**, WCAG 1.4.1. (REQ-10-023)
- **AC-10-015.5** — THE health band SHALL render projects-by-phase (left) + process signals (right) incl.
  lessons 2/131 and **quality telemetry as "no cableado"** (not a zero). (REQ-10-024)
- **AC-10-015.6** — THE next-actions band SHALL render each action with its command string (e.g.
  `/pandacorp:memory`). (REQ-10-025)
- **AC-10-015.7** — THE ledger SHALL show **exactly 8 rows in each of the 3 columns** (aligned, no
  staircase) with the new rows wired to real values (or "no cableado"); THE records block SHALL be a
  **2×3 grid of 6 records**. (REQ-10-026, REQ-10-027)
- **AC-10-015.8** (DR-062 sober register) — The Informe SHALL be **visually consistent** with the existing
  Hall (same tokens/type scale/card + section-header style) and carry **no RPG lore/levels/glow** — calm
  and legible; Spanish labels + aria; tokens only, zero hardcoded visuals.
- **AC-10-015.9** (Preview Smoke Gate, DR-055) — `/achievements` → Estadísticas SHALL render all six bands
  + ledger + records with the real factory data, no console error / blank / error boundary.

## Edge cases / error states (each maps to an AC)
- Any unwired figure (lead time, tests-passing if absent, quality telemetry, an absent lessons source) →
  **"—" with "no cableado"** label — AC-10-015.1 / .5 / .7. (Bidirectional: each "no cableado" path above
  is also an explicit edge here.)
- Event stream absent/unreadable → usage band error state, AC-10-015.3 (not an empty band).
- Git unavailable at read time → the git-backed bands (time-series, transitions) render "no cableado"
  rather than a fabricated/empty series (data layer surfaces the absent state; UI must honor it).
- A week with fewer verified WOs than the previous → rendered as-is (the series is NOT only-grow).
- Empty / day-zero factory → bands render honest empty/low states, never fabricated bars (AC-10-015.8).

## Data model
None new — consumes the WO-10-014 shapes (`WeeklyFlow`, `PhaseTransition[]`, `ReportScalars`, `UsageMix`,
`FunnelFlow`, `LessonCounts`) + the existing `Stat[]`/`signals`.

## Worked example (trickiest criteria)
- **Reopen flag (AC-10-015.4):** the mission-control transition `2026-06-19 release→implementation` has
  `isReopen=true` (release precedes implementation in the order). The row renders e.g.
  `⟲ Reapertura · release → implementation · 19 jun` — the ⟲ icon **and** the word "Reapertura", so the
  meaning survives without color (WCAG 1.4.1). The forward transitions render without the flag.
- **8-row alignment (AC-10-015.7):** Producción = shipped, workorders, phases, builds, subagents, **FRDs
  (21), Commits (823), Projects (2)** = 8; Calidad = flawless, gates, reviews, findings, prds, adrs,
  **Tests (7134), DR (99)** = 8; Ritmo & alcance already supplies ≥8 (trim/select to 8). The three
  columns end at the same row → no staircase.

## TDD plan
RED: component tests (query by role/text) — verdict sentence present; KPI row incl. the "no cableado"
lead-time; the two series render; usage + effort render; funnel + transitions render with a reopen row
carrying the icon **and** the word; health 2 columns incl. "no cableado" quality telemetry; next-actions
carry commands; ledger = 8 rows × 3 columns; records = 6 tiles. Browser smoke on `/achievements`
Estadísticas. GREEN: implement `Informe/**` + extend `StatsPanel` ledger/records; wire readers in the
Server Component.

## Definition of done
`pnpm vitest run app/achievements` green incl. new + existing; tsc + biome clean; no `any`; tokens-only;
Preview Smoke Gate green on `/achievements`; `.pandacorp/verify.sh` passes.

## Status Note
**Built (WO-10-015 — the Informe operativo UI).** The Estadísticas tab is now the sober six-band
operator report, additive ABOVE the existing radar/records/ledger (which stay). Full `.pandacorp/verify.sh`
green (exit 0): whole unit suite 369 files / 7242 tests, `tsc --noEmit` 0, biome clean, knip clean, madge
no cycles, smoke + visual (incl. the blessed `/achievements` baseline — **unchanged**, see below) + shell +
responsive e2e all green.

**What it built (route-local, under `src/app/achievements/Informe/`):**
- `Informe.tsx` — `CMP-10-informe`, pure Server Component. Exports `<Informe>` (whole report, used by tests),
  `<InformePulse>` (band 1 alone) and `<InformeBands>` (bands 2-6) so the Estadísticas tab interleaves
  pulse → StatsPanel (radar/records/ledger) → bands 2-6 exactly like the approved prototype. Six bands:
  pulse (verdict + 4 KPIs incl. lead-time "—"/"no cableado"), time-series (two bar charts), usage
  (workflows + effort bars), funnel+transitions (reopen row flagged by a `ti-rotate-2` icon WITH the word
  "Reapertura", WCAG 1.4.1), health (projects-by-phase + 4 process signals incl. quality telemetry "no
  cableado"), next-actions (each with its command pill).
- `informeData.ts` — `buildInformeData(inputs): InformeData` (PURE assembly over the WO-10-014 readers) +
  the `InformeData`/`InformePulse`/`InformeSignals`/`ProjectPhase`/`InformeInputs` shapes. Carries every
  unwired figure as `null` (`leadTime`, `qualityTelemetry`, `lessons` when absent) — never a fabricated zero.
- `StatsPanel.tsx` (extended, backward-compatible): two NEW **optional** props `scalars?: ReportScalars` and
  `records?: StatsRecords` (`{peakWeek, capturedLessons, subagents}`). When given → the ledger expands to
  **exactly 8 rows × 3 columns** (Producción += FRDs/Commits/Proyectos via new `StaticLedgerRow`; Calidad +=
  Tests/DR; `null` testsPassing → "no cableado") with `data-testid="stat-ledger-column"`, and the records
  grid becomes a **2×3 grid of 6 tiles**. When absent → the legacy WO-10-005 3-tile / metric-only ledger
  (so the existing reviewer suite + WO-10-005 callers keep passing unchanged).
- `HallTabs.tsx` — new `EstadisticasTab` body composing the interleaved layout; three NEW **optional** props
  `informeData?`/`statsScalars?`/`statsRecords?` (optional so the DR-062 tab-primitive reviewer gate that
  mounts a bare HallTabs still renders — it degrades to the plain StatsPanel when `informeData` is absent).
- `page.tsx` — wires the readers in the Server Component: `weeklyFlow(cwd)`, `phaseTransitions()`,
  `reportScalars(cwd)`, `funnelAndFlow(ideas, statuses)`, `usageMix(readerData)`, `lessonCounts()`,
  `signalsFor(readerData)` → `buildInformeData(...)`, passed as props into `HallTabs`.

**Tests covering it:** `src/app/achievements/Informe/_tests/Informe.test.tsx` (17 — the six bands + every
"no cableado"/fail-loud path + reopen icon+word + sober-register no-RPG-lore), `…/_tests/informeData.test.ts`
(7 — pure assembly + null honesty), `src/app/achievements/_tests/wo-10-015-stats-panel-expansion.test.tsx`
(5 — 8×3 ledger, 2×3 records, wired scalars, testsPassing null).

**Decisions & assumptions the consumer/reviewer inherits:**
- **Project path = `process.cwd()`** for the git-backed readers (MC's own repo; it shares the factory `.git`
  one level up — the readers handle the `--show-prefix` quirk internally, see WO-10-014).
- **Fail-loud usage band (AC-10-015.3):** `usageMix` returns a plain `UsageMix`, so the PAGE wraps it in the
  discriminated `{ok}` shape — `ok:false` ("no cableado" error band) when the event snapshot is empty AND
  `lastEventAt === null` (an absent/unreadable stream), else `ok:true`. The git-backed series
  (`weeklyFlow`/`phaseTransitions`) already carry their own `ReportResult`; the UI branches on `.ok` and
  renders the error band on `false` (an empty `value` is a real zero, not absence).
- **Records mapping:** `peakWeek` from `weeklyFlow.value.peakWeek` (0 when absent), `capturedLessons` from
  `lessonCounts()?.captured ?? 0`, `subagents` from `signalsFor(readerData).subagents`.
- **8-row alignment:** Producción = 5 metric keys + 3 scalars; Calidad = 6 keys + 2 scalars; Ritmo & alcance
  = 8 keys (no scalars) — all three end at 8, no staircase.
- **Reopen flag:** rendered as a `ti-rotate-2` icon (`role="img"` + `aria-label="Reapertura"`) AND a visible
  "Reapertura" badge — the meaning survives without color (WCAG 1.4.1). Forward transitions render plain.
- **Spanish month abbreviations** for transition dates (`19 jun`), `font-mono` project names, `font-pixel`
  numerals — matching the prototype; tokens only (inline `var(--…)`, the established surface pattern).
- **Knip/scope:** to green the whole-project gate (anticipated by WO-10-014's note), three now-internal types
  lost their `export` keyword — `ReportAbsenceReason` (report/types.ts), `ActionCommand` (verdict.ts),
  `PhaseObservation` (phaseTransitions.ts) — each only referenced inside its own module; behavior unchanged.
- **Blessed `/achievements` visual baseline is UNCHANGED** (not re-blessed): the visual gate screenshots the
  DEFAULT (Resumen) tab; all WO-10-015 changes live in the hidden Estadísticas panel, so the baseline still
  matches. In-loop fidelity check done (DR-072): rendered the Estadísticas tab, screenshotted it, confirmed a
  faithful match to `prototype/informe-del-gremio.html` (right layout/structure/components/density).
- **NOT mine in `git status`:** `src/components/modules/ProjectRail/ProjectRail.tsx` and `.pandacorp/status.yaml`
  carry another session's WIP (DR-099) — left untouched.
