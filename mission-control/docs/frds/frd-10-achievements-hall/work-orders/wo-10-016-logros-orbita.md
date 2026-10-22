---
id: WO-10-016
type: work-order
slug: logros-orbita
title: 'WO-10-016 — Logros: hero, Resumen, Misiones, Trofeos, Rangos'
status: DRAFT
parent: FRD-10
foundation: false
implementation_status: PLANNED
difficulty: high
reopen_count: 0
artifacts:
  - 'src/app/achievements/page.tsx'
  - 'src/app/achievements/[...segments]/**'
  - 'src/app/achievements/_components/HallTabs.tsx'
  - 'src/app/achievements/_components/summary/**'
  - 'src/app/achievements/_components/missions/**'
  - 'src/app/achievements/_components/trophies/**'
  - 'src/app/achievements/_components/charts/**'
  - 'src/app/achievements/_components/Stats/StatisticsTab.tsx'
  - 'src/app/achievements/_components/Stats/loadStatisticsData.ts'
  - 'src/app/achievements/_utils/**'
  - 'src/app/achievements/RankLadder/**'
  - 'src/app/achievements/ChainCard/**'
  - 'src/app/achievements/UniquesSection/**'
  - 'src/app/achievements/SecretsPanel/**'
  - 'src/app/achievements/AlmostThere.tsx'
  - 'src/app/achievements/_tests/hall*.test.tsx'
  - 'src/app/achievements/_tests/page.test.tsx'
  - 'src/app/achievements/_tests/wo-09-003-stat-radar.test.tsx'
  - 'src/app/achievements/_tests/wo-10-005-hall-surfaces.test.tsx'
  - 'src/components/modules/GuildHero/**'
  - 'src/lib/achievements/tiers.ts'
  - 'src/lib/achievements/_tests/seals-rarity.test.ts'
  - 'e2e/achievements.spec.ts'
  - 'e2e/persistent-navigation/achievements.spec.ts'
source_requirements: [REQ-10-028]
dependsOn: [WO-13-012, WO-25-001, WO-23-006, WO-01-010]
last_updated: '2026-10-22'
---

# WO-10-016 Logros: hero, Resumen, Misiones, Trofeos, Rangos

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Blueprint: [`blueprint.md`](../blueprint.md) · FRD: [`frd.md`](../frd.md) · FDD: [`fdd.md`](../fdd.md) · design detail: [`docs/achievements.md`](../../../achievements.md).

## Summary

Rebuilds the Logros page frame and four of its five tabs as the Órbita design: the guild hero above five icon tabs (a count only on Trofeos), Resumen («Casi lo tienes», «Sellos del gremio», «Tu siguiente rango», «Trofeos recientes», «Atributos del gremio»), Misiones (sagas, missions ordered by closeness to their next tier with untouched ones last and muted, the «A un paso de subir» spotlight), Trofeos (conquered bar, Sellos, category chips, Conquistados, «Los más alcanzables», «Por conquistar» 12 at a time, Secretos, trophy dialog) and Rangos (the 40-rank ladder in six eras, far eras collapsed to one row). It also moves the Estadísticas tab behind a stable seam (an adapter over the v1 report that WO-10-017 rewrites), creates the three shared SVG charts, and removes the v1 pieces the design dropped. The engine and the report readers are history and are consumed unchanged.

## In Scope

