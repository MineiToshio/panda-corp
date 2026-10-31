---
id: WO-10-017
type: work-order
slug: logros-estadisticas-orbita
title: 'WO-10-017 — Logros · Estadísticas (Informe) Órbita'
status: ACTIVE
parent: FRD-10
foundation: false
implementation_status: VERIFIED
difficulty: medium
reopen_count: 0
artifacts:
  - 'src/app/achievements/Informe/**'
  - 'src/app/achievements/StatsPanel.tsx'
  - 'src/app/achievements/_components/Stats/**'
  - 'src/lib/achievements/report/**'
  - 'src/lib/events/events.ts'
  - 'src/lib/events/eventSourceHealth.ts'
  - 'src/lib/events/_tests/eventSourceHealth.test.ts'
  - 'src/app/achievements/_tests/stats*.test.tsx'
  - 'src/app/achievements/_tests/wo-10-015-stats-panel-expansion.test.tsx'
  - 'e2e/achievements-statistics.spec.ts'
source_requirements: [REQ-10-020, REQ-10-021, REQ-10-022, REQ-10-023, REQ-10-024, REQ-10-025, REQ-10-026, REQ-10-027, REQ-10-028]
dependsOn: [WO-10-016, WO-10-014, WO-01-011, WO-18-002]
last_updated: '2026-10-31'
---

# WO-10-017 Logros · Estadísticas (Informe) Órbita

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Blueprint: [`blueprint.md`](../blueprint.md) · FRD: [`frd.md`](../frd.md) · FDD: [`fdd.md`](../fdd.md) · data source: [FRD-23 blueprint](../../frd-23-materialized-stats-read-model/blueprint.md).

## Summary

Rebuilds the Estadísticas tab of Logros as the Órbita operator report, on top of the readers that already exist: the executive band (verdict and four KPIs), the character sheet (attributes radar, six records, three 8-row ledgers), the real weekly series as a column chart and a line chart, the honest empty usage bands, the funnel and the per-project phase transitions (10 at a time, reopenings flagged), the process-health band, the single next action with its copy-only command, and the two honesty states kept apart: «sin datos aún» (an event never recorded) versus «no cableado» (a value with no source). It adds the missing fail-loud detection of an unreadable usage stream so the coral notice can be drawn, and it replaces the adapter that WO-10-016 left behind. The figures come from the FRD-23 read-model with its fail-loud live fallback, unchanged.

## In Scope

