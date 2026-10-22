---
id: WO-21-003
type: work-order
slug: worktrees-by-repo
title: Worktrees by repository - reader, pill summary, Árboles de trabajo card and branch dialog
status: DRAFT
parent: FRD-21
foundation: false
implementation_status: PLANNED
difficulty: medium
reopen_count: 0
artifacts: ["src/lib/pendingMerge/**", "src/components/modules/Worktrees/**", "src/components/dashboard/FactoryWorktrees/**", "src/app/page.tsx", "src/app/_tests/{page.dashboard,wo-18-001-fixes,wo-18-001-inicio-dashboard}.test.tsx", "e2e/worktrees.spec.ts"]
source_requirements: [REQ-21-001, REQ-21-002, REQ-21-003, REQ-21-005, REQ-21-006, REQ-21-007]
dependsOn: [WO-01-010, WO-13-012]
last_updated: '2026-10-22'
---

# WO-21-003 Worktrees by repository

> Blueprint: [`../blueprint.md`](../blueprint.md) (`IF-21-*`, `CMP-21-*`). Design: [`../fdd.md`](../fdd.md).
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

## Summary

Publish the per-repository view of un-merged parallel work and draw it: `getWorktreesByRepo()` (branches outside
`main` and leftover worktrees per repository, the legend-rule state of each, an unreadable repository as its
own row), `pendingPillSummary()` for the sidebar pill, the Inicio card "Árboles de trabajo" with its table,
legend and `/pandacorp:worktrees` command, and the branch dialog. It swaps Inicio's import so the page stops
using the v1 factory-only reader. The pill itself is WO-19-003's; this work order gives it its data and its
anchor.

## In Scope

- `src/lib/pendingMerge/` (additive; `getPendingMerge()`/`readPending()` stay byte-compatible):
  `repoState.ts` (the pure legend rule, thresholds as named constants: 3 leftovers, 3 branches, 24 hours,
  7 days), `worktreesByRepo.ts` (`getWorktreesByRepo()`, `React.cache`), `pillSummary.ts`
  (`pendingPillSummary()`), and the exported constant `WORKTREES_CARD_ID = "worktrees-card"`. All git through
  `runGit`, all "now" through `now()` (WO-01-010); leftovers from `git worktree list --porcelain` minus the
  locked worktrees (counted apart for the dialog summary); repositories identified by the first worktree path so
  repositories sharing a git directory collapse into one row.
- `src/components/modules/Worktrees/`: `WorktreesCard`, `WorktreesTable`, `WorktreesBranchDialog`.
- `src/components/dashboard/FactoryWorktrees/FactoryWorktrees.tsx` rewritten as the Server Component mount
  (reads `getWorktreesByRepo()`, renders `WorktreesCard`); `src/app/page.tsx` swaps the import and drops the
  `getPendingMerge()` read. WO-18-002 (W5) rewrites the page layout around the mount.
- Behaviour e2e `e2e/worktrees.spec.ts` (`gotoHydrated`, `getByRole`): structural invariants only (the card and
  its command are present, the legend opens and closes, the table region is named and focusable). Repository
  rows depend on git state the e2e server does not control, so the row, dialog and pill-count behaviours are
  covered by component and reader tests with a fake `runGit` and, at the close-out, by the three oracle states.

## Out of Scope

- The sidebar pill component, its mount and the destination link (WO-19-003); ACs AC-21-008.1 and AC-21-008.2.
- The Inicio grid and the position of the card (WO-18-002).
- The top-bar `PendingMergeBadge` and the Resumen `PendingMergeBlock` (removed by WO-19-002 and WO-04-011); the
  legacy reader file itself (removed by WO-13-013 once unreferenced).
- Any merge, delete or command execution (REQ-21-005: Mission Control only shows `/pandacorp:worktrees`).

## Requirements & Acceptance Criteria

REQ-21-001, REQ-21-002, REQ-21-003, REQ-21-005, REQ-21-006 (all through the card, dialog and the published
summary) and REQ-21-007. The acceptance criteria this work order owns, copied from `frd.md`:

- **AC-21-007.1** — THE Inicio SHALL show the card "Árboles de trabajo" with one row per repository that has unmerged branches or leftover worktrees (columns Proyecto · Sin integrar · Sobrantes · Estado), each state computed as text by this rule: **Depurar ya** when it has 3 or more leftover worktrees, 3 or more unmerged branches, or any branch untouched for more than 7 days; else **Revisar pronto** when it has any leftover worktree or a branch older than 1 day; else **Al día** when it has only recent work; **Limpio** when nothing is pending or left over. Leftovers SHALL come from `git worktree list`, without the locked worktrees. The card SHALL explain the rule in the legend "¿Cómo se decide el estado?".
- **AC-21-007.2** — WHEN a repository row is activated, THE system SHALL open a dialog listing its branches, each with its last-commit subject, origin, age, commits outside `main`, uncommitted changes count and branch name.
- **AC-21-007.3** — THE card SHALL show `/pandacorp:worktrees` (the cleanup skill, DR-135) as a normal copyable command with the line "Para depurar un proyecto, corre en su carpeta" (no "Habilidad propuesta" label).

Owned elsewhere: AC-21-008.1 and AC-21-008.2 (the pill) by WO-19-003.

Behaviour the table and the dialog must show beyond the ACs (FDD, captured states): a repository with nothing to
open keeps a dash in both counts, the state "Limpio" and a disabled name button; an unreadable repository shows
dashes, the coral chip "No se pudo leer" (never "Limpio" or "Al día"), a disabled name and, under the table, a
coral notice with `role="alert"` naming the repository and the reason, while the other rows are unchanged
(REQ-21-006, state `worktrees-unreadable`); the hint "Desliza la tabla para ver todas las columnas" sits under the
table; branch subjects clamp to two lines; ages read "N h" below 48 hours and "N días" after; singular and plural
forms follow the catalogue (`inicio.worktrees.detail.*`).

