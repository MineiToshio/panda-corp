---
id: FDD-11
type: fdd
slug: build-modes
title: Build entry and target selection
status: ACTIVE
parent: FRD-11
last_updated: '2026-11-12'
prototype_blessed_at: '409a0564'
---

# FDD — FRD-11 Build entry and target selection

Source-of-truth order: FRD > FDD > tokens > blueprint > work order. The 2026-11-12 Day 1 amendment replaces the old mode-card surface; its earlier blessing/screenshots remain historical and are not a new approval of this changed control. No screenshots, geometry baselines or token values are rewritten by this document change.

## Screens and states

The Comandos tab and Construcción sheet reuse one picker. Its action group reads **Construir**, **Reanudar**, **Objetivo: FRD o tarjeta**. Construir is selected on entry. Below it, one command box shows `/pandacorp:implement`, or `/pandacorp:implement --resume` for Reanudar. No power meter, mode tag, plan recommendation or remembered power preference remains. Campaña's disclosure reads **Construir o reanudar**.

Objetivo reveals the labelled target select: pending FRDs, then ready/draft cards with real IDs and titles. Draft options explain session validation. Empty/unselected targets show an explanatory placeholder with copying disabled; selecting one shows the exact FRD/card command from FRD-11. Clearing returns to the placeholder. A project switch/reload resets action and target. A building v2 card's own action resumes its run; stale-suspect cards go to reconciliation.

Work-order construction selects the parent FRD's pending scope and says so explicitly. There is no individual-WO option. Missing targets leave the default build/resume controls usable. Mission Control only copies commands to a session and never executes them.

## Layout and accessibility

Reuse the existing Card/CardHeader, labelled control group, SelectField, CommandBox and copy-feedback primitives, shared design tokens and the responsive Comandos cards. Keep selected state visible as text/control semantics and focus styling. At 375/768/1280 px the controls and long commands fit the available width without page overflow. Keep command text selectable, a Spanish accessible group/field name and the exact command in the copy-button name. Tab reaches actions, target and copy; Space/Enter select an action. No layout animation, new colors, custom power scale or engine-control affordance is introduced.

## Traceability

| State/interaction | Criteria |
|---|---|
| Default Construir / Reanudar | AC-11-007.1 to .3 |
| FRD/card selected, draft, empty, cleared | AC-11-008.1/.2 |
| WO fact-sheet command / building card | AC-11-008.3/.4 |
| Shared Campaña / project switch | AC-11-009.1/.2 |
| Keyboard, copying and responsive fit | AC-11-010.1/.2 |

The existing `mocks/build-modes.html` and `commands-mode-powerful` capture show retired behavior. They remain historical artifacts; review the new controls against this FRD/FDD and the reused component tokens, never by requiring those power cards to reappear.
