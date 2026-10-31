---
id: BP-21
type: blueprint
slug: pending-merge
title: Pending-merge visibility (Árboles de trabajo card and sidebar pill)
status: ACTIVE
parent: FRD-21
implementation_status: VERIFIED
readiness_gate: passed 2026-10-22
grounding_gate: passed 2026-10-22
consistency_gate: passed 2026-10-22
last_updated: 2026-10-22
---

# Blueprint — FRD-21 Pending-merge visibility

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Per-feature blueprint (DR-049) on top of [`docs/product/architecture.md`](../../product/architecture.md)
> (§6 `pendingMerge/` and `git/`, §7 fixture seams and read-only git, §11 mapping, route map row `/`). It does
> not restate the platform. v2 revision: the v1 design (a top-bar indicator with a cross-project popover and a
> per-project Resumen block) is replaced by the drawn design (a table card on Inicio with a per-repository
> dialog, and a sidebar pill). What still describes live code is kept: the reader is read-only, fail-loud
> (DR-078) and shared through one request-cached resolver (DR-092, DR-115).

## Purpose

Make un-merged parallel work impossible to forget: Inicio's card "Árboles de trabajo" lists every repository
with branches outside `main` or leftover worktrees and computes a text state for each by one rule; a repository
row opens a dialog with its branches; one sidebar pill, visible on every screen, carries the count and goes to
that card. Nothing merges, deletes or runs from here: the card shows `/pandacorp:worktrees` as a copyable
command. The reader and the card are WO-21-003; the pill's markup and mount are WO-19-003 (FRD-19), which
consumes the summary this FRD publishes.

## Components & Interfaces

| ID | Kind | Responsibility | Location | REQ |
|---|---|---|---|---|
| `IF-21-worktrees` | interface | `getWorktreesByRepo(): WorktreesByRepo`, request-cached. One entry per repository: the unmerged branches (`name`, `subject`, `origin`, `ageHours`, `ahead`, `uncommitted`, `worktree`), the leftover worktree count (from `git worktree list`, locked ones excluded and counted apart), the computed `state` and, for a repository whose git could not be read, a typed error entry with the reason. The only place that derives states (AC-21-007.1) and the only reader both surfaces use. | `src/lib/pendingMerge/worktreesByRepo.ts` (new) | REQ-21-003, REQ-21-006, REQ-21-007 |
| `IF-21-state` | interface | The legend rule as a pure function `repoState({ branches, leftovers })`: `cleanNow` (3 or more leftovers, 3 or more unmerged branches, or any branch untouched for more than 7 days), else `reviewSoon` (any leftover or a branch older than 1 day), else `upToDate` (only recent work), else `clean`. Thresholds are named constants of this module. | `src/lib/pendingMerge/repoState.ts` (new) | REQ-21-002, REQ-21-007 |
| `IF-21-pill` | interface | `pendingPillSummary(): { count; urgent; unreadable; hidden }`: `count` = branches with work outside `main` across every repository, `urgent` = some repository is `cleanNow`, `unreadable` = number of repositories that could not be read, `hidden` = `count === 0 && unreadable === 0`. Derived from `IF-21-worktrees`, never from a second git read. Consumer: WO-19-003's `PendingPill`. | `src/lib/pendingMerge/pillSummary.ts` (new) | REQ-21-001, REQ-21-002, REQ-21-008 |
| `IF-21-legacy` | interface | `getPendingMerge()` / `readPending()` (v1 factory-only reader). Kept byte-compatible while v1 callers exist (the layout badge until WO-19-002, the Resumen block until WO-04-011); WO-13-013 deletes it once unreferenced. WO-21-003 swaps only its private default runner (`execFileSync`) for `runGit` and its `Date.now()` default for `now()`, results unchanged, so WO-01-011's `child_process` boundary test holds from W5. | `src/lib/pendingMerge/pendingMerge.ts` (exists; runner swap only) | n/a (history) |
| `CMP-21-card` | component | `WorktreesCard`: the Inicio card "Árboles de trabajo": intro, the `/pandacorp:worktrees` skill line, the scrollable table (Proyecto · Sin integrar · Sobrantes · Estado), the hint under it, the closed legend "¿Cómo se decide el estado?", the coral unreadable notice. Its root carries the stable anchor id `worktrees-card` (exported as a constant) that the pill targets. | `src/components/modules/Worktrees/WorktreesCard.tsx` | REQ-21-003, REQ-21-005, REQ-21-006, REQ-21-007 |
| `CMP-21-table` | component | `WorktreesTable({ rows })`: the table on the core `Table` inside a scroll region named by `states.scrollable.tableAria`; repository names are buttons (disabled when there is nothing to open); the state is `StateDot` plus word, or the coral chip "No se pudo leer" for an unreadable repository. Relocated from the components.md path `src/app/(dashboard)/_components/WorktreesTable.tsx` into the module with the card (components.md allows a blueprint to relocate, never to rename). | `src/components/modules/Worktrees/WorktreesTable.tsx` | REQ-21-006, REQ-21-007 |
| `CMP-21-dialog` | component | `WorktreesBranchDialog`: native dialog with the teal head (kicker "Árboles de trabajo", title "Árboles de trabajo · <repo>"), the summary line, one `AskRow`-pattern row per branch and the `/pandacorp:worktrees` `CommandBox` with "Corre en la carpeta de <repo> para depurarlo:". | `src/components/modules/Worktrees/WorktreesBranchDialog.tsx` | REQ-21-003, REQ-21-005, REQ-21-007 |
| `CMP-21-mount` | component | `FactoryWorktrees` (v1 name, kept in place): the Inicio mount that reads `getWorktreesByRepo()` and renders `WorktreesCard`; WO-21-003 swaps `src/app/page.tsx` to it so the page stops reading `getPendingMerge()`. WO-18-002 later places it in the right column. | `src/components/dashboard/FactoryWorktrees/FactoryWorktrees.tsx` (rewritten) | REQ-21-007 |
| `CMP-21-pill` | component | `PendingPill` (components.md `PendingPill`, shell element, alert variant): built and mounted by **WO-19-003**; this FRD fixes its data and copy contract (below). | `src/components/modules/AppShell/PendingPill.tsx` (WO-19-003) | REQ-21-001, REQ-21-002, REQ-21-008 |