- **Seam rewrite.** `_components/Stats/StatisticsTab.tsx` and `_components/Stats/loadStatisticsData.ts` (created by WO-10-016 as v1 adapters) are rewritten here; `HallTabs.tsx` and `page.tsx` are not touched. `loadStatisticsData()` (server, request-cached) returns one object: the engine inputs for the radar, records and ledgers, the Informe sources composed by the FRD-23 resolver (aggregate index, then portada, then live git, plus the factory store; unchanged contract), the usage mix, the usage-source health, and the counter provenance (below).
- **El pulso de la fábrica (AC-10-020.x).** The one-sentence verdict from the existing pure rule and four `StatKpi` tiles: «Work orders verificadas / semana» (this week, the delta against the previous week with an icon and text), «Proyectos activos», «Conversión» (shipped over total ideas), «Lead time» as the no-value marker next to «no cableado».
- **Character sheet.** `RadarChart` «Atributos del gremio» beside a 2 x 3 grid of `RecordTile`s (Productos lanzados with its `Nv N` chip, Racha récord, Récord idea→launch, Pico semanal, Lecciones, Subagentes); a record whose event was never recorded reads «sin datos aún» and the explanatory line under the grid says it is not a measured zero. Three `LedgerCard`s (Producción, Calidad, Ritmo y alcance), exactly eight rows each; a row is label, optional `Nv N` chip with a band pip (levels keep climbing, never capped at 5) and value.
- **En el tiempo, de verdad (AC-10-021.x).** `ColumnChart` «Work orders verificadas por semana» with the peak sentence and `LineChart` «Ideas capturadas por semana» with its insight; both carry a text alternative naming every week; the idea-cards-without-`created` exclusion is shown, not zeroed; no raw-event-count view exists.
- **Cómo usas la fábrica (AC-10-022.x).** Two cards in their honest empty form («Workflows y skills más usados», «Esfuerzo de los agentes») with their calm empty sentences. When the usage source cannot be read, a coral `Notice` (error variant) sits above the two cards, both cards read «Sin datos: el registro no se pudo leer.» and the rest of the report is unchanged. See the source probe below.
- **Embudo y flujo (AC-10-023.x).** «Embudo ideas → lanzado» as `FunnelRow`s (reused from the Inicio dashboard) with the conversion and the insight sentence; «Transiciones de fase por proyecto» as `TransitionRow`s (date, project, from to), a backward move reading «<fase> ↺ <fase>» with the amber chip «Reapertura» (text, icon and tone), ten at a time with a `MoreBar` (`pageSize` 10 and an explicit `step` 10, since the primitive's default step is twice the page size; AC-10-028.5) (two-line cards on phones).
- **Estado y salud del proceso (AC-10-024.x).** «Proyectos por estado» (project and phase chip) and «Señales del proceso» («Lecciones destiladas N / M», «Relanzamientos de build», «Descartes sin razón estructurada», «Telemetría de calidad» with «no cableado»).
- **Qué mover ahora (AC-10-025.1).** One row with the action sentence from the pure `nextActions` rule and its `CommandBox` with the copy button «Copiar <comando>»; the command is never run.
- **Counter provenance (AC-10-026.2, AC-10-028.5).** A small closed table (`statProvenance.ts`) maps each event-fed counter (agents, streak, speed, builds, subagents, gates, reviews, findings, modes, active days, iterations, flawless launches) to the event kinds that feed it, read from `signals.ts` and `docs/achievements.md` §1. A counter reads «sin datos aún» only when its value is 0 AND none of its event kinds appears in the stream; otherwise it shows its number, including a measured zero. A scalar with no source (`testsPassing: null`, lead time) reads «no cableado». The two states are never merged and never render a bare 0.
- **Usage-source probe.** New `src/lib/events/eventSourceHealth.ts`: `eventSourceHealth()` examines the same event files, and the same tail window, that `readEvents` parses, and returns `{ ok: true }` or an explicit failure `{ ok: false, kind: "missing" | "invalid-json", source, line? }` (1-based line inside the scanned window, the first invalid one). `events.ts` only gains two `export` keywords for the existing private source resolver and tail reader (behaviour unchanged, no third copy of the path logic, DR-115). The reader of events keeps skipping a malformed line for every other consumer; only the usage band must be fail-loud (AC-10-022.3).
- **Removal of the v1 character-sheet shell.** `StatsPanel.tsx` (radar, `HeroStat`, ledger) and the `HeroStat` / `StatLedgerRow` / `StatRadar` pieces are deleted after their replacements land.
- **Behaviour e2e.** `e2e/achievements-statistics.spec.ts`: the report renders its six headings, a «sin datos aún» record versus «no cableado» in the Lead time KPI, the transitions `MoreBar`, the command copy button, and (with a malformed events fixture selected by the harness) the coral notice. `gotoHydrated`; role and name selectors.

## Out of Scope

- The other four tabs, the hero and the page frame (WO-10-016); the engine, the catalogue and the signals (history).
- The FRD-23 stores, writers and resolver (WO-23-xxx, history): consumed as they are.
- Populated top-N workflow and effort lists (Out of v2: AC-10-022.1 and AC-10-022.2 stay as the honest empty bands until the skills emit the event).
- Wiring the idea→release lead time and quality telemetry (future work; they stay «no cableado»).
- Wording not in the frozen catalogue (DR-130): the reason sentences of the unreadable-usage notice («la línea N no es JSON válido», and the missing-file case) have no catalogue key; the implementer renders `usageErrorBodyWithReason` with the structured reason and does not invent the sentences; DESIGN adds the keys (ledger item).

### Removed in this WO (v1 pieces; delete code, exports and tests together)

1. `StatsPanel.tsx` and its radar, hero-stat and ledger-row pieces; the Estadísticas branch of v1 `HallTabs` was already moved into the adapter by WO-10-016.
2. The v1 Informe band components and styles that `Informe.tsx` replaces, and any unused export of `informeData.ts`.
3. The `eventsSnapshot.events.length === 0 && lastEventAt === null → git-unavailable` shortcut that stood in for «usage source absent» (replaced by the explicit probe).
4. The tests of the removed pieces (`wo-10-015-stats-panel-expansion.test.tsx` is rewritten to the new structure).

## Requirements & Acceptance Criteria

Requirements traced: REQ-10-020 to REQ-10-028 (the Informe operativo and its details); FRD-10#U6 (honesty), #U13 (statistics panel), #U14 (unbounded `Nv N` level). Where an AC says the values SHALL equal the fixture-factory oracle values, the tests derive the report from the fixture factory (`docs/design/prototype/fixtures/`, booted through `PANDACORP_FACTORY_ROOT`, the git-fixture seam and `MC_CLOCK` from WO-01-010) and compare with the values the frozen prototype draws, which the implementer reads from the oracle (`docs/design/prototype/data/`, the `achievements-stats` capture) and writes into the test by hand; the expected values are never snapshotted from the implementation (generator is not the verifier).

- **AC-10-020.1** — WHEN the Informe renders THE system SHALL show a one-sentence **verdict** computed by
  deterministic rules from the real figures (e.g. WO-verified trend, active-project count, conversion);
  the rule inputs SHALL all be wired real values, and the rule SHALL be a pure function of them (same
  inputs → same sentence) — no fabricated adjectives.
- **AC-10-020.2** — THE KPI row SHALL show, each from its real source: **WO verified / week** (this week,
  with the **delta** vs the previous week, from the git-derived series, `IF-10-flow-series`); **active
  projects (WIP)** = projects whose `phase` is between `design` and `release` exclusive of terminal,
  from `readStatus` (`IF-10-funnel`); **idea→launched conversion** = shipped ÷ total ideas, from
  `readIdeas`+`readStatus`.
- **AC-10-020.3** — THE **idea→release lead time** KPI SHALL render as **a no-value marker with a "no cableado" label**
  (NOT a zero) because `readIdeas` does not yet parse a per-idea `created` timestamp tying an idea to its
  launch — IF and when that field is wired THEN it SHALL show real days. (Bidirectional edge: this is the
  primary "no cableado" path of the band.)
- **AC-10-021.1** — THE system SHALL show a **WO-verified-per-week** series grouped by **ISO week**,
  where each WO's week is the **git commit where its `implementation_status` crosses to `VERIFIED`** (read
  from the git history of each `work-orders/wo-*.md`, `IF-10-flow-series`), and the per-week values SHALL equal
  the fixture-factory oracle values (state `achievements-stats`, fixtures at `docs/design/prototype/fixtures/`).
  (Amended 2026-10-22, v2 plan: replaces the dated real-data shape W25=78, W26=8, W27=5, which no live test can reproduce.)
