---
id: WO-18-006
type: work-order
slug: page-assembly
title: 'WO-18-006 — `app/page.tsx` assembly: banners + 6 sections, default landing'
status: DRAFT
parent: FRD-18
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-18-006 — `app/page.tsx` assembly: banners + 6 sections, default landing

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`CMP-18-page`, `CMP-18-banners`) · [architecture §3, §11](../../../product/architecture.md).
> Visual reference: `prototype/index.html` `dashboardView()` (610–679).

## Goal
The default landing route `/` assembling the conditional health-banner stack + the five sections, with
the other tabs reachable from the top nav. The join point of the feature.

## Scope
- `app/page.tsx` (Server Component, route `/`): compute `IF-18-turn`/`IF-18-pulse`/`IF-18-card`
  server-side and render, top to bottom: banners → digest → Tu turno → Pulso → Cartera → Progreso.
- `CMP-18-banners`: conditional stack of the onboarding gate (FRD-01) + `PluginSyncBanner` (FRD-15) +
  `OrphansBanner` (FRD-16) — each renders only when its condition holds.
- Top nav: Inicio / Tablero / Portfolio / Logros / Configuración / Manual.

## Acceptance criteria
- **AC-18-006.1** (REQ-18-001) `/` renders the dashboard as the default view; the Board / Portfolio /
  Achievements / Configuration / Manual tabs are reachable from the top nav.
- **AC-18-006.2** (REQ-18-004) The banner stack shows the onboarding gate, plugin-drift and orphan
  banners when (and only when) their conditions hold; otherwise the section is absent.
- **AC-18-006.3** (REQ-18-002) The page is read-only and calls no Claude; every actionable item exposes
  its exact command + copy.
- **AC-18-006.4** (REQ-18-003) WHEN nothing needs the operator, the screen reads calm (al-día states),
  not manufactured urgency.
- **AC-18-006.5** The six sections render in the specified order; each composes its WO-18-001..005 component.
- **AC-18-006.6** Fresh factory (no events, no projects) → digest al-día + first-action cards; never a
  blank or crash.

## TDD
`app/page.test.tsx` (`@testing-library/react`) feeding fixture `lib/**` outputs: a healthy factory
(no banners, al-día) and a triggered one (all banners + a full queue + a building project), plus the
fresh-factory case.

## Definition of done
- ACs RED → GREEN; default landing; banners conditional; calm-when-healthy; fresh-factory safe.
  `.pandacorp/verify.sh` green.

## Dependencies
- WO-18-001..005; FRD-15 `PluginSyncBanner`, FRD-16 `OrphansBanner`; FRD-01 onboarding-gate signal
  (`lib/profile`); FRD-17 nudge data. This is the LAST work order of the feature.

## Status Note

**Built (2026-06-18) — commit `b9240e4`**

### What it built

`CMP-18-page` — `src/app/page.tsx` (Server Component, default route `/`). Replaces the
foundation placeholder with the real FRD-18 dashboard. Reads all `lib/**` layers server-side,
computes four derivation bundles, and renders six stacked sections in order:

1. **Health banners** (`dashboard-banners` div): `PluginSyncBanner` + `OrphansBanner` — both
   "use client" components that self-manage polling; render `null` until their condition holds
   (AC-18-006.2). Never manufacture urgency.
2. **Desde tu última visita** (`Digest`): the `visto_hasta` digest component receives the capped
   event tail from `readEvents()` as a prop (AC-18-006.5).
3. **Tu turno** (`TuTurno`): urgency-ordered human-gate queue from `buildTurnQueue`; al-día badge
   when empty (AC-18-006.4).
4. **Pulso de la fábrica** (`Pulso`): funnel + conversion from `pulse()` (AC-18-006.5).
5. **Construcción y cartera** (`Cartera`): per-project cards from `deriveCard()`; first-action card
   when no projects (AC-18-006.6).
6. **Tu progreso** (`Progreso`): gamification strip from `computeGuildLevel` + `computeUniques` +
   `computeChains` (AC-18-006.5).

### Refactor (complexity)

The three high-complexity derivations were extracted into module-level pure helpers to satisfy
biome `noExcessiveCognitiveComplexity` (max 15): `countConstructionSplit`, `deriveProjectCard`,
`mostRecentUnique`, `deriveTurnItems`, `derivePulse`, `deriveGamification`. No behavior change.

### Interfaces/contracts exposed

```tsx
// src/app/page.tsx
export default function HomePage(): React.JSX.Element
// Server Component — no props; route `/`; never "use client"
// Reads: readEvents, activeProjects, readIdeas, memoryHealth, readPortfolio, readStatus
// Computes: buildTurnQueue, pulse, deriveCard, deriveGuildOutcomes, computeGuildLevel,
//           computeStats, computeUniques, computeChains
// Renders: <PluginSyncBanner/>, <OrphansBanner/>, <Digest/>, <TuTurno/>, <Pulso/>,
//          <Cartera/>, <Progreso/>
```

**data-testid surface (new):**
- `dashboard-page` — root `<main>` landmark
- `dashboard-banners` — health-banner container (holds PluginSyncBanner + OrphansBanner)

All other `data-testid` values come from the composed components (WO-18-001..005,
FRD-15/16) and are unchanged.

### Integration seams

- The page is reached at `/` (Next.js default route). The layout (`app/layout.tsx`) guards with
  `readProfile()` and renders `<OnboardingGate />` when the profile is absent — the dashboard
  never renders behind that gate (AC-18-006.1 satisfied via the layout guard, not the page).
- `PluginSyncBanner` and `OrphansBanner` are client components that mount as children of the
  server-rendered page; they add no server-side I/O.
- `Digest` receives `events` (from `readEvents().events`) and `nowMs` as server-computed props;
  it owns the `visto_hasta` marker in `localStorage` client-side.

### Test files

- `src/app/_tests/page.dashboard.test.tsx` — 16 tests (RED→GREEN) covering AC-18-006.1..6:
  default landing, banners container, read-only mocks, al-día calm state, six sections in DOM
  order, fresh-factory first-action card + progreso strip.

**Gate:** 16/16 tests GREEN. Full suite: 231 files, 5873 tests passing. biome clean. tsc clean.
`bash .pandacorp/verify.sh` → `✅ all gates green`.
