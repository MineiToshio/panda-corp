---
id: FRD-03
type: frd
title: FRD-03 — Portfolio and project navigation
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-03-portfolio/mocks/portfolio.html
last_updated: '2026-10-22'
---
# FRD-03 — Portfolio and project navigation

Overview of every project (cards or list), a global accounts directory as a third view, and navigation into one project's workspace. The interface calls this surface "Portafolio".

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype is the oracle. The rail-and-panel layout is replaced by an overview of all projects (contradiction C-06 of `docs/design/freeze/reconciliation.md`); items the owner left out of v2 stay in place, prefixed **Out of v2**; the prototype-drawn behaviours are REQ-03-008.

## Portfolio membership (the rule)
The Portafolio overview lists **every** project, whatever its phase (`product`, `design`, `architecture`, `implementation`, `release`), ordered by last commit; each card carries its phase chip. (Amended 2026-10-22: the earlier rule that listed only `building` and `shipped` projects belonged to the left rail, which no longer exists.) A re-versioned project that returns to `implementation` stays listed with the Construcción phase.

## Acceptance criteria (EARS)
- **REQ-03-001** — The Portafolio SHALL show an overview of ALL projects, as cards (default) or as a list (REQ-03-008), and SHALL list each project once whatever its phase. The sidebar (FRD-19) lists the five most recent projects.
- **REQ-03-002** — WHEN a project is re-versioned and returns to `implementation` (building), its card SHALL show the Construcción phase chip and keep its place in the overview.
- **REQ-03-003** — EACH project card SHALL show its title, its phase and an indicator: "Construyendo" if `running`. **Out of v2 (owner decision 2026-10-21):** a "stopped" indicator on rows when it is not running; in v2 the header says "Sin construcción activa" while no project is building.
- **REQ-03-004** — **Out of v2 (owner decision 2026-10-21):** EACH project row SHALL show a **pending-decisions count badge** when it has unresolved decisions (count > 0) and a **bugs count badge** when it has bugs awaiting processing (count > 0), so the owner sees what needs attention without opening the workspace. In v2 the rail rows no longer exist; the decisions count is the "Decisiones" column of the Lista view (AC-03-008.2).
- **REQ-03-005** — WHEN the owner selects a project (a card, a Lista row, a sidebar entry or the picker, AC-03-008.3), the system SHALL show its workspace (FRD-04) taking the full content width.
- **REQ-03-006** — WHEN no project is selected, the system SHALL show the overview of all projects (cards by default), not a default project's workspace.
- **REQ-03-007** — WHEN a project has a last-change date, the system SHALL show the relative time since it in Spanish: on the overview cards "hace N h" for under a day ("hace 1 h", "hace 43 h"), and in the project header "último movimiento" as "hoy", "ayer", "hace N días", "hace N meses". The date comes from the project's last commit (amended 2026-10-22; it replaced the portfolio `last sync` date). **Out of v2 (owner decision 2026-10-21):** the explicit invalid-date chip for an unparseable date (WO-03-006).
- IF there are no projects, THEN the system SHALL show a designed empty state in the Portafolio: a first-action message with the command that starts a first project, never a blank page (state `factory-empty`, M1 2026-10-22).
- IF a project's local path does not exist on disk (folder deleted or moved), the system SHALL show a "Ruta no encontrada" chip on the project card (state `portfolio-path-missing`, M1 2026-10-22; replaces the `⚠️ path not found` badge on the rail row).
  - IF the project has a `repo:` URL in the portfolio, the system SHALL show the recovery command: `git clone <repo> <path>` then re-run `/pandacorp:sync-portfolio` (copyable text, same shape as FRD-15/16 banners).
  - IF there is no `repo:`, the system SHALL show a warning: "Sin remoto registrado: revisa una copia local o recréalo con `/pandacorp:spec`." (Spanish wording proposed 2026-10-22 for the English original "No remote registered; check a local backup or recreate with `/pandacorp:spec`"; the copy owner confirms it when the `portfolio-path-missing` state is drawn.)
  - The detection is **read-only**: the app never clones, writes to the portfolio, or calls Claude.
  - The chip disappears once the path exists on disk again (detected on next read/sync).

### REQ-03-008 — Overview cards, list view and project picker (added 2026-10-22, design freeze)

- **AC-03-008.1** — THE Portafolio overview SHALL show one card per project, ordered by last commit, each with the project avatar, its phase chip, a six-segment stepper with a tooltip per phase, a progress ring of verified work orders with its tooltip, "Etapa N de 6 del pipeline · último cambio hace …", its counts, and "Siguiente · `<command>`" (the next command, FRD-18 REQ-18-021).
- **AC-03-008.2** — WHEN the owner picks "Lista" in the Tarjetas / Lista switch, THE system SHALL show a comparison table (Fase, FRDs, Docs, ADRs, Cambios abiertos, Decisiones) instead of the cards, SHALL keep the choice in the URL (`view=lista`), and SHALL render one card per row below 1024 px.
- **AC-03-008.3** — WHEN the owner activates "Cambiar de proyecto", THE system SHALL open a dialog (kicker "Portafolio") with a searchable list of projects, in the same order as the overview (last commit first).

**Worked example (AC-03-008.2).** Funko Tracker is building, its last commit was 1 h ago, with 2 open changes and 1 pending decision. In Tarjetas its card reads "Etapa 5 de 6 del pipeline · último cambio hace 1 h". In Lista the same project is one row: Fase "Construcción", Cambios abiertos 2, Decisiones 1. At 768 px the row becomes a card.

## Edge cases
- Project whose folder is missing → "Ruta no encontrada" chip with the recovery command or the no-remote warning, the rest of its card intact (state `portfolio-path-missing`).
- No projects at all → the empty state with the first-action command (state `factory-empty`); the Cuentas view still opens (REQ-03-009).

## Out of scope / Future
- **Per-project business snapshot (deferred).** Showing each `shipped` project's business snapshot (active users / return metric / last review verdict from `/pandacorp:review-launch`, DR-043) is **out of scope for now**: it is premature (no deployed, monetizing projects yet, so the metrics are undefined) and would render empty. When sellable products are live, the snapshot returns — sourced from PostHog (product telemetry) for monetary/mixed projects. The overview keeps space for it conceptually but renders nothing today.

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.


## Global account directory extension (2026-10-20, amended 2026-10-22)

- **REQ-03-009** — The Portafolio SHALL offer the global accounts directory as a third view, "Cuentas", beside Tarjetas and Lista, reusing the Cuentas table of the project workspace plus a search, a state filter and a row dialog (state `portfolio-accounts`, owner decision at M1 2026-10-22). Cuentas works with no project selected and with an empty portfolio; `portfolioView=accounts` preserves the chosen project workspace and history. FRD-26 owns the reader, filtering and private/public boundaries.
