---
id: FDD-04
type: fdd
title: FDD-04 — Project workspace (feature design)
parent: frds/frd-04-project-workspace/frd.md
ui: true
visual_source: docs/design/prototype/index.html
status: ACTIVE
last_updated: '2026-06-19'
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

`projectPane(i)` renders, top → bottom, inside the right column of the portfolio:

1. **Header `.panel`** (`padding 12px 16px`) — the project title (18px/500, with a live
   `ti-player-play` `var(--ok)` pip when running), a right cluster with the **status chip**
   (`chip2()`) + version, the `progreso` line below, and the **"Objetivos de la misión" bar**
   (`progressBar()`): a labelled `ti-sword` row + a thin accent (or `var(--ok)` at 100%) bar of
   `done / tot · pct%` work orders. The header is visible on **all tabs**.
2. **Snapshot banner** (`snapshotPanel()`, conditional) — when a green build snapshot exists: a `.panel`
   with `ti-circle-check` `var(--ok)`, the last-probable-green FRD + "verde" chip, the commit sha, and a
   copyable `git worktree add …` command to test it in another folder without stopping the build.
3. **Subtabs** — a flex-wrap row of `.stab` pills in this order: **Resumen · Work orders · Party ·
   Documentos · Comandos** (Commands last, contextual). Active pill = `.stab.on`.
4. **Tab body** — switched by `ST.projectTab`:
   - **Resumen** (`projResumen`) — a doc `.panel` (Resumen + Puntos clave list), then
     **Puntos de decisión** (`decisionesBox()`) and the **Actividad** log (`logBox()`).
   - **Work orders** — `projWO()` (FDD-05).
   - **Party** — `missionBody()` (FDD-06).
   - **Documentos** (`projDocs`) — a 200px `.navitem` doc-nav `.panel` + a rendered-markdown `.panel doc`.
   - **Comandos** (`projComandos`) — `buildModePanel()` + `commandsBox()`.

## 2. Components used (all on the frozen tokens / PDD)

| On screen | Component (see `docs/design/components.md`) | Notes |
|---|---|---|
| Header / section containers | `Panel` (`.panel`) | app-wide RPG-skinned surface |
| Status / version / "verde" pills | `Chip` | ok-bg / info-bg variants (`chip2`, `frdChip`) |
| Mission-objectives bar | `ProgressBar` | accent fill, `var(--ok)` at 100%; `done/tot · pct%` |
| Green-snapshot banner | `Banner` | ok-accented `.panel` + copyable `git worktree` `CommandChip` |
| Subtab switcher | `SubTabs` (`.stab`) | Resumen · Work orders · Party · Documentos · Comandos; `.on` active |
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
  card carrying the AI recommendation + an "Aprobar la recomendación" copy button and the
  `/pandacorp:decide` command (`AC`: "WHEN there are pending decisions, it SHALL highlight them").
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
