---
id: WO-06-011
type: work-order
slug: empty-reducedmotion-multiproject
title: WO-06-011 — Empty state + reduced-motion + multi-project borders
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-06-011 — Empty state + reduced-motion + multi-project borders

**Components/Interfaces:** `CMP-06-empty`, polish across `CMP-06-scene`/`CMP-06-feed` · **Traces:** REQ-06-010, REQ-06-011, REQ-06-003 (a11y)
**Deploy unit:** Party tab · **Location:** `app/projects/[slug]/_party/PartyEmptyState.tsx` (+ `.test.tsx`) and edits to scene/feed

## Acceptance criteria (verbatim EARS)
- AC-06-010.1: IF there is no active team, it SHALL show an empty state gracefully.
- AC-06-011.1: Each agent SHALL have a fixed color reused across the UI; multi-project → project-color (left border) + agent-color (second border).
- FRD-13: the UI SHALL honor `prefers-reduced-motion` — it disables ALL Party animation.

## Scope
- `CMP-06-empty`: friendly Spanish empty state ("no hay un equipo activo") with guidance; never a blank/crash.
- Wire `prefers-reduced-motion`: when set, the scene does **not** start the RAF loop (sprites static) and the feed/toast skip animation — verify ALL Party animation is disabled (FRD-13).
- Multi-project rendering: when the snapshot contains >1 project, sprites/feed rows show the project-color + agent-color double border.

## Dependencies
- WO-06-006 (scene), WO-06-007 (feed), FRD-13 (reduced-motion, tokens).

## TDD / Definition of done
- Tests: `active=false` renders the empty state, not the scene; with `matchMedia(prefers-reduced-motion: reduce)` the RAF loop is not started and no animation classes apply; a 2-project snapshot renders the double border. Empty/reduced-motion never throw.
- Gate green.
