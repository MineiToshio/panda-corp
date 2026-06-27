---
id: FRD-21
type: frd
title: 'FRD-21 — Pending-merge visibility (never strand a forgotten worktree)'
status: ACTIVE
implementation_status: PLANNED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-26'
---
# FRD-21 — Pending-merge visibility

Mission Control surfaces **un-merged parallel work** so the operator, who runs several conversations at
once and steps away, can never silently strand a forgotten worktree. It is the visibility layer of the
parallel-isolation flow (factory `build-orchestration.md` "Parallel manual sessions", DR-096): the
merge-queue removes a worktree **only** on a successful merge, so **a surviving worktree/branch = work not
yet in main**. Committed work is never *lost* (a branch persists in git past the conversation), but it can
be *forgotten* — this makes "forgotten" impossible to miss.

Read-only, like the rest of Mission Control (no writes to the factory, no Claude calls). It composes the
persistent app shell ([FRD-19](../frd-19-app-shell/frd.md)) for the global indicator and the project
workspace ([FRD-04](../frd-04-project-workspace/frd.md)) for the per-project breakdown, and reads the
honest live/no-signal + staleness conventions of observability ([FRD-12](../frd-12-observability-dataviz/frd.md)).

## Layout

1. **Global indicator (PRIMARY)** — a small chip in the persistent shell top bar (FRD-19), visible from
   every screen: `⎇ N pendientes`. Quiet (hidden or a calm "al día" dot) when N = 0; an **alert variant**
   when any item is stale. Click → the **cross-project pending list** (a popover/panel): one row per
   un-merged branch — project · branch · task · age · status.
2. **Per-project breakdown (SECONDARY)** — in the project workspace **Resumen tab** (`tab-summary`), a
   "Pendientes de merge" block listing THAT project's un-merged worktrees/branches, or an *al día* state.

## Acceptance criteria (EARS)

- REQ-21-001 — The shell SHALL show a global pending-merge indicator reachable from every screen. WHEN
  there is ≥1 un-merged worktree/branch across all projects, it SHALL show the count (`⎇ N pendientes`);
  WHEN there are none, it SHALL read calm (no manufactured urgency) — hidden or an *al día* affordance.
- REQ-21-002 — WHEN any pending item is **stale** (idle past the threshold, default 3h, from the factory
  `PANDACORP_STALE_HOURS`), the indicator SHALL adopt its **alert** variant, and the status SHALL be
  conveyed by **text + icon**, never color alone (a11y; `accessibility.md`).
- REQ-21-003 — Activating the indicator SHALL open a **cross-project list** of un-merged work; each row
  SHALL show project, branch, task (if known), age, and status — one of `in-progress` (a live worktree /
  recent), `ready` (committed, clean, idle, not merged), `stale` (idle past the threshold). Rows SHALL be
  ordered stale → ready → in-progress (most-at-risk first).
- REQ-21-004 — The project **Resumen tab** SHALL show a "Pendientes de merge" block with that project's
  un-merged items, or an *al día* state when none.
- REQ-21-005 — The surface SHALL be **read-only** and SHALL NOT call Claude. It SHALL NOT offer a
  merge/delete action in v1 (it only *surfaces*); each row MAY show the copy-able command to land it
  (`cd <worktree> && bash .pandacorp/merge-queue.sh`).
- REQ-21-006 — The data reader SHALL be **fail-loud** (DR-078): on an unreadable/malformed source it
  SHALL render an explicit error state, NEVER a silent empty list that reads as "al día". "Zero pending"
  and "could not read" are distinct, distinctly-rendered states.

## Data source

Per project, two file-based inputs under the (gitignored) `.pandacorp/run/`:
- the **active-worktree manifest** `worktrees/*.json` (branch, path, task, started-at — written by
  `worktree-bootstrap.sh` on entry, removed on merge);
- a **pending snapshot** `pending-work.json` (the `--json` output of `.pandacorp/pending-work.sh`,
  refreshed periodically by the check's `/loop`/cron driver) — this carries the branches whose worktree
  was already swept (`git branch --no-merged`), which the manifest alone can't show.

Mission Control reads files only (no shelling out to git in the request path); the snapshot is the bridge.
The reader unions the two by branch, dedups, and tags each with status + age. Missing/empty snapshot →
fall back to the manifest; unreadable → the error state (REQ-21-006).

## Edge cases

- No parallel work anywhere → the indicator is calm/hidden and every Resumen tab shows *al día*; nothing
  is faked.
- A worktree whose branch is already merged (a race) → not pending; excluded.
- The snapshot is stale (the driver hasn't run) → show the manifest-derived view and a subtle "datos de
  hace X" freshness note (FRD-12 convention), never a confidently-wrong "al día".
- Many pending items → the list stays ordered and scrolls; the indicator caps the visible number (`9+`).

## Notes

- The factory data layer already exists: `.pandacorp/pending-work.sh` (`--json`/`--notify`) + the
  `worktree-bootstrap.sh` manifest writer (DR-096). This FRD is the **MC surfacing** of that data; it does
  not re-implement the derivation (DR-092 — single source).
- Writing the `pending-work.json` snapshot (a tiny `--json > file` step in the check's driver) is in scope
  for this feature's work orders so MC has a file to read without shelling out to git.
- Placement decided with the owner (2026-06-26): global ambient indicator primary, per-project Resumen
  secondary — "the fear is *not looking*, so the signal must be global, not buried in one tab."
