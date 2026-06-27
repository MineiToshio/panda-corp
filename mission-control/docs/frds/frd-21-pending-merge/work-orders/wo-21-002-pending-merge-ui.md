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

## Status Note
**Built (IN_REVIEW) — the global indicator only.** `PendingMergeBadge` (server-rendered shell slot, not a
client island — no interactivity in v1) is wired into `AppShell` via an optional `pendingMergeBadge` slot
(topbar, OUTSIDE the nav row so the DR-075 shell gate is untouched) and fed by `layout.tsx`. Calm/hidden
when empty, `⎇ pendientes` + CountBadge default, `danger`-toned + `data-state="stale"` when stale, explicit
error chip when git is unreadable (status by text/attr, not color alone). Tests:
`PendingMergeBadge/_tests` (empty→null, ok→count, stale→alert, error→chip). Verified: tsc + biome + knip
clean, unit tests green.
**DEFERRED to a follow-up (NOT built):** the cross-project **popover panel** (the badge currently links to
the work-orders view + carries the full list in its accessible name/title) and the **per-project
`PendingMergeBlock` in `tab-summary`**. These are a follow-up `/iterate` — the global indicator was the
owner's priority. Awaiting the FRD-21 review gate for VERIFIED.