## Contracts

**Landed summary boundary (2026-10-30).** Until WO-19-003 mounts the sidebar pill,
`pillSummary.ts` exposes the pure `summarizeWorktrees(rows: WorktreesByRepo)` calculation.
The unused zero-argument `pendingPillSummary()` wrapper is deferred to that consumer;
it must delegate to this calculation with `getWorktreesByRepo()` rather than add another
git read (LESSON-0077). Threshold constants and branch-detail types remain module-local.

**Reader (`IF-21-worktrees`).** Repositories: the factory repository plus every portfolio entry whose folder
exists (`readPortfolio()`); a missing folder is FRD-03's «Ruta no encontrada», not a git failure, and is not a
row here. A repository is identified by the first `worktree` path of `git worktree list --porcelain`, so
entries that share a git directory (Mission Control lives inside the factory repository) collapse into one row.
Every git call goes through `runGit(args, cwd)` (read-only, fixture-aware, WO-01-010) and every "now" through
`now()` (the frozen clock in oracle mode); the module never touches `fs`/`child_process` for git and never
calls Claude. Per repository the reader runs only commands the fixture runner answers (`worktree list
--porcelain`, `branch --no-merged main --format=%(refname)`, `rev-list --count`, `log -1`, `status --porcelain` in the branch's
worktree); a command the fixture cannot answer is a ledger request to WO-01-010, never a mock of the reader.
Only full refs starting with `refs/heads/` are branch entries; localized detached/rebase descriptions
are excluded without parsing translated text. The fixture retains the short-ref command for the legacy
reader. Factory rows carry `id: "factory"`, portfolio rows their folder id; the table's `data-wt-repo`
hook uses this identity rather than display copy (injected legacy rows fall back to their path basename).
In fixture dispatch, folder activity keeps its own identity even when repository facts map to factory.
Branch origin comes from the branch prefix: `lane/` is "Carril de un build", `claude/` "Sesión de Claude Code",
`codex/` "Sesión de Codex", anything else "Rama manual" (`inicio.worktrees.origin.*`). Errors: a repository
whose `git worktree list` (or branch read) fails becomes one entry `{ kind: "error", reason }` and the other
repositories still list; "nothing pending" and "could not read" are different values (DR-078).
Required failures use Spanish catalogue reasons for the actual step: worktree command failure (the existing
`readError` copy), malformed worktree output, branch reads against main (including a missing main), or
branch age reads. A `GitError` timeout at any required step uses `readTimeout` rather than a command-failure
reason; subprocess output never becomes UI copy. Ordering:
state rank descending (`cleanNow`, `reviewSoon`, `upToDate`, `clean`), then branches plus leftovers
descending. Invariants: the count in the pill equals the sum of unmerged branches in the table; a repository
with nothing to show is still a row (state `clean`, dashes, disabled name).

