---
id: WO-11-003
type: work-order
slug: build-mode-picker
title: 'WO-11-003 BuildModePicker module'
status: ACTIVE
parent: FRD-11
foundation: false
implementation_status: IN_PROGRESS
blocked_reason:
difficulty: low
reopen_count: 0
artifacts:
  - 'src/components/modules/BuildModePicker/**'
source_requirements: [REQ-11-001, REQ-11-002, REQ-11-003, REQ-11-005]
dependsOn: [WO-13-011, WO-11-001]
last_updated: 2026-10-22
---

# WO-11-003 BuildModePicker module

> **`implementation_status` is the build engine's source of truth.** `PLANNED → IN_PROGRESS → IN_REVIEW →
> VERIFIED`; never hand-set `VERIFIED` without the FRD gate passing.

## Summary

Builds the shared `BuildModePicker`: the intro line, four selectable `BuildModeCard`s (Equilibrado preselected,
then Pro, Potente, Profundo) each with its icon, tag, 1-to-4 power meter and hint, and the command box showing the
exact `/pandacorp:implement` command of the selected mode, remembered per project in the browser. It is a module
only: La Campaña (WO-02-020) and the Comandos tab (WO-11-004) mount it.

## In Scope

- `src/components/modules/BuildModePicker/BuildModePicker.tsx` (client): `BuildModePicker({ project,
  onModeChange? })` renders the catalogue intro («Con cuánta potencia se construye. Se recuerda por proyecto.»),
  a `role="group"` named «Modo de construcción» holding the four cards, and a `CommandBox` with the selected
  command (`BUILD_MODES[mode].command`; Equilibrado carries no argument). Selection writes `rememberMode(project,
  mode)` and updates the command in place; the initial selection is `getRememberedMode(project)` read through an
  external-store subscription whose server snapshot is Equilibrado (no hydration mismatch, no layout move).
- `BuildModeCard.tsx` (same folder; components.md row `BuildModeCard`, relocated to the shared module): `button`
  with `aria-pressed`, `data-mode` (the flag, empty for Equilibrado); tinted icon tile (`layers`, `clock`, `bolt`,
  `diamond`), the name in bold followed by the tag in small mono (`por defecto`, `pro`, `powerful`, `deep`), the
  four-segment meter (Equilibrado 2, Pro 1, Potente 3, Profundo 4) named «Potencia N de 4», the hint; selected =
  hue border, tinted surface, filled tile.
- Labels, tags and hints from `t()` (`workspace.comandos.buildMode` group of the catalogue); the order and the
  power values are the picker's display data (the catalog order of `BUILD_MODES` is unchanged).

## Out of Scope

- The surrounding «Modo de construcción» card, the Comandos tab and the scoped target: WO-11-004. The Campaña
  sheet's «Elegir modo de construcción» entry: WO-02-020.
- Any write outside the browser store; launching a build (copy only).
- Deleting the v1 `ModeSelector` (WO-11-004 removes it once nothing mounts it).

## Requirements & Acceptance Criteria

REQ-11-001 (four modes), REQ-11-002 (the exact command), REQ-11-003 (remembered per project), REQ-11-005.

- **AC-11-005.1** — THE Comandos tab SHALL present the four build modes as selectable cards, each with its icon, its tag (the literal command argument `pro`, `powerful` or `deep`, and "por defecto" for the default), a power meter from 1 to 4 and a hint, with Equilibrado preselected.

The module proves the criterion in isolation; WO-11-004 mounts it in the Comandos tab (its e2e covers the mounted
behaviour). The Campaña entry is AC-11-005.3, owned by WO-02-020.

**Completeness and NFRs.** Error path: a storage read or write that fails (private mode, corrupt value) falls back to
Equilibrado and never throws (the v1 store already guarantees it; test it through the picker). Accessibility: a
group of toggle buttons with `aria-pressed`, Tab reaches each, Space/Enter selects, selection shown by border, tint,
filled icon AND the command text (never colour alone), the meter has its text name, copy button named «Copiar
<comando>», 44 px touch target. Performance: no data fetch, no effect loop. Reduced motion: no animation.

## Components built (blueprint)

CMP-11-build-mode-picker, CMP-11-build-mode-card; reads IF-11-modes and IF-11-mode-store (WO-11-001). Reuse
`CommandBox` (`CmdRow`), `BadgeIcon`, `Icon`, `Toast` (copy feedback) from WO-13-011. Installs: none.

## Visual reference

- **Mock screens to reproduce:** `docs/frds/frd-11-build-modes/mocks/build-modes.html` section
  `commands-mode-powerful` (Potente selected, meter «Potencia 3 de 4», command `/pandacorp:implement powerful`)
  and the default picker inside `commands` (Equilibrado selected, `/pandacorp:implement`).
- **Prototype:** `BUILD_MODES` and `buildModePicker` in `docs/design/prototype/prototype.js`. Recorded hooks:
  `.mode-grid[role=group]`, `button.mode[aria-pressed][data-mode]`, `.mode-top`, `.mode-ico`, `.mode-tag`,
  `.mode-power` with four `i` (`.on`), `#mode-cmd`.
- **Token slice:** violet hue (`data-tone`), hairline plain cards, the tinted surface and border of the selected
  card, mono for the tag and the command, 12 px floor; grid 2 × 2 at 1280, three per row at 768, one column at 375.
- **FDD pointer:** `docs/frds/frd-11-build-modes/fdd.md` («Modo de construcción» card, States).
- **Fidelity criterion:** the picker matches the mock's mode cards and command box on the frozen tokens; checked
  when mounted (WO-11-004 preview smoke) and by the close-out fidelity diff.

## Tests

- Component tests (Vitest + RTL, `getByRole`): four cards in display order with icon, tag, meter name and hint;
  Equilibrado pressed by default and its command without argument; choosing Potente presses it, unpresses the
  previous one and shows `/pandacorp:implement powerful`; choosing Equilibrado again drops the argument; the choice
  is stored per project and restored for that project only; a failing store falls back to Equilibrado; keyboard
  selection; no hydration warning with a stored mode.
- No e2e here (no route mounts the module until W3/W6; the Comandos e2e of WO-11-004 covers it). No derogated test.

## Definition of done

- `bash .pandacorp/verify.sh --since <base>` green (knip counts the module as used through its tests).
- AC-11-005.1 met by tests that fail without the module; strings through `t()`; tokens only.

## Dependencies

WO-13-011 (W1, leaf primitives), WO-11-001 (W0, `BUILD_MODES` and the store, VERIFIED).

## Status Note