- **AC-10-021.2** — THE system SHALL show an **ideas-captured-per-week** series from the **`created`**
  frontmatter of `factory/ideas/*.md` grouped by ISO week (`IF-10-flow-series`), and the per-week values SHALL
  equal the fixture-factory oracle values (state `achievements-stats`, fixtures at `docs/design/prototype/fixtures/`;
  amended 2026-10-22, v2 plan: replaces the dated real-data shape W24=3, W26=15). IF an idea card has no `created` frontmatter THEN it SHALL be excluded
  from the per-week series (and that exclusion SHALL be observable, not silently zeroed).
- **AC-10-021.3** — THE Informe SHALL NOT render the old raw-event-count "en el tiempo" view (raw event
  counts are noise); this requirement REPLACES it. (Negative AC.)
- **AC-10-022.1** — **Out of v2 (owner decision 2026-10-21; the skills do not emit the event yet, so the honest empty band stays):** THE system SHALL show the **most-used workflows/skills**, aggregated from the event
  stream (`~/.claude/dashboard-events.ndjson`, `IF-10-usage`), matching the verified real shape
  **deep-research 1494, pandacorp-build 850, audits/research ≈400** (top-N, descending).
- **AC-10-022.2** — **Out of v2 (owner decision 2026-10-21; same reason as AC-10-022.1):** THE system SHALL show the **effort mix** (high / xhigh / max / medium) aggregated from
  the event stream's `effort.level`, matching the verified real shape **high 1384, xhigh 937, max 700,
  medium 3**.