**Pill data (`IF-21-pill`).** Hidden only when `count === 0` and no repository is unreadable. Alert variant when
`urgent` or `unreadable > 0`. Label: the pluralised count (`shell.pending.label`), or `shell.pending.labelNone`
("Árboles") when the count is zero but a repository is unreadable; suffix `shell.pending.labelUnread` when any
repository is unreadable, else `shell.pending.labelUrgent` when `urgent` (unreadable wins, as captured in
`worktrees-unreadable`). Title: `shell.pending.titleBranches` + `titleUnread` (when applicable) +
`titleSuffix`, repeated as the accessible text. The pill links to Inicio at `#worktrees-card`.

**Anchor.** `WORKTREES_CARD_ID = "worktrees-card"`, exported from `src/lib/pendingMerge/` (a plain constant,
client-safe) and used by the card and by WO-19-003's pill link, so neither hardcodes the string.

**Removed by this FRD's v2 (map §6.C 3, 7).** REQ-21-004 (the Resumen "Pendientes de merge" block), the
top-bar `PendingMergeBadge` and its popover. The block is removed by WO-04-011 and the badge by WO-19-002;
this FRD's work order does not touch them.

## Traceability

| REQ | Satisfied by | Work order |
|---|---|---|
| REQ-21-001 Pill reachable everywhere, count, hidden at zero | `IF-21-pill`, `CMP-21-pill` | WO-19-003 (AC-21-008.1); data by WO-21-003 |
| REQ-21-002 Alert variant, text plus icon | `IF-21-state`, `IF-21-pill`, `CMP-21-pill` | WO-19-003 (AC-21-008.2); data by WO-21-003 |
| REQ-21-003 Pill opens the card; a row opens its branches | `CMP-21-card` (anchor), `CMP-21-dialog` | WO-21-003 (AC-21-007.2); AC-21-008.1 by WO-19-003 |
| REQ-21-004 Resumen block | removed in v2 (verified by the removal) | WO-04-011 |
| REQ-21-005 Read-only, `/pandacorp:worktrees` command | `CMP-21-card`, `CMP-21-dialog` | WO-21-003 (AC-21-007.3) |
| REQ-21-006 Fail-loud reader, distinct unreadable state | `IF-21-worktrees`, `CMP-21-table` | WO-21-003 |
| REQ-21-007 "Árboles de trabajo" card | `IF-21-worktrees`, `IF-21-state`, `CMP-21-card`, `CMP-21-table`, `CMP-21-dialog`, `CMP-21-mount` | WO-21-003 (AC-21-007.1 to AC-21-007.3) |
| REQ-21-008 Global pill | `IF-21-pill`, `CMP-21-pill` | WO-19-003 (AC-21-008.1, AC-21-008.2) |

## Visual spec (WO-21-003; binding, DR-054)

