---
id: WO-11-002
type: work-order
slug: mode-selector-and-commands-tab
title: 'WO-11-002 — BuildModeSelector + Comandos tab'
status: DRAFT
parent: FRD-11
implementation_status: VERIFIED
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_components/mode-selector/**'
  - 'src/app/projects/[slug]/_components/tab-commands/**'
source_requirements: [REQ-11-001, REQ-11-002, REQ-11-003]
dependsOn: [WO-11-001, WO-04-003, WO-04-004, WO-01-005, WO-13-006, WO-13-007]
last_updated: '2026-06-19'
---
# WO-11-002 — BuildModeSelector + Comandos tab

## Goal
Re-implement the **Comandos tab** of the project workspace so it renders faithfully to the prototype
`projComandos()` (= `buildModePanel()` + `commandsBox()`) on the frozen tokens, reusing the FRD-13
foundation primitives. FRD-11 now **owns** the whole Comandos tab (`tab-commands/**`), not just the
selector slot — it is collapsed into one coarse WO with the selector.

The data layer (`BUILD_MODES` catalog in `lib/constants.ts`, `getRememberedMode`/`rememberMode` in
`lib/build-mode-store.ts`, and `workspaceCommands` in `lib/next-step.ts`) is correct and **VERIFIED** —
this WO is **presentational only**.

## Scope
- **`BuildModeSelector`** (`_components/mode-selector/**`, Client) — mirrors prototype `buildModePanel()`:
  a `Panel` with the "Modo de construcción" heading + subtitle, then a segmented `role=radiogroup` of the
  **four `BUILD_MODES`** (Pro / Equilibrado / Potente / Profundo) on the shared `Tabs`/`.stab` idiom.
  Selecting a mode persists via `rememberMode(slug, mode)` (client-local; **never** a `status.yaml`
  write) and surfaces the active mode's description + the matching **`/pandacorp:implement…`** command in
  a shared **`CmdRow`** + `CopyButton`. Initialized from `getRememberedMode(slug)` (default Equilibrado).
  It is a **read/copy-command surface — NOT a build trigger** (the dashboard is read-only; the human runs
  the command in the project folder). Active mode shown by more than color (`aria-checked`/checkmark).
- **`TabCommands` / `CommandsBox`** (`_components/tab-commands/**`, Server) — mirrors prototype
  `projComandos()` + `commandsBox()`: mounts `<BuildModeSelector slug={slug}/>` at the top, then renders
  the **stage-relevant** `/pandacorp:*` rows from `workspaceCommands(phase)` (VERIFIED lib) — each as a
  shared **`CmdRow`** with its "cuándo usarlo" description and a copy button.
- **Reuse before create** (`docs/design/components.md`): `Panel`, `Tabs` (`.stab`), `CmdRow`,
  `CopyButton`, `Toast` — no bespoke command-row, pill or panel fork.

## Acceptance criteria
- **AC-11-001.1** The selector SHALL render four modes in order: Pro/económico, Equilibrado, Potente, Profundo.
- **AC-11-001.2** EACH mode SHALL show its description (agents, models, recommended plan).
- **AC-11-001.3** The default selected mode SHALL be **Equilibrado** when none is stored.
- **AC-11-002.1** WHEN a mode is selected, its exact command SHALL be shown (`/pandacorp:implement` for
  balanced, `/pandacorp:implement pro|powerful|deep` for the others) with a copy button.
- **AC-11-002.2** The selected mode's description SHALL be shown alongside the command.
- **AC-11-003.2** Re-opening the Comandos tab SHALL restore the remembered mode (client-local, no
  factory/project write).
- **AC-04-005.1** The Comandos tab SHALL render the stage-relevant command rows from
  `workspaceCommands(phase)`, each with a copy button + "cuándo usarlo" description.
- The selector is a **copy-command affordance**, not a build trigger; active mode not by color alone.
- Rendered output matches `projComandos()` / `buildModePanel()` / `commandsBox()` on the frozen tokens;
  the browser fidelity/smoke gate is clean.

## Dependencies
- **Foundation (FRD-13):** WO-13-006 (`Tabs`), WO-13-007 (`Panel`/`CmdRow`/`Button`/`Toast`).
- **Intra (FRD-11):** WO-11-001 (`BUILD_MODES`, `DEFAULT_BUILD_MODE`, `getRememberedMode`,
  `rememberMode`) — VERIFIED lib.
- **Cross-FRD:** `frd-13` (foundation primitives), `frd-04` (Comandos tab mounts into the workspace via
  the Tabbar shell seam; `workspaceCommands` lives in the FRD-04 VERIFIED lib `lib/next-step.ts`).

## Visual reference
`docs/design/prototype/index.html` → `projComandos()` (~L807), `buildModePanel()` (~L801),
`commandsBox()` (~L729), `cmdRow()` (~L570), `BUILDMODES` (~L795), on the frozen tokens. Fidelity, not
novelty (DR-056) — see `../fdd.md`.

## Status Note

**Built:** `ModeSelector` (Client Component) and `TabCommands` + `CommandsBox` (Server Components),
repainted to match the prototype `projComandos()` = `buildModePanel()` + `commandsBox()` structure
on the frozen tokens. Preview route at `/preview-wo11002` for visual inspection.

**Interfaces/contracts exposed:**

- `ModeSelector({ slug: string })` — `src/app/projects/[slug]/_components/mode-selector/mode-selector.tsx`
  - Root: `<section data-testid="mode-selector-slot" aria-label="Modo de construcción">`
  - Reads `getRememberedMode(slug)` on mount; writes `rememberMode(slug, mode)` on change
  - Renders `<Panel>` → heading + subtitle + `role="radiogroup"` chip row → active description → `<CmdRow command={…} />`
  - Each chip: `<label data-testid="mode-option-{id}">` wrapping hidden `<input type="radio" name="build-mode-{slug}" aria-checked>` + visible checkmark `<span data-testid="mode-check-{id}">` + `<span data-testid="mode-description-{id}">`
  - Active description: `<p data-testid="mode-active-description">`
  - Command row wrapper: `<div data-testid="mode-command-row">` containing `<CmdRow />`

- `TabCommands({ phase: Phase, slug: string })` — `src/app/projects/[slug]/_components/tab-commands/tab-commands.tsx`
  - Root: `<main data-testid="tab-commands-body">`
  - Renders `<ModeSelector slug={slug} />` then `<CommandsBox phase={phase} />`
  - `CommandsBox` root: `<Panel>` with heading `<p data-testid="tab-commands-heading">Comandos a la mano</p>` and `<ul data-testid="commands-list">` of `<li data-testid="command-row">` items, each containing `<CmdRow />` + `<p data-testid="command-row-description">` + `<span data-testid="command-row-command" aria-hidden>`

**DR-057 reuse:** `Panel` (data-testid="panel") and `CmdRow` (data-testid="cmd-row") shared primitives used throughout — no bespoke forks. `CopyButton` (data-testid="copy-button") is inside `CmdRow`.

**Implicit decisions / naming conventions:**
- Mode chip pattern: `<label>` (not `<button role="radio">`) wrapping a visually-hidden `<input type="radio">` — avoids duplicate role="radio" count (8 vs expected 4) when stab chip also carries the role. The `<label>` itself is styled as the stab chip.
- `mode-command-text` and `mode-command-copy` testids were **removed** — replaced by `cmd-row` (DR-057). All tests updated to assert via `getByTestId("cmd-row")` and `getByTestId("copy-button")`.
- `mode-active-description` is a **sibling** of `mode-command-row` inside the Panel, not nested inside it. Tests updated accordingly.
- `command-row-command` testid preserved as a hidden `<span aria-hidden>` for backward compat with any consumer querying it.
- `fieldset` with `display: "contents"` wraps the chips inside the radiogroup div — gives AT a named group without adding layout.
- COPY strings (mode labels, descriptions, subtitle) are defined in a module-level `COPY` const — the canonical Spanish strings live there, not in constants.ts.

**Test files:**
- `src/app/projects/[slug]/_components/mode-selector/_tests/mode-selector.test.tsx` — AC-11-001.x / AC-11-002.x / AC-11-003.2 / a11y / design-token invariants
- `src/app/projects/[slug]/_components/mode-selector/_tests/mode-selector.fidelity.test.tsx` — DR-056/057 structural fidelity (Panel + CmdRow reuse, prototype structure)
- `src/app/projects/[slug]/_components/mode-selector/_tests/mode-selector.reviewer.test.tsx` — adversarial (catalog drift, clipboard exact value, per-project isolation, corrupt storage)
- `src/app/projects/[slug]/_components/tab-commands/_tests/tab-commands.test.tsx` — AC-04-005.x / phase-by-phase rows / a11y invariants
- `src/app/projects/[slug]/_components/tab-commands/_tests/tab-commands.fidelity.test.tsx` — DR-056/057 fidelity (Panel + CmdRow in CommandsBox, projComandos layout)