- **AC-10-022.3** — IF the event stream is absent or unreadable THEN the band SHALL render its **"no
  cableado" / error state** (fail-loud), NOT an empty or zeroed band. The unreadable-stream error state is
  drawn as its own coral notice, distinct from the empty-band text (state `stats-stream-error`, M1
  2026-10-22).
- **AC-10-023.1** — THE system SHALL show the **ideas → launched funnel** from `readIdeas` + `readStatus`
  (`IF-10-funnel`): total ideas narrowing to launched, with the conversion, and the funnel counts and the
  conversion SHALL equal the fixture-factory oracle values (state `achievements-stats`; amended 2026-10-22, v2 plan:
  replaces the dated real-data shape 18 ideas, 1 launched, ≈ 6 %).
- **AC-10-023.2** — THE system SHALL show **phase transitions PER PROJECT** read from the **git history of
  the `phase` field in each `.pandacorp/status.yaml`** (`IF-10-phase-transitions`), labelling each row
  with the **project name**, and the transitions (date, project, from→to) SHALL equal the fixture-factory
  oracle values (state `achievements-stats`; amended 2026-10-22, v2 plan: replaces the dated real-data shape of
  `mission-control`, 06-16 to 06-21).
- **AC-10-023.3** — WHEN a transition goes **backwards** in the phase order (a reopen, e.g.
  release→implementation) THE system SHALL **flag it as a reopening** (text + icon, never color alone).
- **AC-10-024.1** — THE left column SHALL list **projects by phase** from `readStatus` (`IF-10-funnel`),
  and each project's phase SHALL equal the fixture-factory oracle values (state `achievements-stats`; amended
  2026-10-22, v2 plan: replaces the dated real-data shape mission-control → release, personal-page-v2 → design).
- **AC-10-024.2** — THE right column SHALL list **process signals** each from its real source:
  **lessons distilled** (equal to the fixture-factory oracle value, state `achievements-stats`, `IF-10-lessons`; amended 2026-10-22, v2 plan: replaces the dated 2 / 131); **build relaunches** (from
  `IF-10-phase-transitions` reopen count / signals); **discards without a structured reason** (idea cards
  with `status: discarded` whose `discard_reason` is empty/freeform — itself a finding, from `readIdeas`);
  **quality telemetry not wired** (rendered explicitly as **"no cableado"**, not a zero).
- **AC-10-025.1** — THE system SHALL show a short list of **next-best-actions**, each derived by a
  deterministic rule from the real figures and each carrying **its command** (e.g.
  `/pandacorp:memory`, `/pandacorp:release`, `/pandacorp:recommend`); each action's trigger condition
  SHALL be a pure function of wired real values (no fabricated suggestions).