- **Page and frame.** `page.tsx` (Server Component) assembles plain DTOs from the existing engine (`getGuildState`, `computeStats`, `computeChains`, `computeUniques`, `computeSeals`, `computeSecrets`, the rank table) and the statistics loader seam below, and renders `PageHead` (h1 «Logros», subtitle from the catalogue), `GuildHero` and `HallTabs`. `HallTabs` (client) is the `Tabs` frame: Resumen · Misiones · Trofeos · Estadísticas · Rangos, each with its 15 px icon, a count only on Trofeos (unlocked trophies); the selected tab, the category filter, the open trophy and the opened eras are URL state through the FRD-25 codec. `[...segments]/page.tsx` keeps its codec seeding with the five tab segments.
- **GuildHero (restyle in place).** Crest XL in a gold frame, kicker «Gremio Pandacorp · nivel N», the rank name as display title, the XP line «N XP · M para el nivel L», a gold XP bar, and the three counts trofeos / secretos / niveles de misión (they drop under the title on phones).
- **Resumen (AC-10-028.1).** Two columns from 1024 px with side-by-side cards ending at the same height. Left: `AlmostThere` («Casi lo tienes», the three chains closest to their next tier) and «Sellos del gremio» (nine rows: lock tile, name, earned/total, axis, bar; one per axis plus «Todos los sellos»). Right: `NextRankCard` («Tu siguiente rango»: current emblem to next emblem, the XP-to-next bar, «Faltan N XP…», how XP is earned, the link «Ver el escalafón» to Rangos), «Trofeos recientes» (the last four unlocked, 2 x 2), and «Atributos del gremio» (the compact `RadarChart`, one sentence naming the strongest attribute in bold and the attributes without data, and the link «Ver todas las estadísticas» to Estadísticas).
- **Misiones (AC-10-028.2).** The intro line, the spotlight `MissionCard` (spot variant, «A un paso de subir»), then one `SectionHeading` per saga (La Construcción, Las Ideas, El Oficio, El Gremio, El Tiempo) with its mission count; inside a saga the missions are ordered by closeness to their next tier, missions with zero progress last and muted (compact rows on phones). Every card has one layout: icon tile, tier name as title (chain name as subtitle, lower-is-better chains say so), rarity chip or «Sin tier», node ladder, goal row, the always-present `progressbar` named «<cadena>: N% hacia <siguiente>», and the uniform footer «N acumulado». The bar starts at the real accumulated value (endowed progress, honest).
- **Trofeos (AC-10-028.3).** The conquered bar («N / M trofeos conquistados», %), «Sellos» (`SectionHeading` with «N de 9», nine `SealTile`s in a 4-column grid), the category `FilterChip` group «Categoría» (Todos + the eight axes with counts, neutral selected state, no icons), «Conquistados» (`TrophyCard` tiles; a conquered trophy without a date draws no footer), «Los más alcanzables», «Por conquistar», «Secretos» (silhouette `SecretTile`s with the cryptic hint; hidden while a category is active). A trophy tile opens the shared `Dialog` (kicker «Trofeo», rarity / category / state chips, description, «Proyecto: <nombre>»).
  - «Los más alcanzables»: the lowest-rarity locked trophy of each category (one per category; three, the lowest-rarity ones, when a category filter is active), ties broken by catalogue order; its count reads «N de <bloqueados>».
  - «Por conquistar»: the locked trophies that are not already in «Los más alcanzables», as AC-10-028.3 states: the first 12, then a full-width `MoreBar` «Mostrar N más · quedan M» (N at most 24, as the frozen capture draws «Mostrar 24 más · quedan 46»); each activation appends the next batch of up to 24.
- **Rangos (AC-10-028.4).** `RankLadder` with `EraGroup` and `RankRow`: the intro, era headers with the level range («Nv 1–12 · completa»), rank rows (56 px emblem with its I / II / III grade badge, Spanish name, one-line flavour caption, level band, XP threshold, state marker «Conseguido» / «Estás aquí» / lock with «Nv N» — icon AND text), the current rank highlighted with its progress bar and «Faltan N XP para <siguiente>», ranks ahead dimmed toward the summit (opacity floor 0.5). Every era more than one step beyond the current rank collapses to a single row with its name, «Nv a–b · N rangos» and a chevron; a collapsed era opens in place and keeps the same rows (the opened eras live in the URL).
- **Pure view rules (`_utils/`).** Mission ordering by closeness, nearest-trophy selection, era collapse, attribute summary (strongest, weakest, without data), recent trophies. Pure functions over the engine's DTOs, each unit-tested with the worked example of the FRD (80% then 30% then 0%).
- **Shared charts (`_components/charts/`).** `RadarChart`, `ColumnChart`, `LineChart` as token-coloured SVG with text alternatives (restyle of the v1 `StatRadar`); built and unit-tested here, mounted by WO-10-017 for the last two. The Resumen mounts `RadarChart` compactly.
- **Statistics seam.** `_components/Stats/StatisticsTab.tsx` and `_components/Stats/loadStatisticsData.ts` are created here as ADAPTERS over the current v1 report (the Estadísticas body that `HallTabs` composes today moves into `StatisticsTab`; the report-source assembly that `page.tsx` does today moves into `loadStatisticsData`). `HallTabs` and `page.tsx` import only those two names, so WO-10-017 rewrites the Estadísticas tab without touching this WO's files. Contract: `StatisticsTab(props)` takes the object `loadStatisticsData()` returns; both change shape only inside WO-10-017.
- **Behaviour e2e.** `e2e/achievements.spec.ts`: Resumen links onward (escalafón, estadísticas), Misiones saga order, Trofeos category filter, trophy dialog (open, Escape, focus return), «Por conquistar» paging, Rangos opening a collapsed era; `gotoHydrated`, role and name selectors.

