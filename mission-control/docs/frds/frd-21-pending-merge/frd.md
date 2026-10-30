---
id: FRD-21
type: frd
title: 'FRD-21 — Pending-merge visibility (never strand a forgotten worktree)'
status: ACTIVE
implementation_status: PLANNED
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-21-pending-merge/mocks/pending-merge.html
last_updated: '2026-10-22'
floor: false
---
# FRD-21 — Pending-merge visibility

Mission Control surfaces **un-merged parallel work** so the operator, who runs several conversations at
once and steps away, can never silently strand a forgotten worktree. It is the visibility layer of the
parallel-isolation flow (factory `build-orchestration.md` "Parallel manual sessions", DR-096): the
merge-queue removes a worktree **only** on a successful merge, so **a surviving worktree/branch = work not
yet in main**. Committed work is never *lost* (a branch persists in git past the conversation), but it can
be *forgotten* — this makes "forgotten" impossible to miss.

Read-only, like the rest of Mission Control (no writes to the factory, no Claude calls). It composes the
persistent app shell ([FRD-19](../frd-19-app-shell/frd.md)) for the global pill and the Inicio
([FRD-18](../frd-18-dashboard/frd.md)) for the "Árboles de trabajo" card, and reads the
honest live/no-signal + staleness conventions of observability ([FRD-12](../frd-12-observability-dataviz/frd.md)).

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype draws the "Árboles de trabajo" card on Inicio instead of a popover list and a per-project block (contradiction C-19 of `docs/design/freeze/reconciliation.md`). The owner decided at M1 (2026-10-22) to DRAW the global indicator as a sidebar pill. Items the owner left out of v2 are prefixed **Out of v2**. Prototype-drawn behaviours are REQ-21-007 and REQ-21-008.

## Layout

1. **Global pill (PRIMARY)** — a pill in the persistent sidebar (FRD-19), like "Plugin desactualizado", visible from
   every screen: `⎇ N pendientes`. Hidden when nothing is pending; an **alert variant** when a repository is in
   the state "Depurar ya" or could not be read. Click → Inicio's **"Árboles de trabajo"** card.
2. **"Árboles de trabajo" card (SECONDARY)** — on Inicio (FRD-18), a table with one row per repository,
   each opening a dialog with its branches.
3. **Out of v2 (owner decision 2026-10-21):** a "Pendientes de merge" block in each project's Resumen tab.

## Acceptance criteria (EARS)

- REQ-21-001 — The shell SHALL show a global pending-merge pill reachable from every screen (AC-21-008.1). WHEN
  there is ≥1 un-merged branch across all repositories, it SHALL show the count (`⎇ N pendientes`);
  WHEN there are none, it SHALL be hidden (no manufactured urgency).
- REQ-21-002 — WHEN any repository is in the state **"Depurar ya"** (the legend rule of AC-21-007.1) or could not be read, the pill SHALL adopt its **alert** variant, and the status SHALL be
  conveyed by **text + icon**, never color alone (a11y; `accessibility.md`). (Amended 2026-10-22: the earlier idle-past-3h `PANDACORP_STALE_HOURS` threshold is replaced by the legend rule.)
- REQ-21-003 — Activating the pill SHALL open Inicio's **"Árboles de trabajo"** card (AC-21-007.1); each repository row SHALL open the list of its branches (AC-21-007.2). (Amended 2026-10-22: it replaced the cross-project popover whose rows were ordered stale → ready → in-progress.)
- REQ-21-004 — **Out of v2 (owner decision 2026-10-21; the per-repository dialog on Inicio covers it, AC-21-007.2):** The project **Resumen tab** SHALL show a "Pendientes de merge" block with that project's
  un-merged items, or an *al día* state when none.
- REQ-21-005 — The surface SHALL be **read-only** and SHALL NOT call Claude. It SHALL NOT offer a
  merge/delete action in v1 (it only *surfaces*); it SHALL show `/pandacorp:worktrees` as the copyable cleanup command (AC-21-007.3). (Amended 2026-10-22: it replaced the per-row `cd <worktree> && bash .pandacorp/merge-queue.sh` command.)
- REQ-21-006 — The data reader SHALL be **fail-loud** (DR-078): on an unreadable/malformed source it
  SHALL render an explicit error state, NEVER a silent empty list that reads as "al día". "Zero pending"
  and "could not read" are distinct, distinctly-rendered states: a repository that could not be read shows one row with the coral chip "No se pudo leer", distinct from "Al día" (state `worktrees-unreadable`, M1 2026-10-22).

