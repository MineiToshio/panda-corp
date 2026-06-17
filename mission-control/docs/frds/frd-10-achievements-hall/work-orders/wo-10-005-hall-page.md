---
id: WO-10-005
type: work-order
slug: hall-page
title: WO-10-005 — Hall page shell + hero + tabs + stats panel
status: DRAFT
parent: FRD-10
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-10-005 — Hall page shell + hero + tabs + stats panel

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-10-hall-page`, `CMP-10-stats-panel`](../blueprint.md#4-components--interfaces).

## Goal
Build `app/achievements/page.tsx` (Server Component): the Guild Hall hero (guild level/XP via
`IF-09-guild-xp` + party avatars via `CMP-09-avatar`), the tabs (Resumen · Misiones · Trofeos ·
Estadísticas) and the **stats panel** (only-grow counters, each with its tier medal). Architecture
§11 surface `app/achievements`.

## Acceptance criteria (EARS, from FRD-10)
- **AC-10-005.1** — The page SHALL show a hero with the guild's level/XP (from `IF-09-guild-xp`) and the party avatars (`CMP-09-avatar`), plus tabs.
- **AC-10-005.2** — The page SHALL show a **statistics panel** with the only-grow counters from `computeStats()`, each with its tier medal.
- **AC-10-005.3** — Every number SHALL use `tabular-nums` (FRD-13); the XP bar reuses `CMP-09-xp-bar` (honest, no fake fill).
- **AC-10-005.4** — The page SHALL render gracefully on an empty/fresh factory (honest zeros, no fabricated trophies) (negative AC).
- **AC-10-005.5** — Styling SHALL use FRD-13 tokens only (tier colors are tokens), Spanish labels/`aria-label`s, keyboard navigation, visible focus.

## Dependencies
- WO-10-001 (`computeStats`). Intra-feature.
- FRD-09 `IF-09-guild-xp`, `CMP-09-xp-bar`, `CMP-09-avatar`. Cross-feature.
- FRD-13 tokens, `tabular-nums`. Cross-feature.

## TDD plan
1. RED: `app/achievements/page.test.tsx` — hero with guild XP + party, tabs, stats panel from the engine, `tabular-nums`, empty-factory honesty, a11y.
2. GREEN: implement the shell + hero + stats panel.
3. Refactor.

## Definition of done
- Component tests green incl. empty-factory negative AC; tsc + biome clean; tokens only; `tabular-nums`. `.pandacorp/verify.sh` passes.

## Status Note

**What was built:** `app/achievements/page.tsx` (Server Component, `HallPage`) + `app/achievements/StatsPanel.tsx` (`StatsPanel` component).

**HallPage** reads the factory data (readPortfolio → readStatus → readEvents → readIdeas), derives guild level via `deriveGuildOutcomes` + `computeGuildLevel`, assembles `ReaderData`, and renders:
- Hero section (`data-testid="hall-hero"`) — guild level badge, XP bar (reuses `CMP-09-xp-bar`), party avatars (reuses `CMP-09-avatar` for 5 canonical roles in a `<ul>`), tabs (`<div role="tablist">` with 4 `<button role="tab">` — Resumen/Misiones/Trofeos/Estadísticas; first tab `tabIndex=0`, rest `-1`).
- Stats panel section delegated to `StatsPanel`.

**StatsPanel** (`data-testid="stats-panel"`, `aria-label="Panel de estadísticas del gremio"`) calls `computeStats(readerData)` + `computeChains(stats)` and renders 12 `StatItem` rows, each with:
- `data-testid="stat-item"`, `data-testid="stat-label"`, `data-testid="stat-value"` (class `tabular-nums`), `data-testid="stat-medal"` (`role="img"`, `aria-label="Nivel: Bronce/Plata/Oro/Platino/Leyenda"` or `"Sin nivel aún"`).

**Interfaces/contracts exposed:**
```tsx
// app/achievements/page.tsx
export default async function HallPage(): Promise<React.JSX.Element>
// data-testid: hall-hero, hall-guild-level, hall-party-avatars,
//              hall-tabs, hall-tab-{id}, xp-bar (via XpBar), agent-avatar (via Avatar)

// app/achievements/StatsPanel.tsx
export type StatsPanelProps = { readerData: ReaderData };
export function StatsPanel({ readerData }: StatsPanelProps): React.JSX.Element
// data-testid: stats-panel, stat-item, stat-label, stat-value, stat-medal
```

**Integration seams:**
- Consumes `IF-09-guild-xp` (`computeGuildLevel` + `deriveGuildOutcomes` from `lib/gamification.ts`) — FRD-09.
- Consumes `CMP-09-xp-bar` (`XpBar` from `components/rpg/XpBar.tsx`) — FRD-09.
- Consumes `CMP-09-avatar` (`Avatar` from `components/rpg/Avatar.tsx`) — FRD-09.
- Consumes `IF-10-stats` + `IF-10-chains` (`computeStats`, `computeChains` from `lib/achievements.ts`) — WO-10-001.
- All design tokens via CSS custom properties from `globals.css` — FRD-13.

**Lesson noted (for librarian):** Biome `useAriaPropsSupportedByRole` rejects `aria-label` on `<div>` without a role and on plain `<span>`. Fix: use semantic HTML (`<ul>` accepts `aria-label` natively; `<span role="img">` accepts `aria-label`). Do NOT use `role="group"` on `<div>` — Biome's `useSemanticElements` prefers `<fieldset>`. (agent-inferred)

**Test file:** `app/achievements/page.test.tsx` — 27 tests covering AC-10-005.1 through AC-10-005.5 (including integration test with real reader mocks and negative ACs for empty factory).

**Gate:** 174 test files, 4800 tests GREEN + 2 expected-fail + 5 skipped. tsc clean. biome clean.
</content>
