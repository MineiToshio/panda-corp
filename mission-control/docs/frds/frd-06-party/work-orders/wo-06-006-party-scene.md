---
id: WO-06-006
type: work-order
slug: party-scene
title: 'WO-06-006 — Party scene render (zones, stations, sprites)'
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-06-006 — Party scene render (zones, stations, sprites)

**Components/Interfaces:** `CMP-06-scene` · **Traces:** REQ-06-001, REQ-06-002, REQ-06-003, REQ-06-004, REQ-06-009
**Deploy unit:** Party tab (Client Component) · **Location:** `app/projects/[slug]/_party/PartyScene.tsx` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-06-001.1: The view SHALL show 4 pixel-art zones, each with its label.
- AC-06-002.1: EACH workflow subagent SHALL appear as a sprite placed in its zone.
- AC-06-003.1: WHILE there is no stage transition, the sprites SHALL have life (breathing + wandering).
- AC-06-009.1: The view is for **observation**: to redirect/pause an agent, the owner uses the Claude Code app.

## Scope
- `"use client"` component that mounts the engine (WO-06-004), binds it to a `requestAnimationFrame` loop, and renders the DOM: zones with labels, stations (fixed label + dim/hot per activity, PARTY.md §2), sprites (reused assets from `prototype/assets/**`, `image-rendering: pixelated`), halos/emotes/progress bars/speech bubbles per state.
- Re-mount discipline from PARTY.md §5: each render bumps a `runId`; the old loop self-stops; tab-hidden pauses RAF (browser default).
- Receives `PartySnapshot` + event diffs as props; calls `engine.applyEvents` on prop change.
- **No control affordances** (observation-only, REQ-06-009).

## Dependencies
- WO-06-004 (engine), WO-06-005 (snapshot/props), FRD-13 design tokens (agent colors, halos, motion <300ms), `prefers-reduced-motion` (full handling in WO-06-011).

## TDD / Definition of done
- Component tests (jsdom + RTL): renders 4 zones with labels; one sprite per roster role placed in its zone; state classes (`s-work/s-walk/s-idle/s-blocked/s-review`) applied from snapshot; no button/control to command agents exists. RAF is mocked.
- Gate green.