### REQ-21-007 — "Árboles de trabajo" card (added 2026-10-22, design freeze)

- **AC-21-007.1** — THE Inicio SHALL show the card "Árboles de trabajo" with one row per repository that has unmerged branches or leftover worktrees (columns Proyecto · Sin integrar · Sobrantes · Estado), each state computed as text by this rule: **Depurar ya** when it has 3 or more leftover worktrees, 3 or more unmerged branches, or any branch untouched for more than 7 days; else **Revisar pronto** when it has any leftover worktree or a branch older than 1 day; else **Al día** when it has only recent work; **Limpio** when nothing is pending or left over. Leftovers SHALL come from `git worktree list`, without the locked worktrees. The card SHALL explain the rule in the legend "¿Cómo se decide el estado?".
- **AC-21-007.2** — WHEN a repository row is activated, THE system SHALL open a dialog listing its branches, each with its last-commit subject, origin, age, commits outside `main`, uncommitted changes count and branch name.
- **AC-21-007.3** — THE card SHALL show `/pandacorp:worktrees` (the cleanup skill, DR-135) as a normal copyable command with the line "Para depurar un proyecto, corre en su carpeta" (no "Habilidad propuesta" label).

### REQ-21-008 — Global pill (added 2026-10-22, M1 decision)

- **AC-21-008.1** — WHILE at least one branch has work outside `main`, or a repository could not be read, THE sidebar SHALL show the pill "⎇ N pendientes" (N = branches with work outside `main`, across every repository), whose title reads "N ramas sin integrar en main. Abre «Árboles de trabajo» en Inicio.", and WHEN it is activated THE system SHALL open Inicio's "Árboles de trabajo" card; WHILE nothing is pending and every repository was read, THE pill SHALL be hidden.
- **AC-21-008.2** — WHEN a repository is in the state "Depurar ya" or could not be read, THE pill SHALL show an alert icon and the text "· depurar ya" or "· sin leer" after the count.

**Worked example (AC-21-007.1).** Repository A has 1 unmerged branch last touched 2 hours ago and no leftover worktree: state "Al día". Repository B has 1 leftover worktree: "Revisar pronto". Repository C has 2 unmerged branches, one untouched for 9 days: "Depurar ya". Repository D has nothing: "Limpio". The pill reads "⎇ 3 pendientes · depurar ya" and its alert variant is on.

## Data source (historical, v1; superseded 2026-10-22)

> Superseded by AC-21-007.1: in v2 the leftovers come from `git worktree list` (without the locked worktrees), not from the file-based manifest and snapshot below. Kept only so the v1 rationale stays traceable; it is not a requirement.

Per project, two file-based inputs under the (gitignored) `.pandacorp/run/`:
- the **active-worktree manifest** `worktrees/*.json` (branch, path, task, started-at — written by
  `worktree-bootstrap.sh` on entry, removed on merge);
- a **pending snapshot** `pending-work.json` (the `--json` output of `.pandacorp/pending-work.sh`,
  refreshed periodically by the check's `/loop`/cron driver) — this carries the branches whose worktree
  was already swept (`git branch --no-merged`), which the manifest alone can't show.

Mission Control reads files only (no shelling out to git in the request path); the snapshot is the bridge.
The reader unions the two by branch, dedups, and tags each with age. Missing/empty snapshot →
fall back to the manifest; unreadable → the error state (REQ-21-006).

## Edge cases

- No parallel work anywhere → the pill is hidden and the card shows every repository as "Limpio"; nothing
  is faked.
- A worktree whose branch is already merged (a race) → not pending; excluded.
- The snapshot is stale (the driver hasn't run) → show the manifest-derived view and a subtle "datos de
  hace X" freshness note (FRD-12 convention), never a confidently-wrong "al día".
- A repository that cannot be read → its row shows "No se pudo leer" and the pill goes to its alert variant (REQ-21-006, AC-21-008.2).

## Notes

- The factory data layer already exists: `.pandacorp/pending-work.sh` (`--json`/`--notify`) + the
  `worktree-bootstrap.sh` manifest writer (DR-096). This FRD is the **MC surfacing** of that data; it does
  not re-implement the derivation (DR-092 — single source).
- Writing the `pending-work.json` snapshot (a tiny `--json > file` step in the check's driver) is in scope
  for this feature's work orders so MC has a file to read without shelling out to git.
- Placement decided with the owner (2026-06-26): global ambient indicator primary — "the fear is *not looking*, so the signal must be global, not buried in one tab" — and confirmed as the sidebar pill at M1 (2026-10-22).
