---
id: FRD-11-blueprint
type: blueprint
slug: build-modes
title: FRD-11 Per-project build modes feature blueprint, v2 Órbita
status: ACTIVE
parent: FRD-11
implementation_status: PLANNED
readiness_gate: passed 2026-10-22
grounding_gate: passed 2026-10-22
consistency_gate: passed 2026-10-22
last_updated: 2026-10-22
---
# FRD-11 — Per-project build modes · feature blueprint (v2 «Órbita»)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> Per-FRD blueprint (DR-049) on top of [`../../product/architecture.md`](../../product/architecture.md) (§6: the
> `command-modes` module and the browser-local mode store; §7: the read-only invariant). Binding visual spec:
> [`fdd.md`](fdd.md) + [`mocks/build-modes.html`](mocks/build-modes.html). Cross-FRD plan:
> `.pandacorp/run/architecture/wo-map.md` (§2 FRD-11, §6.C item 14).

## Purpose

FRD-11 lets the owner choose how much power a project's build uses and copy the exact command. In v2 the inline
mode `<select>` becomes a picker of four selectable cards (`BuildModePicker`), offered in the project's
**Comandos** tab (with the scoped-target command) and in La Campaña's Construcción phase sheet (FRD-02, behind
«Elegir modo de construcción»). The choice is remembered per project in the browser; Mission Control never runs a
command. The `/pandacorp:implement` skill accepting the modes (REQ-11-004) is the factory plugin's; MC only shows
the matching command string.

## Components & Interfaces

| ID | Kind | Name · location | Responsibility | Traces |
|---|---|---|---|---|
| CMP-11-build-mode-picker | client | `BuildModePicker` · `src/components/modules/BuildModePicker/BuildModePicker.tsx` | The intro line, a `role="group"` named «Modo de construcción» of four `BuildModeCard`s in the order Equilibrado, Pro, Potente, Profundo, and the `CommandBox` with the selected mode's command (`/pandacorp:implement` with no argument for Equilibrado). Reads and writes the per-project choice through the v1 store; Equilibrado when nothing is stored or the read fails. Consumers mount it inside their own `Card`. | REQ-11-001, REQ-11-002, REQ-11-003, REQ-11-005 |
| CMP-11-build-mode-card | client | `BuildModeCard` · same folder (components.md row relocated from `_components/BuildModeCard.tsx`: the picker is shared by two routes, so it lives in `components/modules`) | `button.mode` with `aria-pressed`: tinted icon tile (filled when selected), bold name and its tag (`por defecto`, `pro`, `powerful`, `deep` in small mono), the four-segment power meter named «Potencia N de 4», the hint; selected = hue border + tinted surface. | REQ-11-001, REQ-11-005 |
| CMP-11-comandos-panel | RSC | `ComandosPanel` · `src/app/projects/[slug]/_panels/ComandosPanel.tsx` (stub by WO-04-010, rewritten here) | Takes the phase and the next step from FRD-04's `WorkspaceProject` (one resolver with the Resumen), adds `workspaceCommands(phase)` deduped, loads the FRD index, the pending work orders and the queued changes; renders `TabCommands`. | REQ-11-001, REQ-11-005 |
| CMP-11-tab-commands | RSC + client island | `TabCommands` (restyled in place, `src/app/projects/[slug]/_components/tab-commands/`) + `BuildTargetPicker` (same folder) | Two columns from 1024 px (left: «Siguiente paso», «Modo de construcción» hosting the picker; right: «Construir un objetivo concreto», «Cambios y decisiones»), one column below with the actionable cards first; the target `SelectField` «Objetivo del build» (FRDs, pending work orders, queued changes) and its `CommandBox` (`/pandacorp:implement <id>` placeholder until a target is chosen, then `<FRD-NN>` / `<WO-NN-MMM>` / `change:<id>`); the three change-and-decision commands and the read-only note. | REQ-11-002, REQ-11-005 |
| IF-11-modes | lib | `BUILD_MODES`, `DEFAULT_BUILD_MODE` · `src/lib/constants.ts` (WO-11-001, unchanged) | The four modes and their exact commands; the picker's display order is its own. | REQ-11-001, REQ-11-002, REQ-11-004 |
| IF-11-mode-store | client lib | `getRememberedMode`, `rememberMode` · `src/lib/build-mode-store.ts` (WO-11-001, unchanged) | Per-project browser preference (never a factory write); default on any read error. | REQ-11-003 |

