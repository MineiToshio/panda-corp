---
id: WO-10-006
type: work-order
slug: rangos-tab
title: 'WO-10-006 — Rangos tab (enriched rank ladder) + unbounded Nv N metric levels'
status: DRAFT
parent: FRD-10
implementation_status: VERIFIED
reopen_count: 0
provenance: reconciled-from-code
artifacts:
  - 'src/app/achievements/RankLadder/**'
  - 'src/app/achievements/_components/HallTabs.tsx'
  - 'src/app/achievements/StatsPanel.tsx'
  - 'src/app/achievements/page.tsx'
  - 'src/lib/achievements/achievements.ts'
  - 'src/lib/achievements/tiers.ts'
source_requirements: [AC-10-001.x]
dependsOn: [WO-10-001, WO-10-005, WO-09-007, WO-09-003]
last_updated: '2026-06-25'
---
# WO-10-006 — Rangos tab (enriched rank ladder) + unbounded Nv N metric levels

> *Reconciled from code by `/pandacorp:sync` on 2026-06-25 — describes existing, shipped behaviour (rank system phases 2–6), not a forward plan. Built by hand in a fast iteration session; recorded here as-built.*

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-10-rank-ladder`, `IF-10-metric-level`, the 5-tab `CMP-10-hall-page`](../blueprint.md#4-components--interfaces).
FDD: [§Body — Estadísticas (`Nv N`) + Rangos](../fdd.md).

## What shipped

- **Rangos tab — the 5th tab** of the Achievements Hall (`HallTabs`): Resumen · Misiones · Trofeos · Estadísticas · **Rangos**, each with its icon + count where relevant. `page.tsx` now feeds `HallTabs` the guild `level` (single source `getGuildState`).
- **`RankLadder`** (`app/achievements/RankLadder/RankLadder.tsx` + `ladderMeta.ts`) — the 40-rung ladder (FRD-09 `RANKS`) as an **enriched, era-sectioned vertical climb** (UI/UX research 2026-06-25: a list beats a grid for an ordered ladder — it preserves the climb; the dead space is killed by enriching the row):
  - **6 narrative eras** with section headers (`ladderMeta.ERAS`).
  - Each rank row: a **large `RankEmblem`** (88px; 104px current; 124px summit) with grade badge, the rank name, a one-line **flavor caption** (`ladderMeta.FAMILY_FLAVOR`, 18 families), the **level band** `Nv min–max`, the **XP threshold** ("Inicio"/"1.040 XP"), and a **state marker** with icon + text (`✓ Conseguido` / `ESTÁS AQUÍ` / `🔒 Nv N` — never color alone, WCAG 1.4.1).
  - Current rank glows (`accent` border + progress bar to the next rank); locked ranks dim toward the summit (opacity floor 0.5); the summit (rank 40) gets a distinct centered "LA CIMA" treatment (`warn` frame). Container max-width 860px.
- **Estadísticas — unbounded `Nv N` per metric:** new pure helper `metricLevel(statKey, value)` (`lib/achievements/achievements.ts`) + `tiers.ts` (band colors). `StatsPanel` shows a `Nv N` chip + a band-colored pip on the hero tiles and each ledger row, replacing the old rarity-named tier on Estadísticas. The rarity-named 5-tier chains remain the **Misiones** lens.

## Acceptance (verified as-built)
- `verify.sh` GREEN. Unit tests: `RankLadder.test.tsx` (40 rows, current-band highlight, names, level bands, era headers, flavor); `metric-level.test.ts` (0/unknown→0, counts thresholds, keeps climbing past Nv 5, monotonic).

## Notes
The rank data model + emblems are FRD-09 (WO-09-007); this WO is the FRD-10 **Hall surface** that visualises them + the Estadísticas numeric lens. Shared-route coordination with FRD-09 unchanged (FRD-09 owns the hero/GuildBar; this WO owns the Rangos tab + the stats ledger).
