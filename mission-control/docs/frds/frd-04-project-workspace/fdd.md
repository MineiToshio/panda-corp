---
id: FDD-04
type: fdd
title: FDD-04 — Project workspace (feature design)
parent: frds/frd-04-project-workspace/frd.md
ui: true
visual_source: docs/design/prototype/index.html
status: ACTIVE
last_updated: '2026-10-17'
---
# FDD-04 — Project workspace (feature design)

The feature's design **on the frozen tokens** (`docs/design/design-tokens.json`, root `DESIGN.md`),
sharded from the owner-approved whole-app prototype. **Fidelity, not novelty**: this describes the
project workspace exactly as the prototype renders it, mapped to the frozen design system and to
FRD-04's acceptance criteria.

- **Visual source:** `docs/design/prototype/index.html` — render functions **`projectPane()`** (the
  header + subtabs shell), **`projResumen()`** (Summary tab, with `decisionesBox()` + `logBox()`),
  **`buildModePanel()`** + **`commandsBox()`** (Commands tab), **`projDocs()`** (Documents tab),
  **`progressBar()`** and **`snapshotPanel()`** (header objectives + green-snapshot banner). The
  **Work orders** tab is FDD-05 and the **Party** tab is FDD-06 — referenced, not redefined here.
- The build's visual-fidelity gate captures the baseline from the `portfolio` view of `index.html`
  with a project selected (see `mocks/README.md`).

> The design contract (palette, typography, surfaces, the app-wide RPG skin) is the **global PDD** —
> not redefined here. Every value named below resolves to a token, never a hardcoded literal.

## 1. Layout

The portfolio's selected-project pane and `/projects/<slug>` use one tabs-first workspace:

1. A compact project header with the project H1, stage/version and thin work-order progress; it remains visible across tabs. Detailed overview and Mission Objectives live within **Resumen**.
2. A reachable shared `Tabs` row in this exact order: **Resumen · Spec · Work orders · Arquitectura · Cambios · Party · Observabilidad · Documentos · Comandos · Cuentas**. Default is Resumen; `tab=architecture` selects Arquitectura while retaining the current project.
3. Selected content: Resumen (summary, decisions and activity), Spec (complete shared PRD/research/FRD overview), Work orders (FDD-05), Arquitectura (the complete shared `ArchitectureDigest`, FDD-02 §12), Cambios (queue/detail modal), Party (FDD-06), Observabilidad (FDD-12), Documentos (nav/reader) or Comandos (FRD-11 selector and command rows).