Completeness (beyond the ACs): error path per failure mode (a repository whose git fails, a branch whose count
cannot be read keeps defaults and stays pending, an empty portfolio shows only the factory row), the empty
state (no repository with work: the card still renders its rows as "Limpio"; the pill is hidden), a11y (named
scroll region, disabled buttons announced, state by word plus dot, dialog focus returns to the row, Escape
closes), performance (each repository read once per request, request-cached; every `runGit` call bounded by the
timeout WO-01-010 sets), no personal data beyond branch names and commit subjects already in the owner's repos,
no write, no outbound call.

## Components & interfaces it builds

`IF-21-worktrees`, `IF-21-state`, `IF-21-pill`, `CMP-21-card`, `CMP-21-table`, `CMP-21-dialog`, `CMP-21-mount`
(blueprint). Copy through `t()`: `inicio.worktrees.*`, `states.scrollable.*`, `dialogs.default.close`. The
repository display name is data (portfolio name; the factory repository is shown as the prototype shows it,
without the " (panda-corp)" suffix); the word "Fábrica" has no catalogue key and is reported in the ledger.

## Reuse (components.md: reuse, then adapt, then create)

Reuse `Card`/`CardHeader`, `Table`, `StateDot`, `Chip`, `Notice`, `CommandBox`/`CommandCompact`, `Dialog`,
`Button` (the link-style name button), `Icon`. Adapt: the v1 `FactoryWorktrees` becomes the thin mount;
`WorktreesTable` is the components.md row relocated next to the card. The branch rows follow the `AskRow`
pattern (reuse its markup/classes; do not build a second row). Create: `WorktreesCard` and
`WorktreesBranchDialog` only. The legend is a native `details`, not a component.

## Installs

None.

## Visual reference

- **Mock screens to reproduce:** `docs/frds/frd-21-pending-merge/mocks/pending-merge.html`, sections
  `worktrees-card`, `worktrees-branch-dialog`, `worktrees-unreadable`; screenshots
  `mocks/screenshots/<id>-<width>-<theme>.jpg` (card at 375/768/1280, dialog at 375/1280, light and dark).
  The pill states `shell-pending-chip` and `shell-pending-chip-open` are WO-19-003's.
- **Oracle states** (`oracle-states.json`, frd slug `frd-21-pending-merge`): `worktrees-card`,
  `worktrees-branch-dialog`, `worktrees-unreadable` (recipe: the git double that makes `worktree list` fail for
  the `pandasaga` repository; the others answer from `git-state.json`). Keep the recorded hooks (`.wt-table`,
  `.skill-line`, `.state-dot`, `.legend`, `p.tbl-hint`, `data-wt-repo`) on the elements.
- **Token slice:** the teal dialog head and card hue, coral (Depurar ya, "No se pudo leer", the notice), amber
  (Revisar pronto), green (Al día, Limpio), `--surface`, `--surface-2`, `--line`, radius 16 and 22, tabular
  numbers, mono only for the command and the branch names, uppercase 12 px table heads.
- **FDD pointer:** `docs/frds/frd-21-pending-merge/fdd.md`.
- **Fidelity acceptance criterion:** the built card and dialog visually match `mocks/pending-merge.html`
  (layout, structure, components, density) on the frozen tokens, not an approximation; verified by the preview
  smoke and shell gates at the FRD gate and by the computed-style and pixel diff of the three oracle states at
  the close-out Visual QA (DR-056, DR-129). Opening the card from the pill puts it at the top of the viewport
  (scroll padding from WO-13-010; this card only supplies the anchor id).

## Tests this work order owns

Reader tests with a fake `runGit` and a fixed `now()` (the state rule at every boundary: 2 and 3 leftovers,
2 and 3 branches, 24 h and 7 d, locked worktrees excluded, merged branch not pending, unreadable repository as
an error entry and the others unaffected, two portfolio entries sharing one git directory collapse, ordering);
`pendingPillSummary` cases (hidden at zero, count across repositories, urgent, unreadable wins the suffix,
zero count with an unreadable repository); component tests by role and name (row opens the dialog, disabled
rows, notice `role="alert"`, legend toggles, command has a copy button); the e2e spec above. A malformed
`git worktree list` output must fail loud as an unreadable repository (DR-078), with a malformed fixture.

## Derogated tests (BL-0051)

- Updated here, same work order: `src/app/_tests/page.dashboard.test.tsx`,
  `src/app/_tests/wo-18-001-fixes.test.tsx`, `src/app/_tests/wo-18-001-inicio-dashboard.test.tsx` and
  `components/dashboard/FactoryWorktrees/_tests/FactoryWorktrees.test.tsx` wherever they pin the v1 worktrees
  section; WO-18-002 deletes the page tests later.
- Reviewer-authored, not edited here (DR-080): `src/app/(dashboard)/_tests/frd-18-integration.reviewer.test.tsx`
  assertions on the old section are derogated; the FRD-18 gate's reviewer re-blesses them.
- Kept compiling and passing untouched: `src/lib/pendingMerge/_tests/pendingMerge.test.ts`, the badge and block
  tests (their owners remove them later).

## Dependencies

WO-01-010 (the clock and git seams), WO-13-012 (composite primitives). Consumers: WO-18-002 (places the card),
WO-19-003 (pill: `pendingPillSummary()` and `WORKTREES_CARD_ID`), WO-13-013 (deletes the legacy reader).

## Status Note