- **AC-10-026.1** — THE per-category ledger SHALL show **exactly 8 rows in each of the three columns** so
  the columns align (no staircase). **Producción** gains **FRDs completed, Commits, Projects
  created**; **Calidad** gains **Tests passing, Decisions/DR**. Each new row's value
  SHALL come from its real source (`IF-10-scalars` for the git/doc counts; `readIdeas`/`readStatus` for
  the rest), and the values SHALL equal the fixture-factory oracle values (state `achievements-stats`;
  amended 2026-10-22, v2 plan: replaces the dated real-data values 21, 823, 2, 7134 and 99).
- **AC-10-026.2** — Each new ledger value SHALL be a real count (or **a no-value marker with the "no cableado" label** when its
  source is not wired) — never a fabricated number. A counter whose event has never been recorded reads
  "sin datos aún" instead (AC-10-028.5); the two states are never merged.
- **AC-10-027.1** — THE records block (right of Atributos) SHALL show a **2×3 grid of 6 records**, adding
  to the existing 3: **Peak week** (the WO count of the best week, from `IF-10-flow-series`);
  **Lessons captured** (from `IF-10-lessons`); **Subagents coordinated** (from
  `signals.subagents`). Each record SHALL come from its real source and equal the fixture-factory oracle value
  (state `achievements-stats`; amended 2026-10-22, v2 plan: replaces the dated 78 and 131); an unwired record SHALL render
  **a no-value marker with the "no cableado" label**, never a fabricated value.
- **AC-10-028.5** — WHERE a counter's event has never been recorded, THE Estadísticas tab SHALL show "sin datos aún" (not 0) with an explanatory line that distinguishes it from "no cableado", and SHALL list phase transitions 10 at a time.

Completeness (definition of done beyond the ACs):

- **Error paths:** each report source that returns an explicit failure (`ReportResult` not ok, factory store or portada fallback failing, the usage probe) renders its own honest error or «no cableado» state in its band (copy from the catalogue: `logros.stats.weeklyError`, `usageError`, `usageErrorBodyWithReason`, `workflowsErrorEmpty`); one failing band never blanks the report; no band ever renders a silent zero (DR-078).
- **Empty states:** an empty transitions list (`logros.stats.transitionsEmpty`, captured in state `stats-transitions-empty`; no literal is typed in code), the two empty usage bands (their captured calm sentences) and an empty week series; strings from `logros.stats.*`.
- **Security:** read-only; the command is shown and copied, never run; the probe reads local event files only and returns structured data (no raw line content is rendered, only its number).
- **Performance:** the report assembles from the O(1) aggregate index when fresh (FRD-23); the probe scans the same bounded tail the events reader already reads, once per request; charts are inline SVG with no library; the page does no per-row git call (one subprocess per interface, unchanged).
- **Accessibility:** the charts have text alternatives naming every week; the radar has the sentence under it; the `Notice` is `role="alert"`; the transitions list is semantic, a reopening is icon plus «Reapertura» plus tone; the command copy button is named «Copiar <comando>»; `Nv N` chips carry text, band pips are not the only cue; tabular figures; 44 px targets on touch layouts; `prefers-reduced-motion` honoured.
- **Copy:** every Spanish string comes from `t()` (`logros.stats.*`); the no-value marker is the one «—» glyph the prototype draws next to «no cableado»; no other em or en dash in product copy.
- **Fidelity:** the built tab matches `mocks/achievements-hall.html` sections `achievements-stats` and `stats-stream-error` on the frozen tokens in light and dark at 375 / 768 / 1280, keeping the prototype's recorded ids, class names and `data-*` / `aria-*` hooks; verified by the Preview Smoke gate (DR-055) and by the close-out computed-style and pixel diff.

## Components and interfaces built

