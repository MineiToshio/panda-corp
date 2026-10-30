---
id: WO-21-003
type: work-order
slug: worktrees-by-repo
title: Worktrees by repository - reader, pill summary, Árboles de trabajo card and branch dialog
status: ACTIVE
parent: FRD-21
foundation: false
implementation_status: VERIFIED
difficulty: medium
reopen_count: 0
artifacts: ["src/lib/pendingMerge/**", "src/lib/git/**", "src/components/modules/Worktrees/**", "src/components/dashboard/FactoryWorktrees/**", "src/components/core/StateDot/**", "src/components/core/Table/**", "docs/design/microcopy.es.json", "src/app/page.tsx", "src/app/_tests/{page.dashboard,wo-18-001-fixes,wo-18-001-inicio-dashboard}.test.tsx", "e2e/worktrees.spec.ts"]
source_requirements: [REQ-21-001, REQ-21-002, REQ-21-003, REQ-21-005, REQ-21-006, REQ-21-007]
dependsOn: [WO-01-010, WO-13-012]
last_updated: '2026-10-30'
---

# WO-21-003 Worktrees by repository

> Blueprint: [`../blueprint.md`](../blueprint.md) (`IF-21-*`, `CMP-21-*`). Design: [`../fdd.md`](../fdd.md).
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

## Summary

Publish the per-repository view of un-merged parallel work and draw it: `getWorktreesByRepo()` (branches outside
`main` and leftover worktrees per repository, the legend-rule state of each, an unreadable repository as its
own row), `summarizeWorktrees(rows)` for the sidebar pill, the Inicio card "Árboles de trabajo" with its table,
legend and `/pandacorp:worktrees` command, and the branch dialog. It swaps Inicio's import so the page stops
using the v1 factory-only reader. The pill itself is WO-19-003's; this work order gives it its data and its
anchor.

## In Scope

- `src/lib/pendingMerge/` (additive; `getPendingMerge()`/`readPending()` stay byte-compatible):
  `repoState.ts` (the pure legend rule, thresholds as named constants: 3 leftovers, 3 branches, 24 hours,
  7 days), `worktreesByRepo.ts` (`getWorktreesByRepo()`, `React.cache`), `pillSummary.ts`
  (`summarizeWorktrees(rows)`), and the exported constant `WORKTREES_CARD_ID = "worktrees-card"`. All git through
  `runGit`, all "now" through `now()` (WO-01-010); leftovers from `git worktree list --porcelain` minus the
  locked worktrees (counted apart for the dialog summary); repositories identified by the first worktree path so
  repositories sharing a git directory collapse into one row.
