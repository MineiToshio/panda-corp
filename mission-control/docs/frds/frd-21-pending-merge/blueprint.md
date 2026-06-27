---
id: BP-21
type: blueprint
title: 'Blueprint — FRD-21 Pending-merge visibility'
status: ACTIVE
implementation_status: IN_PROGRESS
last_updated: '2026-06-27'
---
# Blueprint — FRD-21 Pending-merge visibility

Implementation design for surfacing un-merged parallel work in Mission Control. Platform stack & data
conventions: `docs/product/architecture.md`. Data contract: FRD-21 "Data source".

## Architecture

Read-only, file-backed, following the existing MC data-layer pattern (a `lib/` reader → Server Component
→ presentational components), the single-source rule (DR-092), and fail-loud reads (DR-078).

```
.pandacorp/run/worktrees/*.json  ─┐
.pandacorp/run/pending-work.json ─┴─▶ lib/pending-merge (reader, per project)
                                          │  unions + dedups by branch, tags status/age, fail-loud
   factory root (PANDACORP_FACTORY_ROOT)  ▼
                              getPendingMerge() (React.cache, cross-project aggregate — single source)
                                   ├─▶ AppShell global indicator (FRD-19)  → cross-project popover list
                                   └─▶ tab-summary "Pendientes de merge" block (this project)
```

## Data layer — `src/lib/pendingMerge/`

- **Schema (Zod, DR-078).** `PendingItemSchema` = `{ project, branch, worktree, task, ageHours, status }`
  with `status` a discriminated literal `'in-progress' | 'ready' | 'stale'`. Parse the snapshot/manifest;
  on a shape it can't parse, return a typed `{ kind: 'error', reason }`, never `[]`. Derive TS types via
  `z.infer`.
- **Reader** `readProjectPending(projectRoot)`: read `.pandacorp/run/pending-work.json` (the `--json`
  snapshot) AND `.pandacorp/run/worktrees/*.json` (manifest), union by branch, prefer the snapshot's
  status/age, fall back to the manifest, compute `status` from `ageHours` + worktree-liveness. Returns a
  `Result` union (`ok` | `empty` | `error`) — "empty" (truly none) and "error" (unreadable) are distinct.
- **Aggregate** `getPendingMerge()` wrapped in `React.cache()` (request-scoped single source, DR-092):
  iterate the portfolio's project roots (reuse FRD-01/FRD-03 project discovery), map each through the
  reader, flatten, sort `stale → ready → in-progress`. Every surface reads THIS, never re-derives.
- **Staleness threshold** read from `PANDACORP_STALE_HOURS` (default 3) — one constant in
  `src/lib/constants.ts`, shared with the check.

## Snapshot wiring (small factory addition, in scope)

`pending-work.sh` gains a `--snapshot` mode (or the `/loop` driver redirects `--json` to
`.pandacorp/run/pending-work.json`) so MC reads a file instead of shelling out to git in the request path.
This is the only non-MC change and stays in the gitignored runtime layer.

## UI

- **Global indicator** — extend the FRD-19 `AppShell` top bar with a `PendingMergeIndicator` (client
  island; reads the cached aggregate via a Server Component boundary). States: hidden/calm (0), `⎇ N`
  (default), alert variant (any stale). Activatable by click + keyboard; opens a `PendingMergePanel`
  popover (focus-trapped, Esc-closable — `accessibility.md`). **Reuse before create (DR-057):** check the
  component inventory for an existing chip/badge + popover; extend, don't fork.
- **Cross-project list** — `PendingMergePanel`: rows (project · branch · task · age · status pill with
  icon+text), ordered, virtualized only if it ever exceeds ~50 (it won't). Each row shows the copy-able
  land command. Empty → *al día*; error → explicit error state.
- **Per-project block** — a `PendingMergeBlock` in `tab-summary`, fed the same items filtered to the
  current project. Empty → *al día*.
- Tokens only (no hardcoded visuals), light+dark, responsive (`styling-and-ui.md`). `data-testid` on the
  indicator, panel, and rows.

## Testing (TDD, risk-based)

- Reader unit tests against **real** fixtures (a populated snapshot, a manifest-only project, a
  foreign-language/gitignored variant) AND a **malformed** one that must fail loud (DR-078) — not return
  empty. Status/age derivation + the union/dedup are property-tested where cheap.
- Component tests by role/name: indicator shows/hides on count, alert on stale, panel opens, rows render;
  empty vs error are distinct.
- E2E smoke: the shell renders the indicator across routes; the Resumen tab shows the block.

## Out of scope (v1)

No merge/delete action from the UI (surface only). No push/desktop notification here — that lives in the
factory check's `--notify` (DR-096 §7). No history of merged work.