From the [blueprint](../blueprint.md): `CMP-10-statistics-tab` (with `CMP-10-informe-pulse`, `CMP-10-stat-kpi`, `CMP-10-record-tile`, `CMP-10-ledger-card`, `CMP-10-time-series`, `CMP-10-usage-band`, `CMP-10-flow-band`, `CMP-10-transition-row`, `CMP-10-health-band`, `CMP-10-next-action`), `IF-10-statistics-data` (the loader), `IF-10-usage-source` (`eventSourceHealth`), `IF-10-stat-provenance`. Consumed unchanged: `IF-10-flow-series`, `IF-10-phase-transitions`, `IF-10-scalars`, `IF-10-usage`, `IF-10-funnel`, `IF-10-lessons`, the verdict and next-action rules (WO-10-014) and the FRD-23 resolver. Relocation from the components.md path `_components/Stats.tsx`: the four leaf components live in `_components/Stats/` (a folder, because tests and siblings exist).

## Reuse (components.md: reuse, then adapt, then create)

`SectionHeading`, `Card` + `CardHeader`, `RadarChart` / `ColumnChart` / `LineChart` (built by WO-10-016), `FunnelRow` (`src/app/(dashboard)/_components/FunnelRow.tsx`, built by WO-18-002; this is why WO-18-002 is a dependency), `MoreBar`, `Notice` (error variant), `EmptyState`, `CommandBox`, `Chip` / `StateDot`, `Icon`. Created here (inventory rows): `StatKpi`, `RecordTile`, `LedgerCard`, `TransitionRow`.

## Installs

None.

## Derogated tests (BL-0051: same WO, never a later one)

- Rewritten or deleted here: `src/app/achievements/_tests/wo-10-015-stats-panel-expansion.test.tsx`, `src/app/achievements/Informe/_tests/{Informe.test.tsx,informeData.test.ts}` (restated against the new structure), the `StatsPanel` tests, and the report reader tests under `src/lib/achievements/report/_tests/` only where a reader contract grows (the existing cases stay green).
- Reviewer-authored, NOT edited (DR-080): the `src/app/achievements/_tests/*.reviewer.test.tsx` files listed in WO-10-016; the FRD-10 gate reviewer re-blesses them. FRD-23 equivalence tests and FRD-24 golden vectors must stay green.
- Blessed visual baselines of `/achievements`: never touched.

## Tests this WO owns

Component and unit tests beside the code (`getByRole` first): each band against fixture data (verdict purity, the four KPIs, the 2 x 3 records and 3 x 8 ledgers, `statProvenance` cases: never recorded, recorded zero, unwired scalar), the oracle-equality tests described above, the transitions paging (10 at a time) and reopening flag, the usage empty band versus the coral notice, the probe (valid file, missing file, invalid line, the Claude and Codex sources) against real malformed fixture files rather than mocks, `FunnelRow` reuse; `e2e/achievements-statistics.spec.ts`. Hermetic temp trees and fixture factories; never the default root (LESSON-0450). Timestamps are compared with `Date.parse`, never lexicographically (LESSON-0009).

## Visual reference