FDD: [`fdd.md`](fdd.md). Mock: `mocks/pending-merge.html`; screenshots in `mocks/screenshots/`. Oracle states of
this FRD's gate: `worktrees-card`, `worktrees-branch-dialog`, `worktrees-unreadable`, the scenario state
`worktrees-factory-dialog` (the factory repository's dialog, drawing the origins «Carril de un build» and «Sesión
de Codex»; `oracle-recipes.json` double) (WO-21-003) and `shell-pending-chip`, `shell-pending-chip-open` (the
pill: WO-19-003, captured on `/board`). Reconciliation 2026-10-22: WO-01-010 answers every git family the
reader issues (including the `pandasaga` failure of `worktrees-unreadable`); the card carries
`id={WORKTREES_CARD_ID}`; `PendingPill` (WO-19-003) consumes `pendingPillSummary()` `{ count, urgent, unreadable,
hidden }` (REQ-21-001, AC-21-008.1/.2 traced to it). The unreadable state
is produced by pointing the git runner at a fixture that makes `worktree list` fail for one repository, never by
mocking the reader. Assets: icons through `Icon` only. The card is the last card of the right column of
Inicio's grid (FRD-18 owns the grid).

## Dependencies & Risks

- Upstream: WO-01-010 (clock and git seams), WO-13-012 (composite primitives: `Card`, `Dialog`, `Notice`,
  `Table`), through it the leaf `CommandBox`, `StateDot`, `Chip`.
- Consumers: WO-18-002 (places the card), WO-19-003 (pill), WO-13-013 (deletes `IF-21-legacy`).
- Risk: git latency on a large portfolio. Mitigation: the resolver is request-cached and reads each repository
  once; every `runGit` call has the timeout WO-01-010 sets; a timeout is an unreadable row, not a hang.
- Risk: FRD-23 AC-23-005.1 (nothing git-derived is materialized): this reader stays live and writes nothing.
- The FRD's "Data source" paragraph (snapshot files under `.pandacorp/run/`) describes the v1 design and
  contradicts AC-21-007.1 (leftovers from `git worktree list`); the as-built v1 reader already read git live.
  This blueprint follows the acceptance criteria (reported in the ledger for the PM).

Lessons applied: LESSON-0077 (the pill count and the table states come from the one `IF-21-worktrees` read, so
the pill and the card cannot disagree), LESSON-0450 (tests and e2e opt in to git state explicitly through the
fake or fixture runner; the checkout's own repository is never the default input).

## Build Plan

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-21-003 | WO-01-010, WO-13-012 | `src/lib/pendingMerge/**`, `src/lib/git/**`, `src/components/modules/Worktrees/**`, `src/components/dashboard/FactoryWorktrees/**`, `src/components/core/StateDot/**`, `src/components/core/Table/**`, `docs/design/microcopy.es.json`, `src/app/page.tsx`, `src/app/_tests/{page.dashboard,wo-18-001-fixes,wo-18-001-inicio-dashboard}.test.tsx`, `e2e/worktrees.spec.ts` | false | W3; none inside this FRD |

- **Order and integration.** One work order. WO-21-003 (W3) publishes the reader, the pill summary and the card;
  WO-18-002 (FRD-18, W5) rewrites `src/app/page.tsx` around it; WO-19-003 (FRD-19, W6) mounts the pill.
- **Disjointness.** `src/app/page.tsx` is also written by WO-18-002 (W5, a later wave); in W3 nobody else
  writes it. `src/lib/pendingMerge/**` is WO-13-013's again at W7 (deletion of the legacy reader).
- **No backend contract file.** No route handler is added or changed, so no `docs/api/<wo-id>.md` (DR-060).

## Work Orders

1. WO-21-003 `worktrees-by-repo` (medium, W3): reader, pill summary, card, dialog.

## Superseded (v1 history)

- WO-21-001 `pending-merge-reader` (superseded by WO-21-003): the factory-only reader, kept as code until WO-13-013.
- WO-21-002 `pending-merge-ui` (superseded by WO-21-003 and WO-19-003): the top-bar indicator, popover and the Resumen block.

## Readiness check (DR-100)

Every `REQ-21-001..008` maps to a component or interface above; the five live ACs are each owned by exactly one
work order (AC-21-007.1 to AC-21-007.3 by WO-21-003, AC-21-008.1 and AC-21-008.2 by WO-19-003, see the AC
coverage table); `dependsOn` is acyclic; no unresolved question survives in this feature's documents.