Reuse: `CommandBox` (`CmdRow`), `BadgeIcon`, `Icon`, `SelectField`, `Toast` (copy feedback) from WO-13-011; `Card` /
`CardHeader` from WO-13-012 (consumers); `t()` copy (`workspace.comandos.*`). The FRD labels come from the FRD index
of WO-12-007 (one resolver for «FRD-NN · title»).

## Contracts

- `BuildModePicker({ project, onModeChange? })`: `project` is the slug used as the store key; `onModeChange` lets a
  host react (optional; the picker renders its own command box). Rendered with Equilibrado on the server and
  reconciled to the remembered mode without a hydration mismatch (the store is read through an external-store
  subscription whose server snapshot is the default). Selecting a card writes the store and updates the command in
  place; no layout moves (FDD Responsive).
- `ComandosPanel({ project, route }: PanelProps)` (FRD-04 §0.3 contract). The target selection is view state only
  (no FRD-25 key is defined for it, and the captured `commands-target-scoped` state is reached by interaction);
  it resets on reload.
- Target options: one per FRD with work orders («FRD-NN · title»), one per work order not yet verified
  («WO-NN-MMM · title»), one per queued change whose status is ready, draft or building («Cambio · title», value
  `change:<id>`); the command never carries the mode argument (FRD worked example).
- Read errors: the change queue's unreadable files are skipped here (the Cambios tab is their fail-loud surface);
  a missing phase shows the catalogue's no-phase-commands sentence in «Siguiente paso».

## Visual spec (DR-054)

| WO | Reproduce | Oracle states | Recorded hooks |
|---|---|---|---|
| WO-11-003 | [`fdd.md`](fdd.md) «Modo de construcción» card, [`mocks/build-modes.html`](mocks/build-modes.html) | `commands-mode-powerful` (and the default selection in `commands`) | `.mode-grid[role=group]`, `button.mode[aria-pressed][data-mode]`, `.mode-top`, `.mode-ico`, `.mode-tag`, `.mode-power i.on`, `#mode-cmd` |
| WO-11-004 | [`fdd.md`](fdd.md) Screens, «Construir un objetivo concreto», States | `commands`, `commands-target-scoped` | `.grid-2.cmd-page`, `#cmd-target`, `.cmd-step`, `.cmd-l`, `.cmd` |

Prototype reference: `BUILD_MODES`, `buildModePicker`, `commandsView` in `docs/design/prototype/prototype.js`. Token
slice: violet hue for the mode card and its card header, teal for the target card, pink for changes, hairline
plain cards, mono for commands only, 12 px floor; icons `layers`, `clock`, `bolt`, `diamond`, `target`, `branch`,
`flag`, `rocket`, `terminal`, `copy`. Grid 2 × 2 at 1280, three per row at 768 (the fourth wraps), one column at 375.

## Dependencies & Risks

- WO-11-003 needs only the leaf primitives (WO-13-011) and the v1 store (WO-11-001), so it builds early (W2): La
  Campaña (WO-02-020, W3) and Comandos (WO-11-004, W6) both mount it.
- WO-11-004 waits for the workspace frame (WO-04-010) and uses WO-12-007's FRD index.
- Risk: the v1 `ModeSelector` and its reviewer test are deleted in WO-11-004 (map §3.3: the subject module is
  gone, `git rm`); the FRD-11 gate reviewer re-blesses the `TabCommands` reviewer tests. The `mode-selector-slot`
  test id stays on the «Modo de construcción» card so the page-level seam assertion keeps resolving.

