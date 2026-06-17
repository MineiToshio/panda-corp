---
id: WO-06-010
type: work-order
slug: view-toggle
title: WO-06-010 — RPG ↔ timeline/DAG toggle + Live/No-signal badge
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-06-010 — RPG ↔ timeline/DAG toggle + Live/No-signal badge

**Components/Interfaces:** `CMP-06-view-toggle` · **Traces:** REQ-06-016
**Deploy unit:** Party tab (Client Component) · **Location:** `app/projects/[slug]/_party/RpgViewToggle.tsx` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-06-016.1: It SHALL offer an honest **RPG ↔ timeline/tree toggle** over the same data (work orders → tasks → actions), and a **Live / No signal** indicator with the timestamp of the last event.

## Scope
- A toggle control that swaps the Party scene for FRD-12's timeline/DAG view (`CMP-12-toggle`) over the **same** snapshot data — no separate fetch.
- Host the **Live / No-signal** badge: consume FRD-12's freshness component (`CMP-12-freshness`) showing the last-event timestamp (`tabular-nums`); state shown by **icon + label**, never color alone (FRD-13).
- Persist the chosen view in `localStorage` (consistent with the client-local UI state, architecture §4.8).

## Dependencies
- **FRD-12 `CMP-12-toggle` + `CMP-12-freshness`** — cross-feature, hard.
- WO-06-006 (the Party scene it toggles away from).

## TDD / Definition of done
- Component tests: toggling switches the rendered view and back; the Live/No-signal badge shows the timestamp; with a stale `lastEventAt` it shows "Sin señal" with its icon (not color-only); the choice persists across remount (localStorage mocked).
- Gate green.