The Architecture tab sits immediately after Work orders. It preserves **Modelo de datos** inside the complete Architecture surface, using the compact shared **Diagrama / Esquema** viewer; it is never a database-only tab. Its scoped visual reference is `docs/design/prototype/data-model-viewer/index.html` (round 2), layered onto the whole-app visual source. All model interaction/dimensions/states in [FDD-02 §12](../frd-02-ideas-board/fdd.md#12-shared-architecture--logical-model-2026-10-16) apply identically here.

## 2. Components used (all on the frozen tokens / PDD)

| On screen | Component (see `docs/design/components.md`) | Notes |
|---|---|---|
| Header / section containers | `Panel` (`.panel`) | app-wide RPG-skinned surface |
| Status / version / "verde" pills | `Chip` | ok-bg / info-bg variants (`chip2`, `frdChip`) |
| Mission-objectives bar | `ProgressBar` | accent fill, `var(--ok)` at 100%; `done/tot · pct%` |
| Green-snapshot banner | `Banner` | ok-accented `.panel` + copyable `git worktree` `CommandChip` |
| Subtab switcher | `SubTabs` (`.stab`) | Resumen · Spec · Work orders · Arquitectura · Cambios · Party · Observabilidad · Documentos · Comandos · Cuentas; `.on` active |
| Decision points | `DecisionCard` (`decisionesBox`) | warn-bg cards, AI recommendation, `/pandacorp:decide` command |
| Activity log | `ActivityLog` (`logBox`) | dotted-rule rows of high-level AI activity |
| Build-mode selector | `BuildModeSelector` (`.stab` group, FRD-11) | 4 modes; surfaces the matching `/pandacorp:implement…` command |
| Commands at hand | `CommandsBox` | stage-relevant `/pandacorp:*` `CommandChip` rows |
| Docs nav + rendered doc | `DocNav` (`.navitem`) + `DocView` (`.panel.doc`) | 200px nav rail + markdown body |
| Copyable command | `CommandChip` (`.cmd`) + `Toast` | mono command + copy |

`SubTabs` (`.stab`) is the project-scoped tab primitive — distinct from the top-nav `.tab`; reuse it,
don't fork. `BuildModeSelector` and the Party/Work-orders tab bodies are owned by FRD-11 / FRD-06 /
FRD-05; this FDD only places them in the tab shell.

## 3. States

- **Decisions present** — `decisionesBox()` highlights pending decisions with a warn count chip, each
  card carrying the AI recommendation as context and the scoped
  `/pandacorp:decide <id>` command (no one-click recommendation approval) (`AC`: "WHEN there are pending decisions, it SHALL highlight them").
- **Empty** — no decisions → the calm "Sin puntos pendientes" `.panel`; no activity → "Aún sin actividad
  registrada"; no work orders → the bar/`projWO` empty message (FDD-05).
- **Loading** — the Next.js build streams the header + active tab; tab bodies read project state under
  their own boundary. No skeleton for content the server already delivers.
- **Error** — a tab whose source fails to read renders an inline `Banner` naming the source, not a blank
  panel; the header still renders (segment `error.tsx`).

## 4. Demo-only controls (DR-061)

The **build-mode selector** (`buildModePanel()`, FRD-11) lets the operator pick Pro / Equilibrado /
Potente / Profundo. In the read-only app this is **not** a live build switch — it only changes which
`/pandacorp:implement…` command the box surfaces to copy and run in the project folder. The selector
itself is a real preference/affordance (it picks the displayed command), so it stays in the real UI;
but the build must make clear (as the prototype's copy already does) that **changing the mode here does
not start or reconfigure a build** — it only updates the copyable command. The currently-selected mode
is real surfaced data (the command), not a hidden demo value. No other workspace control is demo-only.

Workspace integration contains Architecture’s existing full-bleed bands horizontally inside its selected-project pane, including when the portfolio rail makes that pane asymmetric. Board rendering retains its original full-bleed presentation.

## Shared Spec presentation (2026-10-16)

Spec sits between Resumen and Work orders. Reuse the board's existing Spec visual source and full `SpecDigest`: hero/meta chips, PRD blocks, Research blocks and compact FRD cards with their existing focus/Escape/return-focus modal. Source: FDD-02's Spec contract and the existing board Spec prototype; this extension changes placement, not that component's visual language. Clip full-bleed bands to the Portfolio pane horizontally, preserving text/control usability at narrow widths. Retain the ten-tab navigation and explicit pending message without a digest. Known markdown targets open Documents in the selected project, external URLs open separately and unsupported relative links become text.


## Shared modal focus — 2026-10-16

Spec FRD details use the shared Modal. On dismissal, return keyboard focus to the connected FRD-card opener; project changes discard the old modal/opener.


## Shared model readability correction — 2026-10-16

Reuse the same FRD-02 AC-02-015.1–.14 viewer: content-sized full-text entity cards, compact layered orthogonal field-port routing, a readable centered starting entity and a diagram-only full-browser expansion. No lower relationship inspector/list. The inline designed-model provenance remains; the full-window view contains only graph and compact floating controls. No project/build machine-status changes.

The shared model viewer now follows the owner-selected dependency-map navigation design (ADR-0008): native browser fullscreen first with full-window fallback, one top-right GraphControls icon toolbar, separate search, actual opener restoration and frame-batched zoom/pan. This same implementation is reused in embedded Portfolio and direct project Architecture, without changing tab order or source ownership.

## Shared usability amendment — 2026-10-17

The same complete Architecture now orders Stack (choices/why), Integraciones y operación (authored flows/tasks), Modelo de datos, then environment variables, ADRs and plan. Reuse FRD-02 AC-02-015.1–.14: repeated relationship click clears selection, diagram cards prevent text selection while schema code permits it, and the single-column schema opens with all entities collapsed and allows one expanded entity at a time. Shared Spec/Architecture panels fill their host; prose alone retains readable line lengths. Portfolio and direct-project behavior remain identical, with no new database-only tab or data source. ADR-0009 records the current design.

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.