## Traceability

| REQ | Components / interfaces | Live ACs → owner |
|---|---|---|
| REQ-11-001 | CMP-11-build-mode-picker, CMP-11-build-mode-card, IF-11-modes | — |
| REQ-11-002 | CMP-11-build-mode-picker (command box), CMP-11-tab-commands | — |
| REQ-11-003 | IF-11-mode-store, CMP-11-build-mode-picker | — |
| REQ-11-004 | IF-11-modes (the command strings MC shows; the skill itself is the plugin's) | — |
| REQ-11-005 | CMP-11-build-mode-picker, CMP-11-tab-commands, CMP-11-comandos-panel | AC-11-005.1 → WO-11-003 · AC-11-005.2 → WO-11-004 · AC-11-005.3 → WO-02-020 (the Campaña phase sheet mounts the picker) |

## Build Plan

> The build engine reads this table; it matches each work order's frontmatter exactly.

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-11-001 | — | `src/lib/constants.ts`, `src/lib/build-mode-store.ts`, `src/lib/_tests/build-modes.test.ts`, `src/lib/_tests/build-modes.adversarial.test.ts` | false | W0 (legacy, VERIFIED, never rebuilt) |
| WO-11-003 | WO-13-011, WO-11-001 | `src/components/modules/BuildModePicker/**` | false | W2 · with WO-13-012, WO-01-010 |
| WO-11-004 | WO-04-010, WO-11-003, WO-12-007 | `src/app/projects/[slug]/_panels/ComandosPanel.tsx`, `src/app/projects/[slug]/_components/{tab-commands,mode-selector}/**`, `e2e/commands.spec.ts` | false | W6 · with WO-05-008, WO-05-009 and the other W6 panels |

- **Order:** WO-11-001 is VERIFIED history; WO-11-003 builds in W2 (module only, unit-tested, mounted later);
  WO-11-004 in W6 replaces the Comandos tab body and removes the v1 selector.
- **Disjoint by design:** WO-11-003 writes only its module folder (W2 neighbours write `core/{composite}` and
  `lib/{clock,git,config}`); WO-11-004 writes only its panel file, the two `_components` folders and its e2e spec.
- **Cross-FRD:** WO-02-020 (W3) mounts the picker in La Campaña (owner of AC-11-005.3).

## Reconciliation (2026-10-22, binding)

- WO-11-004's «Siguiente paso» reads `WorkspaceProject.phase` / `.nextStep` (WO-04-010), never its own
  derivation; it deletes `_components/mode-selector/**`, the last product consumer of `IMPLEMENT_MODES`, whose
  export WO-13-013 removes in W7; it consumes `readChangeQueue()`'s stable `id` / `title` / `status` (WO-04-012,
  same wave) and renders no `<main>`.
- WO-11-004 also carries FRD-04 REQ-04-006 as the oracle's `commandsView` draws it: «Construir un objetivo
  concreto» in every phase (not gated by phase), change / decide / new-version in «Cambios y decisiones», the
  phase-dependent commands only in «Siguiente paso». The v1 REQ-04-006 wording (implement and change only in
  `implementation` / `release`, a CommandsBox below the picker) is the retired v1 layout; the PM amends
  REQ-04-006 to the drawn layout (gate finding B6).

## Superseded (v1 history)

- WO-11-002 BuildModeSelector + Comandos tab · superseded by WO-11-003 and WO-11-004.

## Readiness check (DR-100)

Every REQ-11-MMM maps to a component or interface; each live criterion (AC-11-005.1 to .3) is owned by exactly one
work order; `dependsOn` names only live work orders; same-wave artifacts are disjoint; no open clarification marker
survives; no API contract (no route change).

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.
