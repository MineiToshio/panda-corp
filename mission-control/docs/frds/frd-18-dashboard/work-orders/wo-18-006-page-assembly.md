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
