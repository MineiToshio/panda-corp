---
id: FRD-11
type: frd
title: FRD-11 — Build entry and target selection
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-11-12'
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-11-build-modes/mocks/build-modes.html
floor: false
---
# FRD-11 — Build entry and target selection

The Comandos tab and Campaña offer a copy-only choice: **Construir / Reanudar / Objetivo: FRD o tarjeta**. The engine chooses models and concurrency. Effective at plugin 10.0.0; this amendment supersedes the four-card mode picker and its F11 deferral. The directory name remains stable for links.

The producer evidence, command table and scope rules are in [the shared read contract](../../product/build-engine-v2.md), inspected at engine commit 540afa2c (`detect.mjs`, `preflight/scope.mjs`). These are criteria for the next MC delivery, not a claim that its UI already implements them.

## Retired criteria (IDs retained, never reused)

- **REQ-11-001** — Retired: selecting one of four power modes.
- **REQ-11-002** — Retired: mode-dependent command text.
- **REQ-11-003** — Retired: remembered per-project power mode.
- **REQ-11-004** — Retired: skill arguments for power modes.
- **REQ-11-005** / **AC-11-005.1**, **AC-11-005.2**, **AC-11-005.3** — Retired: four mode cards, arbitrary WO targets and mode disclosure.
- **REQ-11-006** — Retired: deferring the picker redesign.

These IDs are superseded by REQ-11-007 to -010. Legacy browser mode preferences have no build meaning and must not select or alter an action. Prior screenshots remain historical for this changed surface; they do not require power controls in the new UI.

## Acceptance criteria (EARS)

### REQ-11-007 — Build or resume

- **AC-11-007.1** — WHEN the owner opens Comandos, THE picker SHALL offer **Construir**, **Reanudar**, and **Objetivo: FRD o tarjeta**, with Construir selected by default and one copyable command.
- **AC-11-007.2** — WHEN Construir is selected, THE command SHALL be `/pandacorp:implement`; WHEN Reanudar is selected, THE command SHALL be `/pandacorp:implement --resume`.
- **AC-11-007.3** — WHEN an action is selected, THE picker SHALL explain it in Spanish and SHALL NOT append power-mode words or the old engine opt-in keyword, show a power meter, recommend a subscription plan, or execute the command. A stored legacy mode SHALL NOT affect the command.

### REQ-11-008 — Explicit scope

- **AC-11-008.1** — WHEN Objetivo is selected, THE picker SHALL offer published FRDs with pending work and buildable ready/draft cards, excluding stale-suspect, closing, done and discarded cards; THE command SHALL be `/pandacorp:implement <FRD-id>` or `/pandacorp:implement change:<card-id>` respectively. Drafts SHALL explain that the session completes and validates the scope before building.
- **AC-11-008.2** — WHEN no target is selected or none is available, THE picker SHALL show an explanatory placeholder/empty state and SHALL NOT offer to copy an executable command containing `<id>`; WHEN selection is cleared, THE same state SHALL return.
- **AC-11-008.3** — WHEN a work-order detail offers construction, THE command SHALL target its parent FRD with a sentence explaining the FRD's pending scope, because the engine does not parse individual WO targets.
- **AC-11-008.4** — WHEN a building v2 card is opened, THE card action SHALL offer to resume its run, never start an unrelated build or silently drain other cards.

### REQ-11-009 — Shared Campaña entry

- **AC-11-009.1** — WHEN the Construcción phase sheet is opened, THE disclosure **Construir o reanudar** SHALL mount the same picker/command resolver as Comandos, with the selected project's identity and targets; it SHALL NOT duplicate a mode-command table.
- **AC-11-009.2** — WHEN the selected project changes or the page reloads, THE picker SHALL reset transient action/target state to Construir and SHALL NOT retain another project's target or legacy power preference.

### REQ-11-010 — Copy-only accessibility

- **AC-11-010.1** — WHEN the picker is used by keyboard, THE action group and target field SHALL have Spanish accessible names, selected-state semantics and visible focus; the command SHALL remain selectable text and its copy button SHALL name the exact current command.
- **AC-11-010.2** — WHEN rendered at phone, tablet or desktop width, THE picker SHALL use the shared card/control tokens, wrap command text without page overflow and keep the copy-only note visible. It SHALL expose no run, pause or agent-control action.

## Worked example

Comandos starts with Construir and `/pandacorp:implement`. Reanudar produces `/pandacorp:implement --resume`. Selecting Objetivo then FRD-04 produces `/pandacorp:implement FRD-04`; selecting card `mc-fix-dates` produces `/pandacorp:implement change:mc-fix-dates`. An old stored powerful preference changes none of these strings. No work-order-id command is generated.

## Scope and dependencies

Mission Control never executes the CLI or creates a card. Build detection, card validation and human gates remain session/engine responsibilities. FRD-04 owns the surrounding Comandos and Cambios surfaces; FRD-02 mounts the shared picker. FRD-25 retains workspace URLs and navigation safety; action/target selection remains transient view state. No engine schema or machine profile is written.