## Out of Scope

- The Estadísticas report itself (six bands, KPIs, ledgers, records, charts mounting, usage probe): WO-10-017.
- The engine, the catalogue, the signals, the report readers and the FRD-23 read-model (history; consumed unchanged). The sidebar guild card and the achievement notice (WO-19-003).
- The estimated-rarity text and the per-trophy NUEVO badge (Out of v2).

### Removed in this WO (v1 pieces the design dropped; delete code, exports and tests together)

1. The NUEVO badge (`NuevoBadge`, its CSS and tests) and the estimated-rarity blurb (`rarityBlurb` in `src/lib/achievements/tiers.ts` and its use as a tooltip/label, with the matching cases in `_tests/seals-rarity.test.ts`).
2. The distinct summit treatment of rank 40 («LA CIMA», larger emblem, warn frame) in `RankLadder`.
3. The TU PARTY roster and the record badges in the hero (`GuildHero`).
4. The chain-complete crown («Cadena legendaria completada») and the per-tier date and project line (`CardFooter` latest unlock, `ChainProgress` crown branch) in the mission cards; a completed chain shows a full bar.
5. The revealed-secret treatment: an unlocked secret renders as a normal tile with its condition.
6. The folders `ChainCard/`, `UniquesSection/`, `SecretsPanel/` and the file bodies of `HallTabs.tsx` that they served (replaced by `missions/`, `trophies/` and the new frame), and any export or test left without a consumer.
7. The v1 `StatRadar` usage in the Resumen (the Estadísticas copy of it is WO-10-017's to delete).

## Requirements & Acceptance Criteria

Requirement traced: REQ-10-028 (Resumen, missions, trophies, ranks details), together with the unnumbered base criteria of the FRD (the five-tab layout, hero, sagas, Sellos, rarity grade, eight axes as filter chips, trophies by state, secrets, endowed progress), cited in the blueprint as `FRD-10#U1` to `FRD-10#U21`.

- **AC-10-028.1** — THE Logros Resumen SHALL show, in its right column, "Tu siguiente rango" (the current and next emblem, the XP left and how XP is earned), a compact attributes radar naming the strongest and weakest attribute, and the last four trophies.
- **AC-10-028.2** — WITHIN each saga on Misiones, missions SHALL be ordered by closeness to their next tier, with untouched missions (zero progress) last and muted.
- **AC-10-028.3** — (amended 2026-10-22, v2 reconciliation) THE Trofeos tab SHALL show a conquered bar and the row of Sellos, "Los más alcanzables" (the lowest-rarity locked trophy of each category, three when a category filter is active), and SHALL list the locked trophies of "Por conquistar" paged with the shared "Mostrar más" bar: the first 12, then WHEN the bar is activated THE system SHALL reveal the next 24 (or what remains), the bar reading "Mostrar N más · quedan M" with N = the next batch (at most 24) and M = the trophies still hidden (the captured state draws "Mostrar 24 más · quedan 46").
- **AC-10-028.4** — THE Rangos tab SHALL collapse every era more than one step beyond the current rank into a single row showing its level range and its rank count.

Worked example (AC-10-028.2): in a saga with three missions, A at 80% of its next tier, B at 30%, C at 0%, the order is A, B, then C (muted, last).

Completeness (definition of done beyond the ACs):

- **Honesty (non-negotiable):** every figure derives from the engine; no fabricated date, project or progress; locked secrets show no condition; an empty factory shows honest empty states, never invented trophies. The engine's fail-loud events reader behaviour is unchanged.
- **Empty and partial states:** «Ningún trofeo conquistado en esta categoría.» (Conquistados empty under a filter), the empty «Por conquistar» message, a mission with zero progress, a tab with no recent trophies; strings from `logros.*` and `dialogs.trophy.*`.
- **Security:** read-only, no write path; shown content (trophy and mission names from `docs/achievements.md` data, project names) rendered as text.
- **Performance:** one server read per request through the engine's memoised derivations; the trophy lists render at most the visible batch; only the statistics adapter is heavy and it is unchanged from v1.
- **Accessibility:** one `h1` «Logros»; the tab bar is a `tablist` with arrow keys and the selected tab scrolls into view on phones; progress bars are `progressbar` with an accessible name; the radar has a text alternative (the sentence under it); rarity is a dot plus its name, rank state is icon plus text, locked tiles carry the lock icon and text — never colour alone; the dialog traps focus, closes on Escape and returns focus to the tile; 44 px targets on touch layouts; `prefers-reduced-motion` honoured; only transforms animate; numbers use tabular figures.
- **Copy:** every Spanish string comes from `t()` (`logros.*`, `dialogs.trophy.*`, `dialogs.default.close`); trophy, mission and rank names come from the app data.
- **Fidelity:** the built screens match `mocks/achievements-hall.html` on the frozen tokens in light and dark at 375 / 768 / 1280 (layout, structure, components, density), keeping the prototype's recorded ids, class names and `data-*` / `aria-*` hooks; verified by the Preview Smoke gate (DR-055) and by the close-out computed-style and pixel diff.

## Components and interfaces built

From the [blueprint](../blueprint.md): `CMP-10-hall-page`, `CMP-10-hall-tabs`, `CMP-10-guild-hero`, `CMP-10-summary-tab` (with `CMP-10-next-rank-card`, `CMP-10-attributes-card`, `CMP-10-recent-trophies`, `CMP-10-almost-there`, `CMP-10-seals-card`), `CMP-10-missions-tab` (`CMP-10-mission-card`), `CMP-10-trophies-tab` (`CMP-10-trophy-card`, `CMP-10-secret-tile`, `CMP-10-seal-tile`, `CMP-10-trophy-dialog`), `CMP-10-rank-ladder` (`RankRow`, `EraGroup`), `CMP-10-charts`, the statistics seam (`IF-10-statistics-data`), and `IF-10-view-rules`. Relocations from components.md paths (recorded in the blueprint, never a rename or a fork): `NextRankCard` to `_components/summary/`, `MissionCard` (restyle of `ChainCard`) to `_components/missions/`, `TrophyCard` / `SecretTile` / `SealTile` to `_components/trophies/`.

## Reuse (components.md: reuse, then adapt, then create)

`PageHead`, `Tabs`, `Card` + `CardHeader`, `SectionHeading`, `ProgressBar`, `Chip` family (rarity chip, `FilterChip`), `MoreBar`, `EmptyState`, `Dialog`, `Icon`, `GuildHero` (restyle), `RankRow` / `EraGroup` (restyle of `RankLadder`). Created here (inventory rows): `NextRankCard`, `MissionCard`, `TrophyCard` / `SecretTile` / `SealTile`, `RadarChart` / `ColumnChart` / `LineChart`. `SectionHead`, `HeroStat`-style panels and `TierBadge` are retired names: do not import them.

## Installs

None (charts are plain SVG; no chart library).

## Derogated tests (BL-0051: same WO, never a later one)

- Implementer-authored tests of replaced behaviour, updated or deleted here: `src/app/achievements/_tests/{page,wo-09-003-stat-radar,wo-10-005-hall-surfaces}.test.tsx` (named in the artifacts), the tests under `ChainCard/_tests`, `UniquesSection/_tests` (incl. `rarity-nuevo.test.tsx`), `SecretsPanel/_tests`, `RankLadder/_tests`, `src/components/modules/GuildHero/_tests/GuildHero.test.tsx`.
- Reviewer-authored, NOT edited (DR-080), re-blessed or rewritten by the FRD-10 gate reviewer: `src/app/achievements/_tests/frd-10-gate-opus.reviewer.test.tsx`, `frd-10-gate.reviewer.test.tsx`, `frd-10-reuse.gate.reviewer.test.tsx`, `frd-10-integration.reviewer.test.tsx`, `page.ledger-hermeticity.reviewer.test.tsx`. They pin v1 behaviour (NUEVO, estimated rarity, crown, per-tier date, summit treatment, party roster) and will be red until then.
- `src/app/achievements/_tests/wo-10-015-stats-panel-expansion.test.tsx` and the Informe tests are WO-10-017's (it adapts them when it rewrites the tab); this WO keeps the adapter behaviourally identical so they stay green meanwhile.
- Blessed visual baselines of `/achievements` (`e2e/visual.spec.ts-snapshots/**`): never touched; re-blessed by the reviewer at the close-out Visual QA.

## Tests this WO owns

Unit and component tests beside the code (`getByRole` first): each pure view rule (ordering with the worked example, nearest trophies with and without a category, 12-at-a-time paging and its label counts, era collapse around the current rank, attribute summary), the tab frame and its URL round trip (tab, category, trophy, eras), each tab's honest states, the trophy dialog, the charts' text alternatives, the adapter seam; `e2e/achievements.spec.ts`. Fixtures are builders in `src/test/`, never the real factory through a default root (LESSON-0450).

## Visual reference

- **Mock screen(s) to reproduce:** `docs/frds/frd-10-achievements-hall/mocks/achievements-hall.html`, sections `achievements-summary`, `achievements-missions`, `achievements-trophies`, `achievements-trophy-category`, `achievements-trophy-dialog`, `achievements-ranks`; the ladder rows also follow `docs/frds/frd-09-gamification/mocks/gamification.html` section `guild-rank-ladder`. Screenshots in `mocks/screenshots/<id>-<width>-<theme>.jpg` at 375 / 768 / 1280, light and dark (the dialog at 375 and 1280). The sidebar drawn inside the mock shards is WO-19-003's.
- **Oracle states** (`oracle-states.json`, `frd_slug` frd-10-achievements-hall): `achievements-summary`, `achievements-missions`, `achievements-trophies`, `achievements-trophy-category`, `achievements-trophy-dialog`, `achievements-ranks`; routes `/achievements`, `/achievements/missions`, `/achievements/trophies`, `/achievements/ranks`.
- **Token slice:** rarity colours (Común to Leyenda) from the five tier hues through `data-tone`; `--gold` for the XP bars, the hero frame and the conquered bar; `--green` for «Los más alcanzables» and the conquered check; `--violet` for secrets; `--slate` for locked; `--surface`, `--surface-2`, `--line`, `--text`, `--text-2`, `--text-3`, `--focus`, `--shadow-dialog`; radius and spacing tokens as in `docs/design/design-tokens.json`; Space Grotesk for the hero title and card titles, Inter body, JetBrains Mono not used; `tabular-nums` on every number; nothing under 12 px.
- **FDD pointer:** `docs/frds/frd-10-achievements-hall/fdd.md` (Screens, States, Components used, Interaction, Responsive and accessibility).
- **Assets:** the rank emblems, crest and trophy art as original bytes from `public/ranks/**` and the exported SVG icons (staged by WO-13-010).

## Dependencies

Reconciliation 2026-10-22: this work order also updates `e2e/persistent-navigation/achievements.spec.ts` (split out by WO-25-001; the `achievements` case moves to the `logros-tab-*` testids; AC-25-001.1 / AC-25-002.1 re-verified), uses the WO-25-001 keys `category`, `trophy`, `eras`, passes its «Por conquistar» paging to the shared `MoreBar` as `pageSize` 12 and `step` 24 (the first 12, then up to 24 per press, AC-10-028.3), imports `now()` from `@/lib/clock/clock` and never adds `child_process` or a zero-argument `Date` (WO-01-011's boundary test), and renders no `<main>`.

WO-13-012 (composite primitives), WO-25-001 (URL codec; the Logros tab segments plus the filter keys), WO-23-006 (the composed Informe reader that `page.tsx` wired last, so the page file is free before this WO rewrites it), WO-01-010 (the frozen clock `now()` for the recency rules). Consumed by WO-10-017 (charts, statistics seam) and WO-13-013.

## Status Note