- `src/lib/pendingMerge/pendingMerge.ts` (the v1 reader, still live until WO-13-013 deletes it): its private
  default runner `realGit` (`execFileSync("git", …)`, the file's only `node:child_process` import) becomes a
  thin adapter over `runGit(args, repoRoot)` of WO-01-010 with the same trimmed-stdout contract, and the
  `Date.now()` default of `readPending` becomes `now().getTime()`. Results are unchanged with no seam variable
  set: same commands (all inside `runGit`'s read-only allowlist), same `GitRunner` type, same error and empty
  results; `getPendingMerge()` and `readPending()` keep their signatures. The `node:child_process` import is
  removed, so WO-01-011's boundary test (W5) finds no importer outside `src/lib/git/` here.
- `src/components/modules/Worktrees/`: `WorktreesCard` (its root element carries `id={WORKTREES_CARD_ID}`,
  i.e. `id="worktrees-card"`, the anchor the sidebar pill links to, AC-21-008.1 and oracle
  `shell-pending-chip-open`; WO-18-002 only places the card), `WorktreesTable`, `WorktreesBranchDialog`. No
  `child_process` and no zero-argument `Date` in these artifacts (WO-01-011's boundary test).
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
  the `pandasaga` repository; the others answer from `git-state.json`), and the scenario state
  `worktrees-factory-dialog` (the factory repository's branch dialog with the origins «Carril de un build» and
  «Sesión de Codex», reproduced from its `oracle-recipes.json` double). Keep the recorded hooks (`.wt-table`,
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
`summarizeWorktrees` cases (hidden at zero, count across repositories, urgent, unreadable wins the suffix,
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
- Kept compiling and passing untouched: `src/lib/pendingMerge/_tests/pendingMerge.test.ts` (it injects a fake
  `GitRunner`, so the runner swap leaves it green and is the proof of unchanged results), the badge and block
  tests (their owners remove them later).

## Dependencies

WO-01-010 (the clock and git seams, also adopted by the v1 `pendingMerge.ts` runner here), WO-13-012 (composite
primitives). Consumers: WO-01-011 (its boundary test needs the runner swap), WO-18-002 (places the card),
WO-19-003 (pill: `summarizeWorktrees(rows)` and `WORKTREES_CARD_ID`), WO-13-013 (deletes the legacy reader).

## Status Note

2026-10-30: Malformed branch-output repair (REQ-21-006, DR-078). Empty output remains
clean; only parenthesised HEAD descriptions are skipped. Full `refs/heads/` entries
are accepted and every other line throws, producing an unreadable repository row.
Implementation remains IN_REVIEW; changes are uncommitted by owner instruction.
No reviewer tests or blessed visual baselines were edited.
Verification with `export PORT=4330 PANDACORP_E2E_PORT=4330`:
- `pnpm exec vitest run src/lib/pendingMerge src/lib/git --reporter=dot`: exit 0,
  7 files and 41 tests passed, including `worktreesByRepo.malformed.reviewer.test.ts`.
- `bash .pandacorp/verify.sh --only=biome,tsc,knip`: exit 0. Biome reports a
  schema-version information message; Knip reports configuration hints.
No browser/e2e or full-project verification was performed for this repair.

2026-10-30: Second independent gate repair. Read full branch refs with `%(refname)` and
keep only `refs/heads/` entries, so localized detached/rebase descriptions are never branch
names. The fixture answers this exact command and retains the short-ref command for the
legacy reader. Required read failures distinguish worktree command/format, branch reads
against main, branch age reads and `GitError.kind === "timeout"` through Spanish catalogue
copy. The original worktree-command error text stays intact. Fixture activity uses the
folder's own identity while repository facts alone use the factory mapping. Repository
rows from the cached resolver carry an explicit id (`factory` or project folder id), and
the table hook reads it independently of the display name; injected legacy rows retain
the path fallback. Expanded the artifacts ledger to cover git, StateDot, Table and copy.

Baseline reviewer run: 2 failures, 10 passes (missing-main reason and Mission Control
activity). The detached real-git case passed with both the default `LANG=C.UTF-8` and
`LANG=es_ES.UTF-8`; this environment did not reproduce translated output. An added
regression uses the exact Spanish detached description. Before implementation, the
additional unit/component run had 7 failures and 9 passes, covering that description,
step-specific reasons, timeouts and display-name-independent identity.
Changes remain uncommitted; no reviewer-authored files or blessed baselines were edited.
No e2e or Chromium execution is authorized in this sandbox.

Final verification for the second repair (`export PORT=4330 PANDACORP_E2E_PORT=4330`):
- `pnpm exec vitest run src/lib/pendingMerge src/lib/git src/components/modules/Worktrees src/components/dashboard/FactoryWorktrees src/components/core --reporter=dot`: passed, exit 0; 55 files and 679 tests, including all named reviewer regressions. Output includes Node localStorage warnings and React act warnings in core tests.
- `LANG=es_ES.UTF-8 pnpm exec vitest run src/lib/pendingMerge/_tests/worktreesByRepo.realgit.reviewer.test.ts src/lib/git/_tests/fixtureGit.reviewer.test.ts --reporter=dot`: passed, exit 0; 2 files and 12 tests. No `LC_ALL=C` override was used. Actual translated Git output remains unverified; the exact Spanish pseudo-ref is covered by the unit regression.
- `bash .pandacorp/verify.sh --only=biome,tsc,knip`: passed, exit 0 after fixing one formatter line wrap. Biome emits its schema-version information message; Knip emits configuration hints. This is the requested partial gate, not a full-project certification.
- `git diff --check`: passed. No changes are staged or committed; reviewer tests and blessed visual baselines remain unchanged. No e2e/browser or visual verification was attempted.

2026-10-30: Gate repair: preserve all four table columns at narrow widths with higher-specificity
module selectors; accept Git detached/rebase pseudo-branches; qualify branch log refs and fail
closed on unreadable ages. Errors use catalogue copy and sort after pending rows, before clean
rows; the card orders hint, notices, legend. Reused core StateDot through its repository variant,
added column tooltips and alert chip icon, restored the factory oracle hook, and rounded dialog days.
Ledger addition: `src/lib/git/fixtureAnswers.ts` answers qualified log refs; `src/lib/git/fixtureGit.ts`
maps the oracle's `projects/mission-control` folder to factory so it deduplicates with that repository.
Also adapted core Table column titles, StateDot, the copy catalogue and the component inventory.
Changes remain uncommitted by owner instruction; e2e/Chromium are excluded in this sandbox.

Verification for this repair (`export PORT=4330 PANDACORP_E2E_PORT=4330`):
- `pnpm exec vitest run src/lib/pendingMerge/_tests/worktreesByRepo.realgit.reviewer.test.ts src/components/modules/Worktrees/_tests/Worktrees.reviewer.test.tsx src/components/dashboard/FactoryWorktrees/_tests/FactoryWorktrees.reviewer.test.tsx src/lib/pendingMerge/_tests/worktreesByRepo.test.ts src/lib/git/_tests/fixtureGit.test.ts src/components/modules/Worktrees/_tests/Worktrees.test.tsx src/components/dashboard/FactoryWorktrees/_tests/FactoryWorktrees.test.tsx --reporter=dot`: 7 files, 32 tests passed, including all three non-e2e reviewer files.
- `pnpm exec vitest run src/components/core/Table/_tests/Table.test.tsx src/components/core/Chip/_tests/vocabulary.test.tsx src/components/core/Ring/_tests/Ring.test.tsx --reporter=dot`: 3 files, 10 tests passed.
- `bash .pandacorp/verify.sh --only=biome,tsc,knip`: passed, exit 0; the generated partial report has all three subgates green. Biome reports an existing schema-version information message; Knip reports configuration hints.
- `git diff --check`: passed. No reviewer-authored files or visual baselines changed.
The first reviewer run reproduced seven failures; the repair passes them. An earlier
expanded run exposed an old error-first ordering assertion, now updated by repository name.
The first quality run exposed a reviewer fixture's union spread typing: unreadable rows now
permit an empty `branches` collection (never branch facts), and the final tsc run passes.
No e2e attempt was made. Responsive rendering at 768/375 and browser behavior remain unverified.

2026-10-30: Restored the exact inverse patch of revert 134af454 without conflicts.
The requested `git revert --no-edit 134af454` could not create the worktree
Git index lock (sandbox: Operation not permitted); no commit was created.
The landed pure `summarizeWorktrees(rows)` boundary and module-local GitError
remain intact; no unused zero-argument pill wrapper was reintroduced.
Verification (port 4330; `PORT` and `PANDACORP_E2E_PORT` exported):
- `bash .pandacorp/verify.sh --only=biome,tsc,knip,vitest`: biome/tsc/knip
  passed; Vitest 529 files passed, 4 failed (8057 tests passed, 14 failed).
  Thirteen failures are in the excluded-known-red snapshot-panel area; one is
  BuildModePicker's inaccessible-storage/failed-write test, outside this WO.
- `pnpm exec vitest run src/lib/pendingMerge/_tests/worktreesByRepo.test.ts src/components/modules/Worktrees/_tests/Worktrees.test.tsx src/components/dashboard/FactoryWorktrees/_tests/FactoryWorktrees.test.tsx --reporter=dot`:
  3 files and 8 tests passed.
- `pnpm exec playwright test e2e/frd-21-pending-merge.behaviour.spec.ts e2e/worktrees.spec.ts`:
  initial server startup timed out after EMFILE watcher errors. Retried with
  `WATCHPACK_POLLING=true`, `MC_GIT_FIXTURE=$PWD/docs/design/prototype/fixtures/git-state.json`
  and `MC_CLOCK=2026-10-20T15:00:00.000Z`: server started; all four desktop/mobile
  cases were blocked before execution by Chromium's MachPortRendezvousServer
  `Permission denied (1100)`. Browser behavior remains unverified.
  The temporary e2e/server-env.json port override was restored.
- `NODE_OPTIONS=--no-experimental-webstorage bash .pandacorp/verify.sh --only=biome,tsc,knip,vitest`:
  biome/tsc/knip passed again. Vitest: 528 files passed, 5 failed;
  8056 tests passed, 15 failed. BuildModePicker passed on this run;
  two DataModelViewer reviewer cases (native fullscreen and deselecting a
  relationship) failed alongside the same 13 snapshot-panel failures.
  These additional failures remain outside the WO scope; acceptance is not green.
- `git diff --check`: passed.


Built `readWorktreesByRepo(repositories, instant?): WorktreesByRepo` and request-cached
`getWorktreesByRepo(): WorktreesByRepo`, `repoState({branches, leftovers}): RepoState`,
`summarizeWorktrees(rows): {count, urgent, unreadable, hidden}`, and client-safe
`WORKTREES_CARD_ID` from `repoState.ts`. Repositories deduplicate by the first porcelain
worktree path; unmerged branches come from `branch --no-merged main`. Leftovers are
non-primary worktrees with no unmerged branch, excluding locked entries (counted apart).
Malformed worktree/branch reads yield a named error row; optional per-branch counts retain the known pending branch with zero counts/name fallback when unavailable; a failed required age read yields an unreadable repository.
Ages retain fractional hours for strict threshold comparisons and display floored hours and rounded days.
Origin prefixes are lane/, claude/, codex/, otherwise manual. Counts use main as the
integration branch, matching the frozen oracle. Read-only `runGit` and `now` seams own I/O.

The Inicio mount now renders `WorktreesCard` with repository rows, cleanup command,
keyboard-scrollable table, legend and error notices. `WorktreesTable({rows,onSelect})`
opens `WorktreesBranchDialog({repository,onClose})`; the existing Modal supplies focus
trap, Escape and focus return. Local styling translates the teal header and AskRow pattern.
No new primitive was introduced: Card/Table/Chip/Notice/BadgeIcon/CmdRow/Modal are reused.
Factory display name is the specified data value Fábrica (no catalogue key, as noted in WO).
The command copy accessible label uses the existing CommandBox wording.

Applied LESSON-0077 (one cached repository resolver for card and pill) and LESSON-0450
(explicit frozen fictional git fixture, never the owner's repository in reader tests).
Tests: pendingMerge/_tests/worktreesByRepo.test.ts, modules/Worktrees/_tests/Worktrees.test.tsx,
FactoryWorktrees/_tests/FactoryWorktrees.test.tsx, e2e/worktrees.spec.ts and
 e2e/frd-21-pending-merge.behaviour.spec.ts. The v1 reader only swaps its git/clock adapters.