- **Mock screen(s) to reproduce:** `docs/frds/frd-10-achievements-hall/mocks/achievements-hall.html` sections `achievements-stats` and `stats-stream-error`; screenshots in `mocks/screenshots/<id>-<width>-<theme>.jpg` at 375 / 768 / 1280, light and dark.
- **Oracle states** (`oracle-states.json`, `frd_slug` frd-10-achievements-hall): `achievements-stats`, `stats-stream-error`, `stats-weekly-error` (the `logros.stats.weeklyError` band), `stats-transitions-empty`; route `/achievements/statistics` (the error state boots the harness variant with the malformed events file; the two new scenario states are reproduced from their `docs/design/prototype/reference/oracle-recipes.json` doubles of the same names in this WO's e2e and at the close-out Visual QA).
- **Token slice:** the calm register (DR-062): no RPG lore or glow; `--gold`, `--teal`, `--violet` for the three ledger headers, `--coral` for the unreadable-stream notice and failures, `--amber` for «Reapertura», `--green`/`--coral` only as status; `--surface`, `--surface-2`, `--line`, `--text`, `--text-2`, `--text-3`; chart colours from the hue tokens; radius and spacing tokens as in `docs/design/design-tokens.json`; Space Grotesk titles and KPI numbers, Inter body; `tabular-nums` on every figure; nothing under 12 px.
- **FDD pointer:** `docs/frds/frd-10-achievements-hall/fdd.md` (section Estadísticas and the states «Unreadable usage stream», «Never-recorded counters», «Empty usage bands», «Paged lists»).
- **Assets:** exported SVG icons via `Icon`.

## Dependencies

WO-10-016 (frame, charts, the statistics seam), WO-10-014 (report readers, history), WO-01-011 (clock and git seams adopted in the readers this WO reads through), WO-18-002 (`FunnelRow`). The FRD-23 read-model work orders are VERIFIED history reached through the loader.

## Status Note

- 2026-10-31 (S6B round 2): Patched the column SVG title to one text child; optional missing Codex transport no longer fails a readable primary stream; malformed JSON and unrecognised event shapes retain explicit source/line failures. GitError commit counts now become null and the ledger renders no cableado. Counter provenance unions telemetry kinds with accounting kinds without changing the accounting boundary. Level zero uses the noLevel catalogue entry; record levels include band pips. The report and character-sheet grids use minmax(0, 1fr), with anywhere wrapping for long source paths. Removed the legacy StatsPanel radar and its obsolete test, moved the still-used StatsRecords DTO into the statistics folder, updated HallTabs and other consumers, corrected plugin-sync comments and removed the repeated fixed path from the usage notice catalogue text. Updated ordinary fixture expectations for observed SubagentStop telemetry; reviewer tests and visual baselines are untouched.
- 2026-10-31 (round-2 verification): All commands ran from this worktree's mission-control directory with `export PORT=3992 PANDACORP_E2E_PORT=3992`. `pnpm exec vitest run src/app/achievements src/lib/achievements src/lib/events --maxWorkers=2` passed 62 suites / 524 tests, including the untouched reviewer suites. `pnpm exec next typegen` regenerated local route types after the dev server had left inconsistent generated route declarations; the subsequent `pnpm exec tsc --noEmit` exited 0. `pnpm exec knip` exited 0 with ten configuration hints. `pnpm exec biome check src/app/achievements src/lib/achievements src/lib/events src/app/api/plugin-sync/route.ts docs/design/microcopy.es.json e2e/achievements-statistics.spec.ts` passed 150 files. `git diff --check` passed.
- 2026-10-31 (round-2 runtime limits): `pnpm exec playwright test --config=s6b-playwright.config.ts e2e/s6b-runtime.spec.ts e2e/achievements-statistics.spec.ts` used a temporary worktree-local configuration overriding the fixture port to 3992. The initial Turbopack attempt hit EMFILE watcher errors; the webpack/polling attempt reached browser launch, but all five tests failed before navigation because Chromium's MachPortRendezvous bootstrap_check_in was denied by the environment. The alternate browser tool reported its host unavailable. Temporary config/spec files were removed. A separate `WATCHPACK_POLLING=true pnpm exec next dev --webpack --hostname 127.0.0.1 --port 3992`, with the worktree's fixture factory/events environment, served `curl --max-time 30 -s -o /tmp/s6b-statistics-final.html -w '%{http_code}' http://127.0.0.1:3992/achievements/statistics` with HTTP 200. This verifies server rendering only: browser hydration, long-path overflow at 320/390 and visual fidelity remain unverified. No full verify.sh was run. The work order stays IN_REVIEW. No commit, staging, merge, push, merge queue, decision-log edit, reviewer-test edit or baseline edit was performed.

- 2026-10-31 (S6B): Replaced the v1 adapter and operator-report bands with token-based pulse KPIs, a six-record character sheet, three eight-row ledgers, existing radar/column/line primitives, shared Inicio FunnelRow, ten-at-a-time transitions, reopening chips, health rows and one copy-only command. Counter provenance travels as a serializable array from the cached server loader; the view imports no Node built-ins (transitive graph regression is green).
- 2026-10-31: Added the explicit bounded-tail usage-source probe over the existing event-source resolver and tail reader. Valid empty files, missing files, malformed Claude/Codex lines and a truncated tail are covered against real temporary files. Existing tolerant readEvents behavior is unchanged. The usage error renders a coral Notice and structured source/kind/line through the frozen catalogue template; no new reason sentences were invented.
- 2026-10-31: Oracle expectations were transcribed from `docs/design/prototype/data/extras.js`: WO weekly buckets 76/10/11/8/2/2, idea weekly buckets 3/15/2/1/1, WIP 4, conversion 5%, 22 ideas / 1 launched, 36/65 lessons, scalar counts 26/1762/48/5 and null tests. Tests derive these values through the real fixture factory, seam history and FRD-23 aggregate/portada/factory fallback chain (LESSON-0450). All 19 distinct AC ids in this work order are cited by tests, including the two explicitly out-of-v2 empty usage bands.
- 2026-10-31: `PORT=3992 PANDACORP_E2E_PORT=3992 pnpm exec vitest run src/app/achievements src/lib/achievements/report src/lib/achievements/read-model src/lib/git src/lib/snapshot src/lib/build-track src/lib/self-suggest src/lib/memory src/lib/gamification src/lib/events src/app/api/live src/app/api/plugin-sync --maxWorkers=2`: 82 suites / 904 tests passed; one suite / two tests remain RED: `src/app/achievements/_tests/page.ledger-hermeticity.reviewer.test.tsx`. Its full `@/lib/events/events` mock exports only readEvents, so the new probe cannot access resolveEventSources. The reviewer must preserve the real module exports or mock eventSourceHealth at that external-file boundary. The suite was NOT edited. FRD-23 equivalence and FRD-24 ledger vectors stayed green.
- 2026-10-31: `pnpm exec tsc --noEmit`, `pnpm exec knip` and Biome over all changed TypeScript/TSX/CSS files passed; knip emits ten existing configuration hints. The final focused regression command and its result are recorded below. `git diff --check` passed. No Playwright, full verify.sh, browser/visual/responsive gate or baseline update was run; visual fidelity is unverified. The E2E spec restores its events fixture and test-created factory-store file unconditionally in setup and teardown, seeds deterministic transitions, covers the malformed line-214 usage recipe and the empty-transitions recipe. The weekly-error state is covered by component tests; its browser recipe remains for the gate.
- 2026-10-31: Scope exception for review: the runtime StatsPanel shell, HeroStat, ledger rows and unused exports were removed. StatsPanel.tsx retains only the existing StatRadar and the shared StatsRecords type because `HallTabs.tsx` imports that type and `wo-09-003-stat-radar.test.tsx` imports that radar; both callers are outside this work order's artifacts and HallTabs is explicitly excluded. Completing the file's removal requires moving those two references to the new character-sheet type and existing RadarChart. Neither caller was edited. Existing public test hooks were retained in the replacement components without a hidden legacy view.
- 2026-10-31: No commit, staging, merge, push, merge queue, reviewer-test edit, baseline edit, decision-log edit or .pandacorp state edit. All changes remain on orch/s6b for the orchestrator's scoped review and integration.

- 2026-10-31 final scoped regression: `PORT=3992 PANDACORP_E2E_PORT=3992 pnpm exec vitest run src/app/achievements/Informe src/app/achievements/_tests/wo-10-015-stats-panel-expansion.test.tsx src/app/achievements/_tests/page.test.tsx src/lib/achievements/report src/lib/achievements/read-model src/lib/git --maxWorkers=2` passed 40 suites / 285 tests, including the 25-transition case that distinguishes a ten-item step from MoreBar's default twenty-item step. Final tsc and knip both exited 0. Biome checked all 41 changed TypeScript/TSX/CSS files without fixes or errors. This is IN_REVIEW, not VERIFIED: the untouched reviewer mock, out-of-scope legacy callers and browser gates remain explicitly pending.
