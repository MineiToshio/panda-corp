---
id: WO-21-002
type: work-order
title: 'UI: global shell indicator + cross-project panel + Resumen block'
frd: FRD-21
status: ACTIVE
implementation_status: IN_REVIEW
artifacts:
  - 'src/app/**/_components/PendingMerge*/**'
  - 'src/components/modules/PendingMerge*/**'
dependsOn:
  - WO-21-001
difficulty: medium
---
# WO-21-002 — Pending-merge UI

## In-Scope
- **Global indicator** in the FRD-19 `AppShell` top bar: `PendingMergeIndicator` (client island reading
  the `getPendingMerge()` aggregate via a Server Component boundary). Calm/hidden at 0; `⎇ N pendientes`
  default; **alert variant** when any item is stale; cap visible count at `9+`. Status by **text + icon**,
  never color alone (REQ-21-002, `accessibility.md`).
- **Cross-project panel** `PendingMergePanel` (popover, focus-trapped, Esc-closable): rows project ·
  branch · task · age · status pill (icon+text), ordered stale→ready→in-progress, each with the copy-able
  land command (`cd <worktree> && bash .pandacorp/merge-queue.sh`). Empty → *al día*; error → explicit
  error state (REQ-21-006).
- **Per-project block** `PendingMergeBlock` in `tab-summary`, same items filtered to the current project.
- **Reuse before create (DR-057):** check `docs/design/components.md` for an existing chip/badge + popover
  primitive; extend with a variant, do not fork. Tokens only, light+dark, responsive. `data-testid` on
  indicator, panel, rows.

## Tests (RED first)
- By role/name: indicator hidden at 0, shows count, alert on stale; panel opens on click + keyboard;
  rows render project/branch/age/status; empty vs error are distinct, distinctly rendered.
- Smoke (Preview gate): the shell renders the indicator across routes; the Resumen tab renders the block;
  no console error / blank render.

## Status Note — IN_REVIEW (complete)
**DONE:** (1) the **global indicator** `PendingMergeBadge` wired into `AppShell` via an optional
`pendingMergeBadge` slot (topbar, OUTSIDE the nav row → DR-075 shell gate untouched), fed by `layout.tsx`:
calm/hidden when empty, `⎇ pendientes` + CountBadge default, `danger`-toned `data-state="stale"` when stale,
explicit error chip when git is unreadable. (2) the **panel** — the chip is a button that opens the shared
**Modal** primitive (DR-057, focus-trap + Esc + backdrop) listing each item (branch · status-as-text · age ·
the land command). Status by text, not color alone (AC-21-002). Tests: empty→null, ok→count, stale→alert,
error→chip, click→Modal-with-rows. Verified: tsc + biome (`--error-on-warnings`) + knip clean, 5 unit tests green.
(3) the **per-project `PendingMergeBlock`** in `tab-summary`, rendered right after the decisions block,
fed `readPending(projectPath)` from `ProjectWorkspace`: lists this project's un-merged worktrees (branch ·
status-as-text · age · land command), or an "al día" / explicit-error state (fail-loud, DR-078). Tests:
empty / error / ok-with-rows. Built once the contended file was free (sessions finished). Verified: tsc +
biome + the full gate green (7049 tests + e2e/visual; the /portfolio baseline re-blessed for the new section).
