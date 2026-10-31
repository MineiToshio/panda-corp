---
id: FRD-11
type: frd
title: FRD-11 — Per-project build modes
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-10-22'
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-11-build-modes/mocks/build-modes.html
floor: false
---
# FRD-11 — Per-project build modes

Lets you choose how much power each project is built with, and shows the command to run.

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype is the oracle: the inline `<select>` becomes a four-card mode picker (contradiction C-14 of `docs/design/freeze/reconciliation.md`). Prototype-drawn behaviours are REQ-11-005 (AC-11-005.1 to AC-11-005.3).

## Acceptance criteria (EARS)
- **REQ-11-001** — EACH project SHALL offer (in its Comandos tab) a **build mode** picker of four selectable cards (AC-11-005.1; it replaced the compact inline `<select>` of the `/pandacorp:implement` command row, which had replaced the 4-chip radio panel, owner decision 2026-06-27), with four modes:
  - **Pro** (`pro`) — 1 agent at a time, economical models (sonnet/haiku). Slower, minimal consumption. "Para el plan Pro."
  - **Equilibrado** (default, no argument; tagged "por defecto") — a team of ≤3 agents; opus lead, sonnet/haiku workers. "Por defecto, pensado para Max 5x."
  - **Potente** (`powerful`) — up to 5 agents in parallel, advances faster. "Para Max 20x."
  - **Profundo** (`deep`) — the best models across the board + extra adversarial review. For a special project.
- **REQ-11-002** — WHEN the owner chooses a mode, the **exact command to copy** SHALL be shown (`/pandacorp:implement [mode]`) with its description (agents, models, recommended plan).
- **REQ-11-003** — The chosen mode SHALL be **remembered per project**.
- **REQ-11-004** — The `/pandacorp:implement` skill SHALL accept those modes as an argument (`pro` | `powerful` | `deep`; no argument = balanced).

### REQ-11-005 — Mode cards, scoped target and Campaña entry (added 2026-10-22, design freeze)

- **AC-11-005.1** — THE Comandos tab SHALL present the four build modes as selectable cards, each with its icon, its tag (the literal command argument `pro`, `powerful` or `deep`, and "por defecto" for the default), a power meter from 1 to 4 and a hint, with Equilibrado preselected.
- **AC-11-005.2** — WHEN the owner picks a target under "Construir un objetivo concreto" (an FRD, a pending work order or a change from the queue), THE command box SHALL show `/pandacorp:implement` scoped to that target: `/pandacorp:implement <id>` for an FRD or a work order and `/pandacorp:implement change:<id>` for a queued change.
- **AC-11-005.3** — THE Construcción phase sheet in La Campaña (FRD-02) SHALL offer the same mode picker behind "Elegir modo de construcción".

**Worked example (AC-11-005.1, AC-11-005.2).** The owner opens Comandos: Equilibrado is selected and the box shows `/pandacorp:implement`. Choosing Potente shows `/pandacorp:implement powerful`. Choosing the queued change "mc-fix-dates" as the target shows `/pandacorp:implement change:mc-fix-dates`. Choosing Equilibrado again drops the mode argument.

## Edge cases
- Equilibrado is the default and carries no argument, so no mode token is appended (REQ-11-004).
- A project with no remembered mode opens with Equilibrado selected (REQ-11-003).

## Does NOT include
- Running the build: the app only shows the command to copy; the mode picker never launches `implement`.

## Future
The mode will define the **team composition** (how many agents and of what role; e.g. several frontend), and **Party** ([FRD-06](../frd-06-party/frd.md)) will show the real team that is running.

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.
