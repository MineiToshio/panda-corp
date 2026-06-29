---
id: WO-10-013
type: work-order
slug: missions-sagas-standardize
title: 'WO-10-013 — Missions expanded to 19 chains/5 sagas + standardized mission/Trofeos/secrets cards'
status: ACTIVE
parent: FRD-10
implementation_status: VERIFIED
source_requirements: []
artifacts: [src/lib/achievements/definitions.ts, src/lib/achievements/stats.ts, src/lib/achievements/achievements.ts, src/app/achievements/_components/HallTabs.tsx, src/app/achievements/StatsPanel.tsx, src/app/achievements/ChainCard/**, src/app/achievements/UniquesSection/**, src/app/achievements/SecretsPanel/**, src/lib/achievements/_tests/**, src/app/achievements/**/_tests/**]
difficulty: high
dependsOn: [WO-10-012]
last_updated: '2026-06-29'
---
# WO-10-013 — Missions abundance + card standardization (owner feedback)

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Catalogue in
[`docs/achievements.md`](../../../achievements.md) §6 (sagas). **Owner constraint: do NOT redesign the
look** (DR-062) — expand content and make the existing cards *uniform*, not new.

This WO captures the post-v2 follow-up the owner asked for while reviewing the live Hall: the Misiones
tab still felt sparse ("only the commons"), and several card details were inconsistent. The why of each
sub-change is in the decision log (2026-06-29).

## In Scope
- **Missions expansion** — grow the cumulative chains from 12 to **19**, grouped into **5 narrative
  sagas** (La Construcción · Las Ideas · El Oficio · El Gremio · El Tiempo). New chains anchored to the
  real signals layer: builds, subagents, green gates, approved reviews, findings attended, build modes,
  active days. `definitions.ts` gains `Saga`/`SAGA_ORDER`/`SAGA_ICONS` + a `saga` field; `ChainState`
  propagates it; `computeStats` adds the 7 new stats; the Misiones tab groups by saga (`SagaSection`)
  instead of the old by-tier bucket.
- **Mission-card standardization** (`ChainCard`) — one shared layout for ALL cards: extract
  `ChainProgress` (NodeLadder → goal-row/completed-line → bar ALWAYS → `CardFooter`) consumed by both
  `SpotCard` and `StandardCard`. The spotlight goes vertical (bar BELOW, not floated right); a completed
  chain keeps a full 100% bar (no missing bar); the footer is uniform (latest dated unlock, else an
  honest cumulative fallback).
- **Node-ladder fix** — the first connector segment now draws (node 0 = `flex:0 0 auto`).
- **Trofeos tab standardization** (`UniquesSection`, `HallTabs` Vitrina) — drop the redundant
  "Bloqueado" text (lock icon + `aria-label` already convey it); replace the conquered-grid yellow glow
  with a calm warn **left-accent**.
- **Secrets uniform grid** (`SecretsPanel`) — responsive grid with **equal-height** cards
  (`gridAutoRows:1fr` + card `height:100%`) so locked silhouettes match unlocked reveals.

## Out of Scope
- New visual language/tokens (DR-062). The catalogue/predicates (WO-10-011), signals (WO-10-010), reader
  (WO-10-009), and the render-v2 base (WO-10-012).

## Acceptance criteria (EARS)
- **AC-10-013.1** — The Misiones tab SHALL present **19 chains grouped under 5 saga headers** (spotlight
  on top), each chain anchored to a real signal.
- **AC-10-013.2** — ALL mission cards SHALL share one layout: the progress bar is **always present**
  (completed = full 100%), and every card ends in the **same uniform footer** (dated unlock or honest
  fallback) — no per-card divergence (no double/single-bar mix, no date-on-one-only).
- **AC-10-013.3** — The node ladder SHALL draw the first connector segment (no gap before node 1).
- **AC-10-013.4** — Conquered trophies SHALL NOT use a full glow; locked trophies SHALL convey state by
  icon + `aria-label`, not a "Bloqueado" text label (non-color signal preserved, WCAG 1.4.1).
- **AC-10-013.5** — Secret cards SHALL render in a grid of **uniform height** (all equal to the tallest).
- **AC-10-013.6** — The Estadísticas character-sheet SHALL show the **19 stats** (the 7 new ones in the
  visible ledger with an icon).
- **AC-10-013.7** — The Preview/Visual gate (DR-055/056) SHALL be green: `/achievements` renders all tabs
  without console error/blank, and the blessed `logros` baseline is re-blessed to the new look.

## TDD plan
RED: `chains-sagas.test.ts` (saga grouping + 19 chains), updated `achievements.test.ts` counts (19 stats
/ 19 chains), `ChainCard.test.tsx` (uniform footer shows latest unlock; maxed chain shows completed line
+ full bar), `SecretsPanel`/`UniquesSection` state assertions. GREEN: implement on existing components.
Browser-verified live (`getComputedStyle`/DOM) since the page is heavy for the screenshot tool.

## Definition of done
`pnpm vitest run` green; tsc + biome + knip + madge clean; no `any`; Preview Smoke + Visual gate green on
`/achievements` (baseline re-blessed); `.pandacorp/verify.sh` passes.
