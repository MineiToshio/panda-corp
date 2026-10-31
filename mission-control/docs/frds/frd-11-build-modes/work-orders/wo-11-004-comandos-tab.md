---
id: WO-11-004
type: work-order
slug: comandos-tab
title: 'WO-11-004 Comandos tab'
status: ACTIVE
parent: FRD-11
foundation: false
implementation_status: VERIFIED
difficulty: medium
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_panels/ComandosPanel.tsx'
  - 'src/app/projects/[slug]/_components/{tab-commands,mode-selector}/**'
  - 'e2e/commands.spec.ts'
source_requirements: [REQ-11-001, REQ-11-002, REQ-11-003, REQ-11-004, REQ-11-005, REQ-04-006]
dependsOn: [WO-04-010, WO-11-003, WO-12-007]
last_updated: 2026-10-31
---

# WO-11-004 Comandos tab

> **`implementation_status` is the build engine's source of truth.** `PLANNED → IN_PROGRESS → IN_REVIEW →
> VERIFIED`; never hand-set `VERIFIED` without the FRD gate passing.

## Summary

Rebuilds the project's Comandos tab in Órbita: «Siguiente paso» with the phase's commands, «Modo de construcción»
hosting the shared `BuildModePicker`, «Construir un objetivo concreto» where picking an FRD, a pending work order or
a queued change scopes `/pandacorp:implement` to it, and «Cambios y decisiones» with its three commands and the
copy-only note. It removes the v1 inline mode `<select>` (`ModeSelector`).

## In Scope

- **`ComandosPanel`** (`src/app/projects/[slug]/_panels/ComandosPanel.tsx`, async Server Component, rewrites
  WO-04-010's adapter, `PanelProps` unchanged): takes the phase and the next step from `project` (FRD-04's
  `WorkspaceProject.phase` / `.nextStep`, the one resolver the Resumen also reads, DR-115) followed by
  `workspaceCommands(phase)` deduped by command, and loads the FRD index (WO-12-007), the work orders not yet
  verified (`listWorkOrders`), and the queued changes with status ready, draft or building (`readChangeQueue`,
  read-only), and renders `TabCommands`.
- **`TabCommands`** (restyled in place in `_components/tab-commands/`, export kept with type-compatible props, new
  data props optional): the `grid-2` layout, two columns from 1024 px (left «Siguiente paso» then «Modo de
  construcción»; right «Construir un objetivo concreto» then «Cambios y decisiones»), one column below with the
  actionable cards first; each a `Card` with the shared `CardHeader` (tinted icon tile, one-size title).
  - «Siguiente paso»: per command its «when» line and `CommandBox`; the catalogue's no-phase-commands sentence when
    there is none.
  - «Modo de construcción»: the `BuildModePicker` (WO-11-003) for this project; the container keeps the
    `mode-selector-slot` test id (page-level seam).
  - «Construir un objetivo concreto» (`BuildTargetPicker`, client island in the same folder): the intro, the
    `SelectField` named «Objetivo del build» with the placeholder «Elige un FRD o work order…», then one option per
    FRD («FRD-NN · title»), per pending work order («WO-NN-MMM · title») and per queued change («Cambio · title»,
    value `change:<id>`), and a `CommandBox` reading `/pandacorp:implement <id>` until a target is chosen, then
    `/pandacorp:implement FRD-NN`, `/pandacorp:implement WO-NN-MMM` or `/pandacorp:implement change:<id>` (never
    the mode argument). Clearing the select returns to the placeholder. The selection is view state (no URL key).
  - «Cambios y decisiones»: the three steps «Pedir un cambio o un bug» `/pandacorp:change`, «Responder una
    decisión pendiente» `/pandacorp:decide`, «Paquete grande o rediseño» `/pandacorp:new-version`, and the note
    «Los comandos se copian para pegarlos en Claude Code. Mission Control nunca los ejecuta.».
- **Removal (map §6.C item 14):** `_components/mode-selector/**` (`ModeSelector`, the inline mode `<select>` /
  radio chip row), the v1 «Comandos a la mano» list markup, their now-unused exports and tests. `mode-selector` is
  the last product consumer of `IMPLEMENT_MODES` (`src/lib/command-modes.ts`, kept compiling and unit-tested by
  WO-02-020); the export itself is removed by WO-13-013 (W7), which declares that file (it is not in this work
  order's artifacts).
- The panel and `TabCommands` render no `<main>` (the shell's `main#content` is the only one); tests under
  `tab-commands/_tests/` that queried `getByRole("main")` are updated here.

## Out of Scope

- The picker internals (WO-11-003); the workspace frame and tab bar (WO-04-010); the change queue reader's edits
  (WO-04-012 owns `src/lib/changes/**` in this wave; this WO only reads `readChangeQueue`'s `id`, `title`,
  `status`).
- Running any command (copy only); any factory write.

## Requirements & Acceptance Criteria

REQ-11-001 to REQ-11-005 (the tab is the picker's home), REQ-04-006 (the Comandos tab's content).

REQ-04-006 is built as the oracle draws the v2 tab (`commandsView` in the frozen prototype, mock section
`commands`): «Construir un objetivo concreto» (FRD, pending work order and queued-change targets for
`/pandacorp:implement`) is drawn in every phase and is NOT gated by phase, and `/pandacorp:change`,
`/pandacorp:decide` and `/pandacorp:new-version` live in «Cambios y decisiones»; the phase-dependent commands
appear only in «Siguiente paso» (`workspaceCommands(phase)`). The v1 wording of REQ-04-006 (implement and
change only in `implementation` / `release`, a CommandsBox below the picker with release/iterate) is the
retired v1 layout; the PM amends REQ-04-006 to this drawn layout (FRD > FDD > WO: if the amended FRD text
differs from this paragraph, stop and report instead of choosing).

- **AC-11-005.2** — WHEN the owner picks a target under "Construir un objetivo concreto" (an FRD, a pending work order or a change from the queue), THE command box SHALL show `/pandacorp:implement` scoped to that target: `/pandacorp:implement <id>` for an FRD or a work order and `/pandacorp:implement change:<id>` for a queued change.

AC-11-005.1 (the cards) is WO-11-003's and AC-11-005.3 (the Campaña entry) is WO-02-020's; this WO mounts the
picker that satisfies AC-11-005.1 in the tab.

**Completeness and NFRs.** Error paths: no phase in `WorkspaceProject` → the no-phase-commands sentence
(never a crash); unreadable change files are skipped (Cambios is their fail-loud surface); no FRDs, work orders or
changes → the select holds only its placeholder. Input validation: a target value not among the options is ignored.
Security: read-only, nothing executes. Accessibility: the select has its accessible name, each copy button is named
«Copiar <comando>», Tab order follows reading order, cards stack below 1024 px with the actionable ones first.
Performance: one cached read per request; the only client code is the picker and the target select.

## Components built (blueprint)

CMP-11-comandos-panel, CMP-11-tab-commands (with `BuildTargetPicker`); mounts CMP-11-build-mode-picker. Reuse
`Card`/`CardHeader` (WO-13-012), `CommandBox`, `SelectField`, `Toast` (WO-13-011); the FRD index (WO-12-007).
Installs: none.

## Visual reference

- **Mock screens to reproduce:** `docs/frds/frd-11-build-modes/mocks/build-modes.html` sections `commands`
  (default: Equilibrado, `/pandacorp:implement`, the `<id>` placeholder) and `commands-target-scoped` (an FRD
  picked: `/pandacorp:implement FRD-01`); `commands-mode-powerful` for the mounted picker.
- **Prototype:** `commandsView` and `buildModePicker` in `docs/design/prototype/prototype.js`; recorded hooks
  `.grid-2.cmd-page`, `#cmd-target`, `.cmd-step`, `.cmd-l`, `.cmd`, `.mode-grid`, `button.mode`.
- **Token slice:** card hues phase (Siguiente paso), violet (Modo), teal (Objetivo), pink / amber / violet (the
  three change steps), hairline cards, mono for commands only, 12 px floor.
- **FDD pointer:** `docs/frds/frd-11-build-modes/fdd.md` (Layout of `commands`, States, Responsive).
- **Fidelity criterion:** the tab matches the three mock sections (layout, card order, command boxes) on the
  frozen tokens; preview smoke at the FRD gate and the close-out fidelity diff.

## Tests

- **Behaviour e2e:** `e2e/commands.spec.ts` (`gotoHydrated`, `getByRole`) on the e2e fixture project: the tab
  shows the four cards; Equilibrado is pressed and the box reads `/pandacorp:implement`; choosing Potente shows
  `/pandacorp:implement powerful` and survives a reload (remembered for this project); picking an FRD target shows
  `/pandacorp:implement FRD-01`; the read-only note is present; no control runs anything.
- **Component tests:** target options and commands for an FRD, a work order and a queued change (`change:<id>`);
  clearing returns to the placeholder; next-step dedupe; empty and unreadable inputs.
- **Derogated tests (map §3.3):** `git rm` `src/app/projects/[slug]/_components/mode-selector/_tests/mode-selector.reviewer.test.tsx`
  (its subject `ModeSelector` is deleted here) together with the implementer tests of `mode-selector`; re-blessed by
  the FRD-11 gate reviewer, never edited here: `src/app/projects/[slug]/_components/tab-commands/_tests/frd-11-gate.reviewer.test.tsx`
  and `frd-11-gate-opus.reviewer.test.tsx` (they import `TabCommands`, kept exported). Implementer tests
  `tab-commands.test.tsx` and `tab-commands.fidelity.test.tsx` rewritten to v2. Baselines untouched.

## Definition of done

- `bash .pandacorp/verify.sh --since <base>` green; the e2e spec passes; preview smoke clean.
- AC-11-005.2 met by tests that fail without the change; no import of `ModeSelector` remains (grep evidence in the
  Status Note); strings through `t()`; tokens only.

## Dependencies

WO-04-010 (W5: frame and the `ComandosPanel` stub), WO-11-003 (W2: the picker), WO-12-007 (W3: the FRD index; edge
added to the map's list because this WO imports it, DR-087; the wave stays W6).

## Status Note

### S5C implementation handoff — 2026-10-31

- Built after WO-04-012 on `orch/s5c`, port 3983. The async panel reads request-cached FRD/work-order/change targets, retains the shared project phase and next step, and renders four shared cards. The mounted BuildModePicker receives the project preference scope. Targets are available in every phase, exclude verified work orders and closed/closing changes, validate selection against options, clear per project, and never append a mode argument. ModeSelector and its implementer tests are retired.
- Test citations: `tab-commands/_tests/targets.v2.test.tsx` covers AC-11-005.2 for FRD, work order, queued change and clearing. `ComandosPanel.test.tsx` exercises the real filesystem readers and empty/unparseable input. `tab-commands.test.tsx` covers REQ-04-006 in every phase, deduplication, invalid targets and the mounted picker (AC-11-005.1); fidelity tests cover the shared cards/no nested main. `e2e/commands.spec.ts` cites AC-11-005.2 and restores its one fixture file unconditionally in setup and teardown, but was NOT executed.
- Reviewer reconciliation (untouched): remove `mode-selector/_tests/mode-selector.reviewer.test.tsx` with its retired module; rewrite `tab-commands/_tests/frd-11-gate.reviewer.test.tsx` and `frd-11-gate-opus.reviewer.test.tsx` for four cards and the shared picker.
- `rg -n 'ModeSelector' src --glob '!**/_tests/**'` finds only two stale comments in `src/lib/next-step/next-step.ts`; no remaining product import. That file and the unused `IMPLEMENT_BASE_COMMAND`, `IMPLEMENT_MODE_DEFAULT_LABEL`, `IMPLEMENT_DEFAULT_HINT` exports in `src/lib/command-modes.ts` belong to other work orders (W7 retirement), so remain untouched.

Verification executed from `mission-control/` with `PORT=3983 PANDACORP_E2E_PORT=3983`:

- `pnpm exec vitest run 'src/app/projects/[slug]/_components/tab-changes' 'src/app/projects/[slug]/_components/tab-documents' 'src/app/projects/[slug]/_components/tab-commands' 'src/app/projects/[slug]/_components/mode-selector' 'src/app/projects/[slug]/_actions' src/lib/changes src/lib/docs --maxWorkers=2`: 429 passed, 19 failed; 26 suites passed, five reviewer suites failed (two import/collection failures, three obsolete-contract suites). The reviewer files were not edited.
- The same scoped Vitest command with `--exclude '**/*.reviewer.*' --maxWorkers=2`: GREEN, 22 suites / 353 tests passed. This excludes reviewer-owned contracts awaiting reconciliation; it is not the full gate.
- `pnpm exec tsc --noEmit`: RED, 47 diagnostics, all in unchanged reviewer suites referring to retired Party/ModeSelector/formatChangeDate/objectives-bar or the former observabilidad tab ID. No diagnostics in S5C implementation or implementer tests.
- `pnpm exec knip`: RED, 26 unresolved imports in unchanged reviewer suites and three retained command-mode exports reserved for W7.
- `python3 /private/tmp/s5c-verify-biome.py`: GREEN, exact 27-file explicit-path Biome invocation, no fixes applied. `git diff --check`: GREEN.
- No Playwright, production build, full verify.sh, baseline blessing or browser fidelity check was run. No commits, staging, pushes, merges, merge queue, decision log or .pandacorp state writes were performed.

Explicit paths for this work order (including removed files):

- `docs/frds/frd-11-build-modes/work-orders/wo-11-004-comandos-tab.md`
- `e2e/commands.spec.ts`
- `src/app/projects/[slug]/_components/mode-selector/_tests/mode-selector.fidelity.test.tsx`
- `src/app/projects/[slug]/_components/mode-selector/_tests/mode-selector.test.tsx`
- `src/app/projects/[slug]/_components/mode-selector/mode-selector.tsx`
- `src/app/projects/[slug]/_components/tab-commands/BuildTargetPicker.tsx`
- `src/app/projects/[slug]/_components/tab-commands/_tests/ComandosPanel.test.tsx`
- `src/app/projects/[slug]/_components/tab-commands/_tests/tab-commands.fidelity.test.tsx`
- `src/app/projects/[slug]/_components/tab-commands/_tests/tab-commands.test.tsx`
- `src/app/projects/[slug]/_components/tab-commands/_tests/targets.v2.test.tsx`
- `src/app/projects/[slug]/_components/tab-commands/commands.module.css`
- `src/app/projects/[slug]/_components/tab-commands/tab-commands.tsx`
- `src/app/projects/[slug]/_panels/ComandosPanel.tsx`
